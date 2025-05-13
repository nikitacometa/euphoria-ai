import { Types } from 'mongoose';
import { Bot, Context, Keyboard, InlineKeyboard } from 'grammy';
import { JournalBotContext } from '../../types/session';
import { IUser, IJournalEntry, IMessage, MessageType, MessageRole, IChatMessage } from '../../types/models';
import { logger } from '../../utils/logger';
import {
    findOrCreateUser, // Need this for hears handlers
} from '../../database';
import { transcribeAudio } from '../../services/ai/openai.service';
import { sendTranscriptionReply, extractFullText, sanitizeHtmlForTelegram, createEntryStatusMessage, formatMessageList, formatErrorMessage as formatUtilErrorMessage } from './utils';
import { journalActionKeyboard, createConfirmCancelKeyboard, ButtonText, CALLBACKS } from './keyboards/index';
import { showMainMenu } from '../core/handlers';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { TELEGRAM_API_TOKEN } from '../../config';
import { openAIService } from "../../services/ai/openai-client.service";
import { journalPrompts } from "../../config/ai-prompts";
import { AIError } from "../../types/errors";
import { errorService } from "../../services/error.service";
import { 
    addTextMessage, 
    addVideoMessage, 
    addVoiceMessage, 
    completeEntry, 
    generateQuestionsForEntry, 
    getEntryById,
    getOrCreateActiveEntry,
    updateEntryAnalysisAndQuestions
} from '../../services/journal-entry.service';
import { createBackToMenuKeyboard } from '../core/keyboards';
import { MAIN_MENU_CALLBACKS } from '../core/keyboards';
import { t } from '../../utils/localization'; // Import t function

// Define a constant for max voice message duration
export const MAX_VOICE_MESSAGE_LENGTH_SECONDS = 300; // 5 minutes

// Constants for message formatting
const HTML_PARSE_MODE = 'HTML' as const;
const DEFAULT_REPLY_OPTIONS = {
    parse_mode: HTML_PARSE_MODE
} as const;

/**
 * Helper function to process media messages (voice/video)
 * @param ctx - The context object
 * @param fileId - The file ID from Telegram
 * @param mediaType - Type of media (voice or video)
 * @returns The transcription of the media file
 */
async function processMediaMessage(
    ctx: JournalBotContext,
    fileId: string,
    mediaType: 'voice' | 'video'
): Promise<{ transcription: string; localFilePath: string }> {
    // Send transcription progress indicator without keyboard
    const progressMsg = await ctx.reply("⏳", {
        parse_mode: 'HTML'
        // No reply_markup to ensure no keyboard is shown
    });
    
    try {
        const file = await ctx.api.getFile(fileId);
        const filePath = file.file_path;
        if (!filePath) throw new Error(`${mediaType} file path not found`);

        const localFilePath = await downloadTelegramFile(filePath, mediaType);
        const transcription = await transcribeAudio(localFilePath);
        
        // Delete progress indicator message
        if (ctx.chat) {
            await ctx.api.deleteMessage(ctx.chat.id, progressMsg.message_id)
                .catch(e => logger.warn(`Failed to delete transcription progress message: ${e}`));
        }
        
        return { transcription, localFilePath };
    } catch (error) {
        // Delete progress indicator message on error too
        if (ctx.chat) {
            await ctx.api.deleteMessage(ctx.chat.id, progressMsg.message_id)
                .catch(e => logger.warn(`Failed to delete transcription progress message after error: ${e}`));
        }
        
        // Re-throw for caller to handle
        throw error;
    }
}

/**
 * Helper function to reply with HTML formatting
 */
async function replyWithHTML(ctx: JournalBotContext, message: string, options: Partial<Parameters<Context['reply']>[1]> = {}) {
    return ctx.reply(message, {
        ...DEFAULT_REPLY_OPTIONS,
        ...options
    });
}

/**
 * Handles incoming messages (text, voice, video) during an active journal entry session.
 */
