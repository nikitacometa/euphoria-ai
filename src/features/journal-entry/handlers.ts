import { Types } from 'mongoose';
import { Bot, Context, Keyboard } from 'grammy';
import { JournalBotContext } from '../../types/session';
import { IUser, IJournalEntry, IMessage, MessageType, MessageRole, IChatMessage } from '../../types/models';
import { logger } from '../../utils/logger';
import {
    findOrCreateUser, // Need this for hears handlers
} from '../../database';
import { transcribeAudio } from '../../services/ai/openai.service';
import { sendTranscriptionReply, extractFullText, sanitizeHtmlForTelegram } from './utils';
import { journalActionKeyboard } from './keyboards';
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

// Define a constant for max voice message duration
export const MAX_VOICE_MESSAGE_LENGTH_SECONDS = 300; // 5 minutes

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
    // Send transcription progress indicator
    const progressMsg = await ctx.reply("⏳");
    
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
 * Handles incoming messages (text, voice, video) during an active journal entry session.
 */
export async function handleJournalEntryInput(ctx: JournalBotContext, user: IUser) {
    if (!ctx.message || !ctx.from || !ctx.session.journalEntryId) return;

    const entryId = new Types.ObjectId(ctx.session.journalEntryId);
    // Re-fetch entry to ensure it's still active and get populated messages if needed
    const entry = await getEntryById(entryId);

    if (!entry || entry.status === 'completed') { // Check if entry was somehow completed or deleted
        logger.warn(`Journal entry ${ctx.session.journalEntryId} not found or already completed for user ${user.telegramId}. Clearing session.`);
        ctx.session.journalEntryId = undefined;
        await ctx.reply(`<b>Oops!</b> Looks like that reflection session ended. Let's start fresh! 💫`, {
            parse_mode: 'HTML'
        });
        await showMainMenu(ctx, user); // Use imported showMainMenu
        return;
    }

    let messageSaved = false;
    try {
        if ('text' in ctx.message) {
            await addTextMessage(
                user._id as Types.ObjectId,
                entryId,
                ctx.message.message_id,
                ctx.message.text || ''
            );
            messageSaved = true;
            
            // Just react with thumbs up - no messages
            await ctx.react("👍").catch(e => logger.warn("Failed to react with thumbs up", e));
            
        } else if ('voice' in ctx.message && ctx.message.voice) {
            // React with eyes first to indicate processing
            await ctx.react("👀").catch(e => logger.warn("Failed to react with eyes", e));
            
            const fileId = ctx.message.voice.file_id;
            
            // Check duration - use configuration constant
            if (ctx.message.voice.duration > MAX_VOICE_MESSAGE_LENGTH_SECONDS) {
                await ctx.reply(`Sorry, voice messages cannot be longer than ${MAX_VOICE_MESSAGE_LENGTH_SECONDS} seconds. Please try again with a shorter recording.`, {
                    reply_markup: journalActionKeyboard
                });
                return;
            }
            
            const { transcription, localFilePath } = await processMediaMessage(ctx, fileId, 'voice');
            fs.unlinkSync(localFilePath); // Clean up temp file
            
            await addVoiceMessage(
                user._id as Types.ObjectId,
                entryId,
                ctx.message.message_id,
                fileId,
                localFilePath, // Path might be invalid now, consider saving only fileId?
                transcription
            );
            messageSaved = true;
            
            // Send transcription if user wants it
            await sendTranscriptionReply(ctx, ctx.message.message_id, transcription, user);
            
            // Simply replace the eyes reaction with thumbs up
            await ctx.react("👍").catch(e => logger.warn("Failed to add thumbs up reaction", e));

        } else if (('video_note' in ctx.message && ctx.message.video_note) || ('video' in ctx.message && ctx.message.video)) {
            // React with eyes first to indicate processing
            await ctx.react("👀").catch(e => logger.warn("Failed to react with eyes", e));
            
            // Use optional chaining for video_note
            const fileId = ('video_note' in ctx.message ? ctx.message.video_note?.file_id : ctx.message.video?.file_id) || ''; 
            if (!fileId) throw new Error('Video file ID not found');

            let transcription = "";
            let localFilePath = "";
            
            try {
                const result = await processMediaMessage(ctx, fileId, 'video');
                transcription = result.transcription;
                localFilePath = result.localFilePath;
                fs.unlinkSync(localFilePath); // Clean up temp file
            } catch (transcriptionError) {
                logger.error('Error transcribing video:', transcriptionError);
                transcription = "[Could not transcribe audio]";
            }

            await addVideoMessage(
                user._id as Types.ObjectId,
                entryId,
                ctx.message.message_id,
                fileId,
                localFilePath, // Path might be invalid now
                transcription
            );
            messageSaved = true;
            
            // Send transcription if user wants it
            await sendTranscriptionReply(ctx, ctx.message.message_id, transcription, user);
            
            // Simply replace the eyes reaction with thumbs up
            await ctx.react("👍").catch(e => logger.warn("Failed to add thumbs up reaction", e));

        } else {
            await ctx.reply(`Darling, I can only process text, voice, or video for journal entries right now. 💫`, {
                reply_markup: journalActionKeyboard
            });
        }

    } catch (error) {
        errorService.logError(
            error instanceof AIError 
                ? error 
                : new AIError(
                    'Error processing journal entry input', 
                    { 
                        userId: user._id?.toString(),
                        entryId: entryId.toString(),
                        messageType: ctx.message.voice ? 'voice' : ctx.message.video ? 'video' : 'text'
                    },
                    error instanceof Error ? error : undefined
                ),
            {},
            'error'
        );
        await ctx.reply(`<b>Oops!</b> Something went wrong while adding that to your journal. Please try again.`, { 
            parse_mode: 'HTML',
            reply_markup: journalActionKeyboard
        });
    }
}

