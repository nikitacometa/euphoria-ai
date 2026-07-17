import { Bot, Keyboard } from 'grammy';
import { Types } from 'mongoose';
import {
    completeJournalEntry,
    createJournalEntry,
    getActiveJournalEntry,
    getJournalEntryById,
    IUser,
    MessageRole,
    saveTextMessage,
    saveVideoMessage,
    saveVoiceMessage,
    updateJournalEntryAnalysis,
    updateJournalEntryQuestions
} from '../../database';
import { getTextForUser } from '../../utils/localization';
import { createLogger } from '../../utils/logger';
import { LOG_LEVEL } from '../../config';
import { analyzeJournalEntry, generateEntrySummary, generateJournalQuestions } from '../../ai/journal-ai';
import { getVideoFileId, transcribeVideoMessage, transcribeVoiceMessage } from '../../services/telegram-media';
import { appendMessageToEntry } from '../../services/journal-entry.service';
import { JournalBotContext } from '../context';
import { buttonFilter, sendTranscriptionReply, showMainMenu, withWaitMessage } from '../helpers';

const entryLogger = createLogger('JournalEntry', LOG_LEVEL);

export function registerJournalEntryRoutes(bot: Bot<JournalBotContext>): void {
    bot.filter(buttonFilter('finishEntry'), requireActiveEntry(finishJournalEntry));
    bot.filter(ctx => ctx.message?.text === '✅ Finish Reflection', requireActiveEntry(finishJournalEntry));
    bot.filter(buttonFilter('goDeeper'), requireActiveEntry(handleGoDeeper));
    bot.filter(buttonFilter('cancelEntry'), requireActiveEntry(cancelJournalEntry));

    bot.callbackQuery('analyze_journal', async ctx => {
        await ctx.answerCallbackQuery();
        await requireActiveEntry(handleAnalyzeJournal)(ctx);
    });
    bot.callbackQuery('go_deeper', async ctx => {
        await ctx.answerCallbackQuery();
        await requireActiveEntry(handleGoDeeper)(ctx);
    });
    bot.callbackQuery('finish_journal', async ctx => {
        await ctx.answerCallbackQuery();
        await requireActiveEntry(finishJournalEntry)(ctx);
    });
}

/** Guards entry actions: without an active entry, sends the user back to the menu. */
function requireActiveEntry(
    handler: (ctx: JournalBotContext, entryId: Types.ObjectId) => Promise<void>
): (ctx: JournalBotContext) => Promise<void> {
    return async ctx => {
        if (ctx.session.mode.kind !== 'journal_entry') {
            await ctx.reply("No active journal entry found. Let's go back to the main menu.");
            await showMainMenu(ctx, ctx.user);
            return;
        }
        await handler(ctx, new Types.ObjectId(ctx.session.mode.entryId));
    };
}

function entryActionKeyboard(user: IUser): Keyboard {
    return new Keyboard()
        .text(getTextForUser('finishEntry', user))
        .row()
        .text(getTextForUser('goDeeper', user))
        .row()
        .text(getTextForUser('cancelEntry', user))
        .resized();
}

/** Starts a new entry or resumes the active one. */
export async function enterJournalEntry(ctx: JournalBotContext): Promise<void> {
    const activeEntry = await getActiveJournalEntry(ctx.user._id as unknown as Types.ObjectId);
    const entry = activeEntry ?? (await createJournalEntry(ctx.user._id as unknown as Types.ObjectId));

    ctx.session.mode = { kind: 'journal_entry', entryId: entry._id?.toString() || '' };

    await ctx.reply(getTextForUser(activeEntry ? 'continueEntry' : 'newEntry', ctx.user), {
        reply_markup: entryActionKeyboard(ctx.user),
        parse_mode: 'HTML'
    });
}