export async function handleJournalEntryInput(ctx: JournalBotContext, user: IUser) {
    if (!ctx.message || !ctx.from || !ctx.session.journalEntryId) return;
    
    if (ctx.session.lastStatusMessageId && ctx.chat) {
        try {
            await ctx.api.deleteMessage(ctx.chat.id, ctx.session.lastStatusMessageId)
                .catch(e => logger.warn("Failed to delete previous status message", e));
            ctx.session.lastStatusMessageId = undefined;
        } catch (error) {
            logger.warn("Error deleting previous status message", error);
        }
    }

    const entryId = new Types.ObjectId(ctx.session.journalEntryId);
    let currentEntry = await getEntryById(entryId); 

    if (!currentEntry || currentEntry.status === 'completed') {
        logger.warn(`Journal entry ${ctx.session.journalEntryId} not found or already completed for user ${user.telegramId}. Clearing session.`);
        ctx.session.journalEntryId = undefined;
        await replyWithHTML(ctx, t('errors:sessionExpiredJournal', { user }), {});
        await showMainMenu(ctx, user);
        return;
    }

    let messageSaved = false;
    let voiceDuration: number | undefined = undefined;
    let videoDuration: number | undefined = undefined;

    try {
        if ('text' in ctx.message) {
            await addTextMessage(user._id as Types.ObjectId, entryId, ctx.message.message_id, ctx.message.text || '');
            messageSaved = true;
            await ctx.react("👍").catch(e => logger.warn("Failed to react with thumbs up", e));
        } else if ('voice' in ctx.message && ctx.message.voice) {
            await ctx.react("👀").catch(e => logger.warn("Failed to react with eyes", e));
            const voice = ctx.message.voice;
            voiceDuration = voice.duration;
            if (voice.duration > MAX_VOICE_MESSAGE_LENGTH_SECONDS) {
                await replyWithHTML(ctx, t('errors:longVoiceMessage', { user, duration: MAX_VOICE_MESSAGE_LENGTH_SECONDS }), { reply_markup: journalActionKeyboard });
                return;
            }
            const { transcription, localFilePath } = await processMediaMessage(ctx, voice.file_id, 'voice');
            fs.unlinkSync(localFilePath);
            await addVoiceMessage(user._id as Types.ObjectId, entryId, ctx.message.message_id, voice.file_id, localFilePath, transcription, voiceDuration);
            messageSaved = true;
            await sendTranscriptionReply(ctx, ctx.message.message_id, transcription, user);
            await ctx.react("👍").catch(e => logger.warn("Failed to add thumbs up reaction", e));
        } else if (('video_note' in ctx.message && ctx.message.video_note) || ('video' in ctx.message && ctx.message.video)) {
            await ctx.react("👀").catch(e => logger.warn("Failed to react with eyes", e));
            const video = ('video_note' in ctx.message ? ctx.message.video_note : ctx.message.video);
            videoDuration = video?.duration;
            const fileId = video?.file_id || ''; 
            if (!fileId) throw new Error('Video file ID not found');
            let transcription = "";
            let localFilePath = "";
            try {
                const result = await processMediaMessage(ctx, fileId, 'video');
                transcription = result.transcription;
                localFilePath = result.localFilePath;
                fs.unlinkSync(localFilePath); 
            } catch (transcriptionError) {
                logger.error('Error transcribing video:', transcriptionError);
                transcription = t('journal:transcriptionErrorFallback', { user }); // Default to a key
            }
            await addVideoMessage(user._id as Types.ObjectId, entryId, ctx.message.message_id, fileId, localFilePath, transcription, videoDuration);
            messageSaved = true;
            await sendTranscriptionReply(ctx, ctx.message.message_id, transcription, user);
            await ctx.react("👍").catch(e => logger.warn("Failed to add thumbs up reaction", e));
        } else {
            await replyWithHTML(ctx, t('errors:unsupportedMessageTypeJournal', { user }), { reply_markup: journalActionKeyboard });
        }

        if (messageSaved) {
            const updatedEntry = await getEntryById(entryId);
            if (updatedEntry && updatedEntry.messages) {
                const populatedMessages = updatedEntry.messages.filter(m => typeof m !== 'string') as IMessage[];
                const messageListHtml = formatMessageList(populatedMessages, user);
                const statusText = await createEntryStatusMessage(updatedEntry, user); // Pass user
                const combinedMessage = `${messageListHtml}\n${statusText}`;
                const sentMsg = await replyWithHTML(ctx, combinedMessage, { reply_markup: journalActionKeyboard });
                ctx.session.lastStatusMessageId = sentMsg.message_id;
            }
        }
    } catch (error) {
        errorService.logError(
            error instanceof AIError 
                ? error 
                : new AIError(
                    'Error processing journal entry input', 
                    { userId: user._id?.toString() || '', entryId: entryId.toString(), messageType: ctx.message.voice ? 'voice' : ctx.message.video ? 'video' : 'text' },
                    error instanceof Error ? error : undefined
                ),
            {},
            'error'
        );
        await replyWithHTML(ctx, formatUtilErrorMessage('errors:errorProcessingInput', user), { reply_markup: journalActionKeyboard });
    }
}