/**
 * Handles the action of finishing and analyzing a journal entry.
 */
export async function finishJournalEntryHandler(ctx: JournalBotContext, user: IUser) {
     if (!ctx.session.journalEntryId) {
         logger.warn(`finishJournalEntryHandler called without active session entryId for user ${user.telegramId}`);
         await ctx.reply("No active journal entry found to save.");
         await showMainMenu(ctx, user);
         return;
     }
    
    const entryId = new Types.ObjectId(ctx.session.journalEntryId);
    const entry = await getEntryById(entryId); // Fetch entry with populated messages
    
    if (!entry) {
        logger.warn(`Could not find journal entry ${ctx.session.journalEntryId} to finish for user ${user.telegramId}.`);
        ctx.session.journalEntryId = undefined;
        await ctx.reply("Could not find your active journal entry.");
        await showMainMenu(ctx, user);
        return;
    }
    
    const waitMsg = await ctx.reply("⏳");
    
    try {
        const entryContent = await extractFullText(entry); // Use utility
        if (!entryContent) {
             logger.warn(`Entry ${entryId} has no content to analyze.`);
             // Complete without AI analysis if empty
             await completeEntry(
                 entryId, 
                 "Entry was empty.",
                 "Are you dead inside?"
             );
             if (ctx.chat) await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(e => logger.warn("Failed to delete wait msg", e));
             await ctx.reply("Your journal entry seems to be empty, but I've saved it. ✨");
             ctx.session.journalEntryId = undefined;
             await showMainMenu(ctx, user);
             return;
        }

        const userInfo = `User: ${user.name || user.firstName}`; // Simplified user info

        const chatMessages: IChatMessage[] = [
            { role: 'system', content: journalPrompts.completionSystemPrompt },
            { role: 'user', content: `${userInfo}\n\nEntry:\n${entryContent}\n\nProvide summary & question.` }
        ];
        
        // Call OpenAI API through our centralized service
        const response = await openAIService.createChatCompletion(chatMessages, {
            temperature: 0.7,
            max_tokens: 300,
            response_format: { type: "json_object" }
        });
        
        const content = response.choices[0].message.content || "{}";
        
        // Use our helper to parse JSON safely
        const parsedResponse = openAIService.parseJsonResponse(
            content,
            { summary: "Thank you for sharing.", question: "What stood out to you?" }
        );
        
        const summary = parsedResponse.summary || "Thank you for sharing.";
        const question = parsedResponse.question || "What stood out to you?";
        
        // Sanitize HTML tags - Telegram only supports a limited set of HTML tags
        const sanitizedSummary = sanitizeHtmlForTelegram(summary);
        const sanitizedQuestion = sanitizeHtmlForTelegram(question);
        
        await completeEntry(entryId, sanitizedSummary, sanitizedQuestion);
        if (ctx.chat) await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(e => logger.warn("Failed to delete wait msg", e));
        
        const formattedMessage = `<b>Good job! Now in my memory...</b>\n\n${sanitizedSummary}\n\n<i>🤌 Tonight instead of sleep think about the following random thing:</i>\n\n<code>${sanitizedQuestion}</code>`;
        await ctx.reply(formattedMessage, { parse_mode: 'HTML' });
        
        ctx.session.journalEntryId = undefined;
        await showMainMenu(ctx, user);

    } catch (error) {
        errorService.logError(
            error instanceof AIError 
                ? error 
                : new AIError(
                    'Error finishing journal entry', 
                    { 
                        entryId: entryId.toString(),
                        userId: user._id?.toString() 
                    },
                    error instanceof Error ? error : undefined
                ),
            {},
            'error'
        );
        
        if (ctx.chat) await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(e => logger.warn("Failed to delete wait msg", e));
        await ctx.reply("I encountered an error analyzing your entry. It has been saved, but without detailed analysis.");
        
        // Attempt to complete entry even if AI fails
        try {
            await completeEntry(entryId, "Analysis failed.", "Error during analysis.");
        } catch (dbError) {
             logger.error(`Failed to mark entry ${entryId} as complete after AI error:`, dbError);
        }
        
        ctx.session.journalEntryId = undefined;
        await showMainMenu(ctx, user);
    }
}