/** Handles journal content; the message router calls this while mode is 'journal_entry'. */
export async function handleJournalEntryMessage(ctx: JournalBotContext): Promise<void> {
    if (!ctx.message || ctx.session.mode.kind !== 'journal_entry') {
        return;
    }
    const entryId = new Types.ObjectId(ctx.session.mode.entryId);

    const entry = await getJournalEntryById(entryId);
    if (!entry) {
        ctx.session.mode = { kind: 'idle' };
        await ctx.reply("Could not find your active journal entry. Let's start a new one.");
        await showMainMenu(ctx, ctx.user);
        return;
    }

    if (ctx.message.text !== undefined) {
        const message = await saveTextMessage(
            ctx.user._id as unknown as Types.ObjectId,
            entryId,
            ctx.message.message_id,
            ctx.message.text,
            MessageRole.USER
        );
        await appendMessageToEntry(entryId, message._id as unknown as Types.ObjectId);
        await ctx.react('👍');
        return;
    }

    if (ctx.message.voice) {
        await saveMediaMessage(ctx, entryId, {
            transcribe: () => transcribeVoiceMessage(ctx, ctx.message!.voice!.file_id),
            fileId: ctx.message.voice.file_id,
            save: saveVoiceMessage,
            errorText: 'Sorry, I had trouble processing your voice message. Please try again or send a text message instead.'
        });
        return;
    }

    const videoFileId = getVideoFileId(ctx.message);
    if (videoFileId) {
        await saveMediaMessage(ctx, entryId, {
            transcribe: () => transcribeVideoMessage(ctx, videoFileId),
            fileId: videoFileId,
            save: saveVideoMessage,
            errorText: 'Sorry, I had trouble processing your video. Please try again or send a text message instead.'
        });
        return;
    }

    await ctx.reply('I can only accept text, voice messages, and videos for your journal entries.');
}

interface MediaMessageOptions {
    transcribe: () => Promise<string>;
    fileId: string;
    save: (
        userId: Types.ObjectId,
        conversationId: Types.ObjectId,
        telegramMessageId: number,
        fileId: string,
        transcription: string,
        role?: MessageRole
    ) => Promise<{ _id?: unknown }>;
    errorText: string;
}

async function saveMediaMessage(
    ctx: JournalBotContext,
    entryId: Types.ObjectId,
    options: MediaMessageOptions
): Promise<void> {
    try {
        await ctx.react('👍');
        const transcription = await withWaitMessage(ctx, options.transcribe);

        const message = await options.save(
            ctx.user._id as unknown as Types.ObjectId,
            entryId,
            ctx.message!.message_id,
            options.fileId,
            transcription,
            MessageRole.USER
        );
        await appendMessageToEntry(entryId, message._id as Types.ObjectId);

        await sendTranscriptionReply(ctx, ctx.message!.message_id, transcription, ctx.user);
    } catch (error) {
        entryLogger.error('Error processing media message:', error);
        await ctx.reply(options.errorText);
    }
}

/** Completes the entry: generates a summary + reflection question, then saves. */
async function finishJournalEntry(ctx: JournalBotContext, entryId: Types.ObjectId): Promise<void> {
    const entry = await getJournalEntryById(entryId);
    if (!entry) {
        ctx.session.mode = { kind: 'idle' };
        await ctx.reply('Could not find your active journal entry.');
        await showMainMenu(ctx, ctx.user);
        return;
    }

    try {
        const { summary, question } = await withWaitMessage(ctx, () => generateEntrySummary(entry, ctx.user));
        await completeJournalEntry(entryId, summary, question);

        const formattedMessage = `<b>Good job, ${ctx.user.name || ctx.user.firstName}! ✨ Entry saved.</b>\n\n<b>📝 Summary:</b>\n${summary}\n\n<b>💭 Something to reflect on:</b>\n<i>${question}</i>`;
        await ctx.reply(formattedMessage, { parse_mode: 'HTML' });
    } catch (error) {
        entryLogger.error('Error finishing journal entry:', error);
        await ctx.reply(
            "I encountered an error while analyzing your journal entry. Your entry has been saved, but I couldn't generate a detailed analysis."
        );
        await completeJournalEntry(
            entryId,
            'Analysis not available due to an error.',
            'Thank you for sharing your thoughts. Keep journaling regularly to build a meaningful record of your experiences and growth.'
        );
    }

    ctx.session.mode = { kind: 'idle' };
    await showMainMenu(ctx, ctx.user);
}