/**
 * Handles the action of finishing and analyzing a journal entry.
 */
export async function finishJournalEntryHandler(ctx: JournalBotContext, user: IUser) {
    if (!ctx.session.journalEntryId) {
        logger.warn(`finishJournalEntryHandler called without active session entryId for user ${user.telegramId}`);
        await replyWithHTML(ctx, t('journal:noActiveEntry', { user }));
        await showMainMenu(ctx, user);
        return;
    }
    
    ctx.session.lastStatusMessageId = undefined;
    const entryId = new Types.ObjectId(ctx.session.journalEntryId);
    const entry = await getEntryById(entryId);
    
    if (!entry) {
        logger.warn(`Could not find journal entry ${ctx.session.journalEntryId} to finish for user ${user.telegramId}.`);
        ctx.session.journalEntryId = undefined;
        await replyWithHTML(ctx, t('journal:entryNotFound', { user }));
        await showMainMenu(ctx, user);
        return;
    }
    
    const waitMsg = await replyWithHTML(ctx, t('common:loadingEmoji', { user, defaultValue: "⏳" }));
    let rawApiResponseContent: string | null = null;
    
    try {
        const entryContent = await extractFullText(entry);
        if (!entryContent) {
             logger.warn(`Entry ${entryId} has no content to analyze.`);
             await completeEntry(entryId, t('journal:emptyEntryAnalysisSummary', {user}), t('journal:emptyEntryAnalysisQuestion', {user}));
             if (ctx.chat) await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(e => logger.warn("Failed to delete wait msg", e));
             await replyWithHTML(ctx, t('journal:entryEmptyAndSaved', { user }), { reply_markup: createBackToMenuKeyboard() });
             ctx.session.journalEntryId = undefined;
             return;
        }

        const userInfo = `User: ${user.name || user.firstName}`;
        // Correctly use t() for language instructions for the AI prompt
        const languageInstruction = user.aiLanguage === 'ru' ? 
            t('aiPrompts:completion.languageInstructionRu', { user, defaultValue: "\nPlease respond in Russian language. Ensure the output is a valid JSON object with keys: summary, question, name, keywords." }) :
            t('aiPrompts:completion.languageInstructionEn', { user, defaultValue: "\nPlease respond in English language. Ensure the output is a valid JSON object with keys: summary, question, name, keywords." });

        const messages: IChatMessage[] = [
            // Use t() for the base system prompt as well if it's meant to be localizable
            // For now, assuming journalPrompts.completionSystemPrompt is a base instruction not needing user-lang localization itself
            { role: 'system', content: journalPrompts.completionSystemPrompt + languageInstruction }, 
            { role: 'user', content: `${userInfo}\n\nEntry:\n${entryContent}\n\nProvide summary & question.` }
        ];
        
        const response = await openAIService.createChatCompletion(messages, {
            temperature: 0.7, max_tokens: 500, response_format: { type: "json_object" }
        });
        
        rawApiResponseContent = response.choices[0].message.content;
        const defaultQuestion = t('journal:defaultQuestionAfterAnalysis', {user});
        const defaultSummary = t('journal:defaultSummary', {user});
        const defaultName = t('journal:defaultEntryName', {user});
        const defaultKeywords = [t('journal:defaultKeyword1', {user}), t('journal:defaultKeyword2', {user})];

        const parsedResponse = openAIService.parseJsonResponse(
            rawApiResponseContent || "{}", 
            { summary: defaultSummary, question: defaultQuestion, name: defaultName, keywords: defaultKeywords }
        );
        
        const summary = parsedResponse.summary || defaultSummary;
        const question = parsedResponse.question || defaultQuestion;
        const entryName = parsedResponse.name || defaultName;
        const entryKeywords = parsedResponse.keywords || defaultKeywords;
        
        await completeEntry(entryId, summary, question, entryName, entryKeywords);
        if (ctx.chat) await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(e => logger.warn("Failed to delete wait msg", e));
        
        const sanitizedSummary = sanitizeHtmlForTelegram(summary);
        const formattedSummary = formatAsSummaryBullets(sanitizedSummary);
        const formattedQuestion = `🤔 <code>${sanitizeHtmlForTelegram(question)}</code>`;
        const formattedKeywordTags = entryKeywords && entryKeywords.length > 0 ? entryKeywords.map(k => `#${k.replace(/\s+/g, '_')}`).join(' ') : "";

        ctx.session.journalEntryId = undefined;
        const postSaveKeyboard = new InlineKeyboard()
            .text(t('journal:oneMoreEntryButton', {user}), MAIN_MENU_CALLBACKS.NEW_ENTRY)
            .text(t('journal:manageEntriesButton', {user}), MAIN_MENU_CALLBACKS.JOURNAL_HISTORY)
            .row()
            .text(t('journal:discussWithAiButton', {user}), MAIN_MENU_CALLBACKS.JOURNAL_CHAT)
            .text(t('settings:title', {user}), MAIN_MENU_CALLBACKS.SETTINGS);

        await replyWithHTML(ctx,
            `<b>📚 ${sanitizeHtmlForTelegram(entryName)}</b>\n\n${formattedSummary}\n\n${formattedKeywordTags}\n\n${formattedQuestion}`,
            { reply_markup: postSaveKeyboard }
        );
        
    } catch (error) {
        errorService.logError(
            error instanceof AIError
                ? error
                : new AIError(
                    'Error finishing journal entry',
                    {
                        entryId: entryId.toString(),
                        userId: user._id?.toString() || '',
                        rawApiResponse: rawApiResponseContent ?? '[Not Available]' // Include raw content
                    },
                    error instanceof Error ? error : undefined
                ),
            {},
            'error'
        );
        
        if (ctx.chat) await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(e => logger.warn("Failed to delete wait msg", e));
        await replyWithHTML(ctx, t('journal:analysisErrorSave', {user}), { reply_markup: createBackToMenuKeyboard() });
        
        // Attempt to complete entry even if AI fails
        try {
            await completeEntry(entryId, t('journal:analysisFailed', {user}), t('journal:errorDuringAnalysis', {user}));
        } catch (dbError) {
             logger.error(`Failed to mark entry ${entryId} as complete after AI error:`, dbError);
        }
        
        ctx.session.journalEntryId = undefined;
    }
}

