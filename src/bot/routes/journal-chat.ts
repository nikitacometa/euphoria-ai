import { Bot, Keyboard } from 'grammy';
import { Types } from 'mongoose';
import { countUserJournalEntries, getUserJournalEntries } from '../../database';
import { getTextForUser } from '../../utils/localization';
import { escapeHtml } from '../../utils/html';
import { createLogger } from '../../utils/logger';
import { LOG_LEVEL } from '../../config';
import { runJournalAgent, JournalAgentResult } from '../../ai/agent';
import { generateJournalInsights } from '../../ai/journal-ai';
import { getVideoFileId, transcribeVideoMessage, transcribeVoiceMessage } from '../../services/telegram-media';
import { JournalBotContext } from '../context';
import { buttonFilter, sendTranscriptionReply, showMainMenu, withWaitMessage } from '../helpers';
import { retrieveRelevantEntries } from '../../services/journal-retrieval';

const chatLogger = createLogger('JournalChat', LOG_LEVEL);

export function registerJournalChatRoutes(bot: Bot<JournalBotContext>): void {
    bot.filter(buttonFilter('exitChatMode'), async ctx => {
        ctx.session.mode = { kind: 'idle' };
        await ctx.reply(getTextForUser('exitedChatMode', ctx.user), { parse_mode: 'HTML' });
        await showMainMenu(ctx, ctx.user);
    });
}

function exitChatKeyboard(ctx: JournalBotContext): Keyboard {
    return new Keyboard().text(getTextForUser('exitChatMode', ctx.user)).resized();
}

/** Enters chat-about-journal mode. */
export async function enterChatMode(ctx: JournalBotContext): Promise<void> {
    const entryCount = await countUserJournalEntries(ctx.user._id as unknown as Types.ObjectId);

    if (entryCount === 0) {
        await ctx.reply(getTextForUser('noChatEntries', ctx.user), { parse_mode: 'HTML' });
        await showMainMenu(ctx, ctx.user);
        return;
    }

    ctx.session.mode = { kind: 'journal_chat' };
    await ctx.reply(getTextForUser('chatIntro', ctx.user), {
        reply_markup: exitChatKeyboard(ctx),
        parse_mode: 'HTML'
    });
}

/** Analyzes today's entries, then drops the user into chat mode. */
export async function handleAnalyzeToday(ctx: JournalBotContext): Promise<void> {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const allEntries = await getUserJournalEntries(ctx.user._id as unknown as Types.ObjectId);
    const todayEntries = allEntries.filter(entry => {
        const entryDate = new Date(entry.createdAt);
        return entryDate >= dayStart && entryDate < dayEnd;
    });

    if (todayEntries.length === 0) {
        await ctx.reply(getTextForUser('noTodayEntries', ctx.user), { parse_mode: 'HTML' });
        await showMainMenu(ctx, ctx.user);
        return;
    }

    try {
        const analysis = await withWaitMessage(ctx, () =>
            generateJournalInsights(
                todayEntries,
                ctx.user,
                'Analyze my entries from today and provide insights about my day, mood, and experiences.'
            )
        );

        ctx.session.mode = { kind: 'journal_chat' };
        await ctx.reply(getTextForUser('todayAnalysis', ctx.user, { analysis }), {
            reply_markup: exitChatKeyboard(ctx),
            parse_mode: 'HTML'
        });
    } catch (error) {
        chatLogger.error("Error analyzing today's entries:", error);
        await ctx.reply('I encountered an error while analyzing your entries. Please try again later.');
        await showMainMenu(ctx, ctx.user);
    }
}

/** Handles chat questions; the message router calls this while mode is 'journal_chat'. */
export async function handleChatMessage(ctx: JournalBotContext): Promise<void> {
    if (!ctx.message) {
        return;
    }

    const entryCount = await countUserJournalEntries(ctx.user._id as unknown as Types.ObjectId);
    if (entryCount === 0) {
        ctx.session.mode = { kind: 'idle' };
        await ctx.reply(getTextForUser('noChatEntries', ctx.user), { parse_mode: 'HTML' });
        await showMainMenu(ctx, ctx.user);
        return;
    }

    if (ctx.message.text !== undefined) {
        await answerTextQuestion(ctx, ctx.message.text);
        return;
    }

    if (ctx.message.voice) {
        await answerMediaQuestion(ctx, () => transcribeVoiceMessage(ctx, ctx.message!.voice!.file_id), 'errorProcessingVoice');
        return;
    }

    const videoFileId = getVideoFileId(ctx.message);
    if (videoFileId) {
        await answerMediaQuestion(ctx, () => transcribeVideoMessage(ctx, videoFileId), 'errorProcessingVideo');
        return;
    }

    await ctx.reply(getTextForUser('askMeAnything', ctx.user), { parse_mode: 'HTML' });
}

async function answerTextQuestion(
    ctx: JournalBotContext,
    question: string
): Promise<void> {
    if (ctx.chat) {
        await ctx.api.sendChatAction(ctx.chat.id, 'typing');
    }

    try {
        try {
            const result = await runJournalAgent(ctx.user, question);
            await ctx.reply(formatAgentResponse(
                result,
                'Or maybe you wanna know something else? 😏'
            ), { parse_mode: 'HTML' });
        } catch (error) {
            chatLogger.error('Journal agent failed; using fixed retrieval fallback:', error);
            const response = await generateFallbackAnswer(ctx, question);
            await ctx.reply(
                `${escapeHtml(response)}\n\nOr maybe you wanna know something else? 😏`,
                { parse_mode: 'HTML' }
            );
        }
    } catch (error) {
        chatLogger.error('Error in journal chat:', error);
        await ctx.reply("I encountered an error while processing your question. Let's try again!");
    }
}

async function answerMediaQuestion(
    ctx: JournalBotContext,
    transcribe: () => Promise<string>,
    errorTextKey: 'errorProcessingVoice' | 'errorProcessingVideo'
): Promise<void> {
    try {
        await ctx.react('👍');

        const insights = await withWaitMessage(ctx, async () => {
            const transcription = await transcribe();
            await sendTranscriptionReply(ctx, ctx.message!.message_id, transcription, ctx.user);
            try {
                return await runJournalAgent(ctx.user, transcription);
            } catch (error) {
                chatLogger.error('Journal agent failed; using fixed retrieval fallback:', error);
                const answer = await generateFallbackAnswer(ctx, transcription);
                return { answer, followUpQuestions: [], toolCallCount: 0 };
            }
        });

        await ctx.reply(formatAgentResponse(
            insights,
            getTextForUser('anyOtherQuestions', ctx.user),
            true
        ), { parse_mode: 'HTML' });
    } catch (error) {
        chatLogger.error('Error processing media message in chat mode:', error);
        await ctx.reply(getTextForUser(errorTextKey, ctx.user), { parse_mode: 'HTML' });
    }
}

function formatAgentResponse(
    result: JournalAgentResult,
    closingLine: string,
    boldAnswer = false
): string {
    const escapedAnswer = escapeHtml(result.answer);
    const answer = boldAnswer ? `<b>${escapedAnswer}</b>` : escapedAnswer;
    const questions = result.followUpQuestions.slice(0, 2).map(escapeHtml).join('\n');
    return [answer, questions, closingLine].filter(Boolean).join('\n\n');
}

async function generateFallbackAnswer(
    ctx: JournalBotContext,
    question: string
): Promise<string> {
    const entries = await retrieveRelevantEntries(
        ctx.user._id as unknown as Types.ObjectId,
        question,
        6
    );
    return generateJournalInsights(entries, ctx.user, question);
}