/** Cancels the active entry and returns to the menu. */
async function cancelJournalEntry(ctx: JournalBotContext): Promise<void> {
    ctx.session.mode = { kind: 'idle' };
    await ctx.reply(getTextForUser('entryCanceled', ctx.user), { parse_mode: 'HTML' });
    await showMainMenu(ctx, ctx.user);
}

/** Generates follow-up questions for the active entry. */
async function handleAnalyzeJournal(ctx: JournalBotContext, entryId: Types.ObjectId): Promise<void> {
    try {
        const entry = await getJournalEntryById(entryId);
        if (!entry) {
            ctx.session.mode = { kind: 'idle' };
            await ctx.reply("<b>Hmm, I can't seem to find your journal entry.</b> Let's start fresh!", {
                parse_mode: 'HTML'
            });
            await showMainMenu(ctx, ctx.user);
            return;
        }

        const questions = await withWaitMessage(ctx, () => generateJournalQuestions(entry, ctx.user));
        await updateJournalEntryQuestions(entryId, questions);

        if (questions.length > 0) {
            const questionsText = questions.map((q, i) => `<i>${i + 1}. ${q}</i>`).join('\n\n');
            await ctx.reply(
                `<b>I've been thinking about what you shared, ${ctx.user.name || ctx.user.firstName}... 🤔</b>\n\n<b>Questions to ponder:</b>\n\n${questionsText}`,
                { parse_mode: 'HTML' }
            );
        }

        await ctx.reply('<b>Feel free to share your thoughts on these questions</b>, or we can wrap up whenever you\'re ready!', {
            reply_markup: entryActionKeyboard(ctx.user),
            parse_mode: 'HTML'
        });
    } catch (error) {
        entryLogger.error('Error in analyze journal handler:', error);
        await ctx.reply(
            `<b>Oops!</b> My brain got a little fuzzy there. Let's try again later, ${ctx.user.name || ctx.user.firstName}!`,
            { parse_mode: 'HTML' }
        );
        await showMainMenu(ctx, ctx.user);
    }
}

/** Generates a deeper analysis plus follow-up questions for the active entry. */
async function handleGoDeeper(ctx: JournalBotContext, entryId: Types.ObjectId): Promise<void> {
    try {
        const entry = await getJournalEntryById(entryId);
        if (!entry) {
            ctx.session.mode = { kind: 'idle' };
            await ctx.reply(getTextForUser('entryNotFound', ctx.user), { parse_mode: 'HTML' });
            await showMainMenu(ctx, ctx.user);
            return;
        }

        const { analysis, questions } = await withWaitMessage(ctx, async () => {
            const [analysis, questions] = await Promise.all([
                analyzeJournalEntry(entry, ctx.user),
                generateJournalQuestions(entry, ctx.user)
            ]);
            return { analysis, questions };
        });

        await updateJournalEntryAnalysis(entryId, analysis);
        await updateJournalEntryQuestions(entryId, questions);

        if (questions.length > 0) {
            const questionsText = questions.map((q, i) => `<i>${i + 1}. ${q}</i>`).join('\n\n');
            await ctx.reply(getTextForUser('deeperQuestions', ctx.user, { analysis, questions: questionsText }), {
                parse_mode: 'HTML'
            });
        }

        await ctx.reply(getTextForUser('thoughtsOnQuestions', ctx.user), {
            reply_markup: entryActionKeyboard(ctx.user),
            parse_mode: 'HTML'
        });
    } catch (error) {
        entryLogger.error('Error in go deeper handler:', error);
        await ctx.reply(
            `<b>Something went wrong with my thinking cap, ${ctx.user.name || ctx.user.firstName}!</b> Let's try again later.`,
            { parse_mode: 'HTML' }
        );
        await showMainMenu(ctx, ctx.user);
    }
}