// Helper function to convert newline-separated text to bullet points
function formatAsSummaryBullets(text: string): string {
    // Split by double newlines
    const points = text.split('\n\n').filter(point => point.trim().length > 0);
    
    // Convert to bullet points
    return points.map(point => `• ${point.trim()}`).join('\n\n');
}

/**
 * Handles the "🍑 Analyze" action.
 */
export async function analyzeAndSuggestQuestionsHandler(ctx: JournalBotContext, user: IUser) {
    if (!ctx.session.journalEntryId) {
        await replyWithHTML(ctx, t('journal:noActiveEntryForAnalysis', { user, lng: user.aiLanguage }));
        await showMainMenu(ctx, user);
        return;
    }
    ctx.session.lastStatusMessageId = undefined;
    try {
        const entryId = new Types.ObjectId(ctx.session.journalEntryId);
        const entry = await getEntryById(entryId);
        if (!entry) {
            logger.warn(`Entry ${ctx.session.journalEntryId} not found for analysis by user ${user.telegramId}`);
            ctx.session.journalEntryId = undefined;
            await replyWithHTML(ctx, t('journal:entryNotFoundForAnalysis', { user, lng: user.aiLanguage }));
            await showMainMenu(ctx, user);
            return;
        }
        const entryContent = await extractFullText(entry);
        if (!entryContent) {
            await replyWithHTML(ctx, t('journal:emptyEntryForAnalysis', { user, lng: user.aiLanguage }), { reply_markup: journalActionKeyboard });
            return; 
        }
        const waitMsg = await replyWithHTML(ctx, t('common:loadingEmoji', {user, lng: user.aiLanguage, defaultValue: "⏳"}));
        try {
            const userInfo = `User: ${user.name || user.firstName}`;
            // Assuming journalPrompts.deeperAnalysisPrompt is language-agnostic or handled internally by AI based on languageInstruction if needed
            // const languageInstruction = ... (could be added if needed for this specific prompt)

            const messages: IChatMessage[] = [
                { role: 'system', content: journalPrompts.deeperAnalysisPrompt }, // Base prompt
                { role: 'user', content: `${userInfo}\n\nEntry:\n${entryContent}\n\n` } // User content
            ];
            const response = await openAIService.createChatCompletion(messages, {
                temperature: 0.7, max_tokens: 500, response_format: { type: "json_object" }
            });
            if (ctx.chat) await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(e => logger.warn("Failed to delete wait msg", e));
            
            const responseContent = response.choices[0].message.content || "{}";
            const defaultSummary = t('journal:defaultAnalysisSummary', {user});
            const defaultQuestions = [
                t('journal:defaultAnalysisQuestion1', {user}), 
                t('journal:defaultAnalysisQuestion2', {user}), 
                t('journal:defaultAnalysisQuestion3', {user})
            ];
            const parsedResponse = openAIService.parseJsonResponse(responseContent, { summary: defaultSummary, questions: defaultQuestions });
            
            const summary = parsedResponse.summary || defaultSummary;
            const questions = parsedResponse.questions || defaultQuestions;
            const sanitizedSummary = sanitizeHtmlForTelegram(summary);
            const sanitizedQuestions = Array.isArray(questions) ? questions.map((q: string) => sanitizeHtmlForTelegram(q)) : defaultQuestions.map(q => sanitizeHtmlForTelegram(q));
            const formattedSummary = formatAsSummaryBullets(sanitizedSummary);
            let insightsText = "";
            if (sanitizedQuestions.length > 0) {
                insightsText = `\n\n🤔 <b>${t('journal:analysisInsightsHeader', {user})}</b>\n\n${sanitizedQuestions.map((q: string, i: number) => `• ${q}`).join('\n\n')}`;
            }
            const fullAnalysis = `${formattedSummary}${insightsText}`;
            const aiAnalysisKeyboard = new InlineKeyboard()
                .text(t('journal:saveButton', {user}), CALLBACKS.SAVE)
                .text(t('journal:moreInsightsButton', {user}), CALLBACKS.ANALYZE)
                .text(t('journal:cancelEntryButton', {user}), CALLBACKS.CANCEL);
            await replyWithHTML(ctx, fullAnalysis, { reply_markup: aiAnalysisKeyboard });
        } catch (error) {
            errorService.logError(
                error instanceof AIError 
                    ? error 
                    : new AIError(
                        'Error generating analysis', 
                        { 
                            entryId: entryId.toString(),
                            userId: user._id?.toString() || '[Unknown User ID]'
                        },
                        error instanceof Error ? error : undefined
                    ),
                {},
                'error'
            );
            
            if (ctx.chat) {
                await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(e => {
                    logger.warn("Failed to delete wait msg after error", e);
                });
            }
            
            await replyWithHTML(ctx, formatUtilErrorMessage('errors:analysisErrorTryAgain', {user}));
        }
    } catch (error) {
        errorService.logError(
            error instanceof AIError 
                ? error 
                : new AIError(
                    'Error in Analyze Journal handler', 
                    { 
                        userId: user._id?.toString() || '',
                        entryId: ctx.session.journalEntryId || ''
                    },
                    error instanceof Error ? error : undefined
                ),
            {},
            'error'
        );
        
        await replyWithHTML(ctx, formatUtilErrorMessage('errors:analysisEngineShy', {user}), { reply_markup: journalActionKeyboard });
    }
}

