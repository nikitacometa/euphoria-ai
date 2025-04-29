import { Types } from 'mongoose';
import { Bot, Context, Keyboard } from 'grammy';
import { JournalBotContext } from '../../types/session';
import { IUser, IJournalEntry, IMessage, MessageType, MessageRole, IChatMessage } from '../../types/models';
import { logger } from '../../utils/logger';
import {
    findOrCreateUser, // Need this for hears handlers
} from '../../database';
import { transcribeAudio } from '../../services/ai/openai.service';
import { sendTranscriptionReply, extractFullText } from './utils';
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
import { journalEntryService } from "../../services/journal-entry.service";

/**
 * Handles incoming messages (text, voice, video) during an active journal entry session.
 */
export async function handleJournalEntryInput(ctx: JournalBotContext, user: IUser) {
    if (!ctx.message || !ctx.from || !ctx.session.journalEntryId) return;

    const entryId = new Types.ObjectId(ctx.session.journalEntryId);
    // Re-fetch entry to ensure it's still active and get populated messages if needed
    const entry = await journalEntryService.getEntryById(entryId);

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
            await journalEntryService.addTextMessage(
                user._id as Types.ObjectId,
                entryId,
                ctx.message.message_id,
                ctx.message.text || ''
            );
            messageSaved = true;
            await ctx.react("👍").catch(e => logger.warn("Failed to react", e)); // React optimistically

        } else if ('voice' in ctx.message && ctx.message.voice) {
            await ctx.react("👍").catch(e => logger.warn("Failed to react", e)); // React optimistically
            const fileId = ctx.message.voice.file_id;
            const file = await ctx.api.getFile(fileId);
            const filePath = file.file_path;
            if (!filePath) throw new Error('Voice file path not found');

            const localFilePath = await downloadTelegramFile(filePath, 'voice');
            const waitMsg = await ctx.reply("⏳ Transcribing voice...");
            const transcription = await transcribeAudio(localFilePath);
            if (ctx.chat) await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(e => logger.warn("Failed to delete wait message", e));
            fs.unlinkSync(localFilePath); // Clean up temp file

            await journalEntryService.addVoiceMessage(
                user._id as Types.ObjectId,
                entryId,
                ctx.message.message_id,
                fileId,
                localFilePath, // Path might be invalid now, consider saving only fileId?
                transcription
            );
            messageSaved = true;
            await sendTranscriptionReply(ctx, ctx.message.message_id, transcription);

        } else if (('video_note' in ctx.message && ctx.message.video_note) || ('video' in ctx.message && ctx.message.video)) {
            await ctx.react("👍").catch(e => logger.warn("Failed to react", e));
            // Use optional chaining for video_note
            const fileId = ('video_note' in ctx.message ? ctx.message.video_note?.file_id : ctx.message.video?.file_id) || ''; 
            if (!fileId) throw new Error('Video file ID not found');

            const file = await ctx.api.getFile(fileId);
            const filePath = file.file_path;
            if (!filePath) throw new Error('Video file path not found');

            const localFilePath = await downloadTelegramFile(filePath, 'video');
            const waitMsg = await ctx.reply("⏳ Transcribing video...");
            let transcription = "";
            try {
                transcription = await transcribeAudio(localFilePath);
            } catch (transcriptionError) {
                logger.error('Error transcribing video:', transcriptionError);
                transcription = "[Could not transcribe audio]";
            }
            if (ctx.chat) await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(e => logger.warn("Failed to delete wait message", e));
            fs.unlinkSync(localFilePath); // Clean up temp file

            await journalEntryService.addVideoMessage(
                user._id as Types.ObjectId,
                entryId,
                ctx.message.message_id,
                fileId,
                localFilePath, // Path might be invalid now
                transcription
            );
            messageSaved = true;
            await sendTranscriptionReply(ctx, ctx.message.message_id, transcription);

        } else {
            await ctx.reply(`Darling, I can only process text, voice, or video for journal entries right now. 💫`);
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
        await ctx.reply(`<b>Oops!</b> Something went wrong while adding that to your journal. Please try again.`, { parse_mode: 'HTML' });
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
    const entry = await journalEntryService.getEntryById(entryId); // Fetch entry with populated messages
    
    if (!entry) {
        logger.warn(`Could not find journal entry ${ctx.session.journalEntryId} to finish for user ${user.telegramId}.`);
        ctx.session.journalEntryId = undefined;
        await ctx.reply("Could not find your active journal entry.");
        await showMainMenu(ctx, user);
        return;
    }
    
    const waitMsg = await ctx.reply("⏳ Analyzing your reflection...");
    
    try {
        const entryContent = await extractFullText(entry); // Use utility
        if (!entryContent) {
             logger.warn(`Entry ${entryId} has no content to analyze.`);
             // Complete without AI analysis if empty
             await journalEntryService.completeEntry(
                 entryId, 
                 "Entry was empty.", 
                 "What would you like to write about next time?"
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
            { role: 'user', content: `${userInfo}\n\nEntry:\n${entryContent}\n\nProvide summary & question. Format summary text with short points and html text-formatting only a few important words.` }
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
        
        await journalEntryService.completeEntry(entryId, summary, question);
        if (ctx.chat) await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(e => logger.warn("Failed to delete wait msg", e));
        
        const formattedMessage = `<b>Thanks for sharing! All saved ✅</b>\n\n ${summary}\n\n<b>Random question for later...</b>\n\n<i>${question}</i>`;
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
            await journalEntryService.completeEntry(entryId, "Analysis failed.", "Error during analysis.");
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
        const entry = await journalEntryService.getEntryById(entryId);
        
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
        
        const waitMsg = await ctx.reply("⏳ Generating questions...");
        
        try {
            const questions = await journalEntryService.generateQuestionsForEntry(entryId, user);
            
            if (ctx.chat) {
                await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(e => {
                    logger.warn("Failed to delete wait msg", e);
                });
            }
            
            if (questions && questions.length > 0) {
                const questionsText = questions.map((q: string, i: number) => `<i>- ${q}</i>`).join('\n\n');
                await ctx.reply(`<b>🤔 Share any thoughts in response to:</b>\n\n${questionsText}`, { 
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
        
        // Always show the journal action keyboard after any response
        await ctx.reply(`Keep sharing, or use the buttons below... 💫`, {
            reply_markup: journalActionKeyboard,
            parse_mode: 'HTML'
        });
        
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
        const entry = await journalEntryService.getOrCreateActiveEntry(user._id as Types.ObjectId);
        ctx.session.journalEntryId = entry._id?.toString() || '';
        await ctx.reply(`${entry.messages.length > 0 ? 'Continuing to compose' : 'Composing '} a new entry! Share a few messages with your thoughts (+ voice/video of course) ✍️`, {
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
        const entry = await journalEntryService.getEntryById(entryId);
        
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
        
        // Update the journal entry with the deeper analysis and questions
        await journalEntryService.updateEntryAnalysisAndQuestions(
            entryId,
            `${previousAnalysis}\n\nDeeper Analysis: ${deeperAnalysis}`,
            deeperQuestions
        );
        
        // Delete wait message
        if (ctx.chat) {
            await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);
        }
        
        // Send the deeper analysis and questions in a single message
        let questionsText = '';
        if (deeperQuestions.length > 0) {
            questionsText = deeperQuestions.map((q: string, i: number) => `<i>${i + 1}. ${q}</i>`).join('\n\n');
        }
        
        const formattedMessage = `<b>${deeperAnalysis}</b>\n\n<b>🤔 Let's dig a bit deeper:</b>\n\n${questionsText}`;
        
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