/**
 * Handles the "Analyze & Suggest Questions" action.
 */
export async function analyzeAndSuggestQuestionsHandler(ctx: JournalBotContext, user: IUser) {
    if (!ctx.session.journalEntryId) {
        await ctx.reply(`You don't have an active journal entry. Let's create one first!`, { parse_mode: 'HTML' });
        await showMainMenu(ctx, user);
        return;
    }
    
    try {
        const entryId = new Types.ObjectId(ctx.session.journalEntryId);
        const entry = await getEntryById(entryId);
        
        if (!entry) {
            logger.warn(`Entry ${ctx.session.journalEntryId} not found for analysis by user ${user.telegramId}`);
            ctx.session.journalEntryId = undefined;
            await ctx.reply(`<b>Hmm, I can't find that entry.</b> Let's start fresh!`, { parse_mode: 'HTML' });
            await showMainMenu(ctx, user);
            return;
        }

        // Check if entry has any content
        const entryContent = await extractFullText(entry);
        if (!entryContent) {
            await ctx.reply("There's nothing in your entry to analyze yet. Add some thoughts first! ✨", {
                reply_markup: journalActionKeyboard // Always show keyboard
            });
            return; // Keep the entry active
        }
        
        const waitMsg = await ctx.reply("⏳");
        
        try {
            const questions = await generateQuestionsForEntry(entryId, user);
            
            if (ctx.chat) {
                await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(e => {
                    logger.warn("Failed to delete wait msg", e);
                });
            }
            
            if (questions && questions.length > 0) {
                // Sanitize HTML tags for Telegram
                const sanitizedQuestions = questions.map((q: string) => sanitizeHtmlForTelegram(q));
                const questionsText = sanitizedQuestions.map((q: string, i: number) => `<i>- ${q}</i>`).join('\n\n');
                await ctx.reply(`Let me clarify a few things...\n\n${questionsText}`, { 
                    reply_markup: journalActionKeyboard,
                    parse_mode: 'HTML'
                });
            } else {
                await ctx.reply(`<b>Hmm, I couldn't generate specific questions this time.</b> But feel free to continue sharing! ✨`, { 
                    parse_mode: 'HTML'
                });
            }
        } catch (error) {
            errorService.logError(
                error instanceof AIError 
                    ? error 
                    : new AIError(
                        'Error generating questions', 
                        { 
                            entryId: entryId.toString(),
                            userId: user._id?.toString() 
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
            
            await ctx.reply(`<b>Oops!</b> I had trouble thinking of questions. Please try again or continue sharing. ✨`, { 
                parse_mode: 'HTML'
            });
        }
        
        // // Always show the journal action keyboard after any response
        // await ctx.reply(`Keep sharing, or use the buttons below... 💫`, {
        //     reply_markup: journalActionKeyboard,
        //     parse_mode: 'HTML'
        // });
        
    } catch (error) {
        errorService.logError(
            error instanceof AIError 
                ? error 
                : new AIError(
                    'Error in Analyze Journal handler', 
                    { 
                        userId: user._id?.toString(),
                        entryId: ctx.session.journalEntryId
                    },
                    error instanceof Error ? error : undefined
                ),
            {},
            'error'
        );
        
        await ctx.reply(`<b>Oops!</b> My question generator is feeling shy. Let's try again later!`, {
            parse_mode: 'HTML',
            reply_markup: journalActionKeyboard // Always show keyboard even after error
        });
    }
}

/**
 * Handles the "New Entry" command or button press.
 */
export async function newEntryHandler(ctx: JournalBotContext, user: IUser) {
    try {
        const entry = await getOrCreateActiveEntry(user._id as Types.ObjectId);
        ctx.session.journalEntryId = entry._id?.toString() || '';
        await ctx.reply(`<b>${entry.messages.length > 0 ? 'Continuing to write' : 'Writing'} a new entry!</b> Send your text, voice or video messages.\n\n<i>Use buttons to save or to ask me for assistance with digging deeper, right into the abyss...</i>`, {
            reply_markup: journalActionKeyboard,
            parse_mode: 'HTML'
        });
    } catch (error) {
        errorService.logError(
            error instanceof AIError 
                ? error 
                : new AIError(
                    'Error creating new journal entry', 
                    { userId: user._id?.toString() },
                    error instanceof Error ? error : undefined
                ),
            {},
            'error'
        );
        await ctx.reply(`<b>Oops!</b> I had trouble starting a new entry. Please try again.`, { 
            parse_mode: 'HTML'
        });
        await showMainMenu(ctx, user);
    }
}

/**
 * Handles the "Cancel" button press during journaling.
 */
export async function cancelJournalEntryHandler(ctx: JournalBotContext, user: IUser) {
    // This handler is only relevant if called when a journal entry *might* be active
    if (ctx.session?.journalEntryId) {
        // TODO: Maybe confirm cancellation? Or just delete the entry?
        // For now, just clear the session ID like the original code
        logger.info(`Cancelling journal entry ${ctx.session.journalEntryId} for user ${user.telegramId}`);
        ctx.session.journalEntryId = undefined;
        await ctx.reply(`Entry cancelled. We can start fresh anytime ✨`, { parse_mode: 'HTML' });
    }
     // If no active entry, Cancel might be pressed in other contexts (e.g., notification time)
     // This specific handler shouldn't be called then, but as a fallback:
     else {
         logger.info(`Cancel pressed by user ${user.telegramId} but no active journal entry.`);
         // Check if waiting for notification time (logic might move to settings feature)
         if (ctx.session?.waitingForNotificationTime) {
             ctx.session.waitingForNotificationTime = false;
             await ctx.reply(`Notification time setting cancelled. ✨`, { parse_mode: 'HTML' });
         }
     }
    // Always show main menu after cancel
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
 * Handles the "Go Deeper" button click to generate deeper analysis and questions.
 */
export async function handleGoDeeper(ctx: JournalBotContext, user: IUser) {
    if (!ctx.session.journalEntryId) {
        await ctx.reply(`<b>Hey ${user.name || user.firstName}</b>, you don't have an active journal entry. Let's start a new one first!`, {
            parse_mode: 'HTML'
        });
        await showMainMenu(ctx, user);
        return;
    }
    
    try {
        const entryId = new Types.ObjectId(ctx.session.journalEntryId);
        const entry = await getEntryById(entryId);
        
        if (!entry) {
            ctx.session.journalEntryId = undefined;
            await ctx.reply(`<b>Mmm...</b> seems like our connection faded for a moment there 🌙\n\nShall we start a fresh journey of discovery? ✨`, {
                parse_mode: 'HTML'
            });
            await showMainMenu(ctx, user);
            return;
        }
        
        // Send wait message with sand clock emoji
        const waitMsg = await ctx.reply("⏳");
        
        // Get all messages from the entry
        const messages = entry.messages as IMessage[];
        
        // Extract user responses to previous questions
        const userResponses = messages
            .filter(msg => msg.role === MessageRole.USER)
            .map(msg => {
                if (msg.type === MessageType.TEXT) {
                    return msg.text || '';
                } else if (msg.type === MessageType.VOICE || msg.type === MessageType.VIDEO) {
                    return msg.transcription || '';
                }
                return '';
            })
            .filter(text => text.length > 0)
            .join('\n\n');
        
        // Get previous questions and analysis
        const previousQuestions = entry.aiQuestions || '';
        const previousAnalysis = entry.analysis || '';
        
        // Use the chatMessages format from our central type
        const chatMessages: IChatMessage[] = [
            { role: 'system', content: journalPrompts.deeperAnalysisPrompt },
            { 
                role: 'user', 
                content: `User's Journal Entry and Responses:\n${userResponses}\n\nPrevious Questions:\n${previousQuestions}\n\nPrevious Analysis:\n${previousAnalysis}\n\nPlease generate a deeper analysis and more probing questions.` 
            }
        ];
        
        // Call OpenAI API through our centralized service
        const response = await openAIService.createChatCompletion(chatMessages, {
            temperature: 0.7,
            max_tokens: 800,
            response_format: { type: "json_object" }
        });
        
        const responseContent = response.choices[0].message.content || '';
        
        // Use our helper to parse JSON safely
        const parsedResponse = openAIService.parseJsonResponse(
            responseContent,
            { 
                analysis: "Looking deeper at your reflections...",
                questions: ["What else would you like to explore about this experience?"]
            }
        );
        
        const deeperAnalysis = parsedResponse.analysis;
        const deeperQuestions = parsedResponse.questions;
        
        // Sanitize HTML tags for Telegram (reuse the sanitization function defined in finishJournalEntryHandler)
        const sanitizedAnalysis = sanitizeHtmlForTelegram(deeperAnalysis);
        const sanitizedQuestions = deeperQuestions.map(q => sanitizeHtmlForTelegram(q));
        
        // Update the journal entry with the deeper analysis and questions
        await updateEntryAnalysisAndQuestions(
            entryId,
            `${previousAnalysis}\n\nDeeper Analysis: ${sanitizedAnalysis}`,
            sanitizedQuestions
        );
        
        // Delete wait message
        if (ctx.chat) {
            await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);
        }
        
        // Send the deeper analysis and questions in a single message
        let questionsText = '';
        if (sanitizedQuestions.length > 0) {
            questionsText = sanitizedQuestions.map((q: string, i: number) => `<i>${i + 1}. ${q}</i>`).join('\n\n');
        }
        
        const formattedMessage = `<b>${sanitizedAnalysis}</b>\n\n<b>🤔 Let's dig a bit deeper:</b>\n\n${questionsText}`;
        
        await ctx.reply(formattedMessage, {
            parse_mode: 'HTML'
        });
        
    } catch (error) {
        errorService.logError(
            error instanceof AIError 
                ? error 
                : new AIError(
                    'Error in Go Deeper handler', 
                    { 
                        userId: user._id?.toString(),
                        entryId: ctx.session.journalEntryId
                    },
                    error instanceof Error ? error : undefined
                ),
            {},
            'error'
        );
        
        await ctx.reply(`<b>Oh sweetie</b>, seems like my third eye got a bit cloudy there 👁️\n\nLet's take a breath and try again when the energy aligns... 🌟`, {
            parse_mode: 'HTML'
        });
        await showMainMenu(ctx, user);
    }
}