/**
 * Handles the "New Entry" command or button press.
 */
export async function newEntryHandler(ctx: JournalBotContext, user: IUser) {
    try {
        const entry = await getOrCreateActiveEntry(user._id as Types.ObjectId);
        ctx.session.journalEntryId = entry._id?.toString() || '';

        if (entry.messages.length > 0) {
            const populatedMessages = entry.messages.filter(m => typeof m !== 'string') as IMessage[];
            const messageListHtml = formatMessageList(populatedMessages, user);
            const statusText = await createEntryStatusMessage(entry, user);
            const combinedMessage = `${messageListHtml}\n${statusText}`;
            const sentMsg = await replyWithHTML(ctx, combinedMessage, { reply_markup: journalActionKeyboard });
            ctx.session.lastStatusMessageId = sentMsg.message_id;
        } else {
            const onlyCancelKeyboard = new InlineKeyboard().text(t('common:cancel', {user}), CALLBACKS.CANCEL);
            const sentMsg = await replyWithHTML(ctx, t('journal:shareThoughtsPrompt', {user}), {
                reply_markup: onlyCancelKeyboard
            });
            ctx.session.lastStatusMessageId = sentMsg.message_id;
        }
    } catch (error) {
        errorService.logError(
            error instanceof AIError 
                ? error 
                : new AIError(
                    'Error creating new journal entry', 
                    { userId: user._id?.toString() || '' },
                    error instanceof Error ? error : undefined
                ),
            {},
            'error'
        );
        await replyWithHTML(ctx, formatUtilErrorMessage('errors:newEntryError', {user}));
        await showMainMenu(ctx, user);
    }
}

/**
 * Handles the "Cancel" button press during journaling.
 */
export async function cancelJournalEntryHandler(ctx: JournalBotContext, user: IUser) {
    ctx.session.lastStatusMessageId = undefined;
    if (ctx.session?.journalEntryId) {
        await replyWithHTML(ctx, t('journal:confirmCancelEntry', { user, name: user.name || user.firstName }), { 
            reply_markup: createConfirmCancelKeyboard(user)
        });
        return;
    }
    else {
        logger.info(`Cancel pressed by user ${user.telegramId} but no active journal entry.`);
        if (ctx.session?.waitingForNotificationTime) {
            ctx.session.waitingForNotificationTime = false;
            await replyWithHTML(ctx, t('settings:timeSettingCancelled', { user }));
        }
        if (ctx.session?.waitingForUtcOffset) {
            ctx.session.waitingForUtcOffset = false;
            await replyWithHTML(ctx, t('settings:timezoneSettingCancelled', { user }));
        }
    }
    await showMainMenu(ctx, user);
}

// Helper to download files (extracted common logic)
async function downloadTelegramFile(filePath: string, type: 'voice' | 'video'): Promise<string> {
    const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_API_TOKEN}/${filePath}`;
    const tempDir = path.join(os.tmpdir(), 'journal-bot-downloads');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    const extension = filePath.split('.').pop() || (type === 'voice' ? 'oga' : 'mp4');
    const localFilePath = path.join(tempDir, `${type}_${Date.now()}.${extension}`);
    
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error(`Failed to download file: ${response.statusText} (${response.status})`);
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(localFilePath, Buffer.from(buffer));
    return localFilePath;
}

/**
 * Handles the confirmation for cancelling a journal entry.
 */
export async function handleCancelConfirmation(ctx: JournalBotContext, user: IUser) {
    if (!ctx.callbackQuery?.data) return;
    const callbackData = ctx.callbackQuery.data;
    await ctx.answerCallbackQuery();
    
    if (callbackData === 'confirm_cancel_entry') {
        logger.info(`User ${user.telegramId} confirmed cancellation of journal entry ${ctx.session.journalEntryId}`);
        ctx.session.journalEntryId = undefined;
        ctx.session.lastStatusMessageId = undefined;
        await replyWithHTML(ctx, t('journal:entryDiscarded', { user }));
        await showMainMenu(ctx, user);
    } else if (callbackData === 'keep_writing') {
        logger.info(`User ${user.telegramId} chose to continue journal entry ${ctx.session.journalEntryId}`);
        const entryId = new Types.ObjectId(ctx.session.journalEntryId || '');
        const entry = await getEntryById(entryId);
        if (entry) {
            const populatedMessages = entry.messages.filter(m => typeof m !== 'string') as IMessage[];
            const messageListHtml = formatMessageList(populatedMessages, user);
            const statusText = await createEntryStatusMessage(entry, user);
            const combinedMessage = `${messageListHtml}\n${statusText}`;
            const sentMsg = await replyWithHTML(ctx, combinedMessage, { reply_markup: journalActionKeyboard });
            ctx.session.lastStatusMessageId = sentMsg.message_id;
        } else {
            await replyWithHTML(ctx, t('journal:continueAnywayPrompt', {user, defaultValue: "Great! Let's continue where we left off..."}), 
                { reply_markup: journalActionKeyboard });
        }
    }
}

/**
 * Handles the "Go Deeper" button click to generate deeper analysis and questions.
 */
export async function handleGoDeeper(ctx: JournalBotContext, user: IUser) {
    if (!ctx.session.journalEntryId) {
        await replyWithHTML(ctx, t('journal:goDeeper.noActiveEntry', { user, name: user.name || user.firstName }));
        await showMainMenu(ctx, user);
        return;
    }
    try {
        const entryId = new Types.ObjectId(ctx.session.journalEntryId);
        const entry = await getEntryById(entryId);
        if (!entry) {
            ctx.session.journalEntryId = undefined;
            await replyWithHTML(ctx, t('journal:goDeeper.entryNotFound', { user }));
            await showMainMenu(ctx, user);
            return;
        }
        const waitMsg = await replyWithHTML(ctx, t('common:loadingEmoji', {user, defaultValue: "⏳"}));
        
        const messagesFromEntry = entry.messages as IMessage[];
        const userResponses = messagesFromEntry
            .filter(msg => msg.role === MessageRole.USER)
            .map(msg => msg.type === MessageType.TEXT ? (msg.text || '') : (msg.transcription || ''))
            .filter(text => text.length > 0)
            .join('\n\n');
        const previousQuestions = entry.aiQuestions?.join('\n') || t('journal:goDeeper.noPreviousQuestions', {user});
        const previousSummary = entry.analysis || t('journal:goDeeper.noPreviousAnalysis', {user});
        const userInfo = `User: ${user.name || user.firstName}`;
        const languageInstruction = user.aiLanguage === 'ru' ? 
            t('aiPrompts:deeperAnalysis.languageInstructionRu', {user, defaultValue: "\nPlease respond in Russian. Focus on deeper psychological insights and open-ended questions." }) : 
            t('aiPrompts:deeperAnalysis.languageInstructionEn', {user, defaultValue: "\nPlease respond in English. Focus on deeper psychological insights and open-ended questions." });

        const chatMessages: IChatMessage[] = [
            { role: 'system', content: journalPrompts.deeperAnalysisPrompt + languageInstruction },
            { 
                role: 'user', 
                content: `${userInfo}\n\n${t('journal:goDeeper.entryAndResponsesPrefix', {user})}:\n${userResponses}\n\n${t('journal:goDeeper.previousQuestionsPrefix', {user})}:\n${previousQuestions}\n\n${t('journal:goDeeper.previousAnalysisPrefix', {user})}:\n${previousSummary}\n\n${t('journal:goDeeper.promptInstruction', {user})}` 
            }
        ];
        const response = await openAIService.createChatCompletion(chatMessages, {
            temperature: 0.7, max_tokens: 800, response_format: { type: "json_object" }
        });
        const responseContent = response.choices[0].message.content || '{}';
        const defaultAISummary = t('journal:goDeeper.defaultSummary', {user});
        const defaultAIQuestions = [t('journal:goDeeper.defaultQuestion', {user})];
        const parsedResponse = openAIService.parseJsonResponse(responseContent, { summary: defaultAISummary, questions: defaultAIQuestions });
        const summary = parsedResponse.summary || defaultAISummary;
        const deeperQuestions = parsedResponse.questions || defaultAIQuestions;
        const sanitizedSummary = sanitizeHtmlForTelegram(summary);
        const sanitizedQuestions = deeperQuestions.map((q: string) => sanitizeHtmlForTelegram(q));
        await updateEntryAnalysisAndQuestions( entryId, `${previousSummary}\n\n${t('journal:goDeeper.newSummaryHeader', {user})}: ${sanitizedSummary || ''}`,
            [...(entry.aiQuestions || []), ...sanitizedQuestions] );

        if (ctx.chat) await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(e => logger.warn("Failed to delete wait msg for GoDeeper", e));
        
        let questionsText = '';
        if (sanitizedQuestions.length > 0) {
            questionsText = sanitizedQuestions.map((q, i) => `<i>${i + 1}. ${q}</i>`).join('\n\n');
        }
        const formattedMessage = `<b>${sanitizedSummary}</b>\n\n${t('journal:goDeeper.questionsHeader', {user})}\n\n${questionsText}`;
        await replyWithHTML(ctx, formattedMessage);

    } catch (error) {
        errorService.logError(
            error instanceof AIError 
                ? error 
                : new AIError(
                    'Error in Go Deeper handler', 
                    { 
                        userId: user._id?.toString() || '',
                        entryId: ctx.session.journalEntryId || ''
                    },
                    error instanceof Error ? error : undefined
                ),
            {},
            'error'
        );
        
        await replyWithHTML(ctx, formatUtilErrorMessage('errors:goDeeperError', {user}));
        await showMainMenu(ctx, user);
    }
}
