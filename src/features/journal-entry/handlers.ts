import { Types } from 'mongoose';
import { Bot, Context, Keyboard } from 'grammy';
import { JournalBotContext } from '../../types/session';
import { IUser, IJournalEntry, IMessage, MessageType, MessageRole } from '../../types/models';
import { logger } from '../../utils/logger';
import {
    saveTextMessage,
    saveVoiceMessage,
    saveVideoMessage,
    addMessageToJournalEntry,
    getActiveJournalEntry,
    getJournalEntryById,
    updateJournalEntryFullText,
    completeJournalEntry,
    updateJournalEntryQuestions,
    findOrCreateUser, // Need this for hears handlers
    createJournalEntry // Need this for hears handlers
} from '../../database';
import {
    generateJournalQuestions,
    analyzeJournalEntry // Assuming analyzeJournalEntry is needed for finishJournalEntry logic if moved here
} from '../../services/ai/journal-ai.service';
import { transcribeAudio } from '../../services/ai/openai.service';
import { sendTranscriptionReply, extractFullText } from './utils';
import { journalActionKeyboard } from './keyboards';
// import { showMainMenu } from '../core/handlers'; // Temporarily remove import
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import OpenAI from 'openai'; // Needed for finishJournalEntry AI call
import { TELEGRAM_API_TOKEN, GPT_VERSION } from '../../config'; // Needed for file downloads and AI

// TEMPORARY: Copy showMainMenu here until core module is created
// TODO: Remove this duplication later
async function showMainMenu(ctx: JournalBotContext, user: IUser) {
    const keyboard = new Keyboard()
        .text("📝 New Entry")
        .row()
        .text("📚 Journal History")
        .row()
        .text("🤔 Ask My Journal")
        .row()
        .text("⚙️ Settings")
        .resized();
    
    await ctx.reply(`Welcome back, ${user.name || user.firstName}! Ready to explore your thoughts? ✨`, {
        reply_markup: keyboard,
        parse_mode: 'HTML'
    });
}

// Temporary OpenAI client (consider DI later)
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Temporary ChatMessage interface (consider moving to shared types if used elsewhere)
interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

/**
 * Handles incoming messages (text, voice, video) during an active journal entry session.
 */
export async function handleJournalEntryInput(ctx: JournalBotContext, user: IUser) {
    if (!ctx.message || !ctx.from || !ctx.session.journalEntryId) return;

    // Skip messages that are actually button presses handled by hears()
    if ('text' in ctx.message) {
        const text = ctx.message.text || '';
        if (
            text === "✅ Save" ||
            text === "🔍 Analyze & Suggest Questions" ||
            text === "❌ Cancel" ||
            text === "✅ Finish Reflection" // Assuming this is another save trigger
        ) {
            return; // Let the hears handlers take care of these
        }
    }

    const entryId = new Types.ObjectId(ctx.session.journalEntryId);
    // Re-fetch entry to ensure it's still active and get populated messages if needed
    const entry = await getJournalEntryById(entryId);

    if (!entry || entry.status === 'completed') { // Check if entry was somehow completed or deleted
        logger.warn(`Journal entry ${ctx.session.journalEntryId} not found or already completed for user ${user.telegramId}. Clearing session.`);
        ctx.session.journalEntryId = undefined;
        await ctx.reply(`<b>Oops!</b> Looks like that reflection session ended. Let's start fresh! 💫`, {
            parse_mode: 'HTML'
        });
        await showMainMenu(ctx, user); // Use showMainMenu from core
        return;
    }

    let messageSaved = false;
    try {
        if ('text' in ctx.message) {
            const message = await saveTextMessage(
                user._id as Types.ObjectId, // Cast user._id
                entryId,
                ctx.message.message_id,
                ctx.message.text || '',
                MessageRole.USER
            );
            await addMessageToJournalEntry(entryId, message._id as Types.ObjectId); // Cast message._id
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

            const message = await saveVoiceMessage(
                user._id as Types.ObjectId,
                entryId,
                ctx.message.message_id,
                fileId,
                localFilePath, // Path might be invalid now, consider saving only fileId?
                transcription,
                MessageRole.USER
            );
            await addMessageToJournalEntry(entryId, message._id as Types.ObjectId);
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

             const message = await saveVideoMessage(
                user._id as Types.ObjectId,
                entryId,
                ctx.message.message_id,
                fileId,
                localFilePath, // Path might be invalid now
                transcription,
                MessageRole.USER
            );
             await addMessageToJournalEntry(entryId, message._id as Types.ObjectId);
             messageSaved = true;
             await sendTranscriptionReply(ctx, ctx.message.message_id, transcription);

        } else {
            await ctx.reply(`Darling, I can only process text, voice, or video for journal entries right now. 💫`);
        }

        // Update full text only if a new message was actually saved
        if (messageSaved) {
             // Refetch entry to get all messages including the new one
             const updatedEntry = await getJournalEntryById(entryId);
             if (updatedEntry) {
                 const fullText = await extractFullText(updatedEntry);
                 await updateJournalEntryFullText(entryId, fullText);
             }
        }

    } catch (error) {
        logger.error(`Error processing journal entry input for user ${user.telegramId}:`, error);
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
    const entry = await getJournalEntryById(entryId); // Fetch entry with populated messages
    
    if (!entry) {
        logger.warn(`Could not find journal entry ${ctx.session.journalEntryId} to finish for user ${user.telegramId}.`);
        ctx.session.journalEntryId = undefined;
        await ctx.reply("Could not find your active journal entry.");
        await showMainMenu(ctx, user);
        return;
    }
    
    const waitMsg = await ctx.reply("⏳ Analyzing your reflection...");
    
    try {
        const systemPrompt = `You are Infinity, an insightful and supportive guide...
Format as JSON:
{
  "summary": "Your insightful summary",
  "question": "Your thought-provoking question?"
}`; // Keep prompt concise for brevity

        const entryContent = await extractFullText(entry); // Use utility
        if (!entryContent) {
             logger.warn(`Entry ${entryId} has no content to analyze.`);
             // Complete without AI analysis if empty
             await completeJournalEntry(entryId, "Entry was empty.", "What would you like to write about next time?");
             if (ctx.chat) await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(e => logger.warn("Failed to delete wait msg", e));
             await ctx.reply("Your journal entry seems to be empty, but I've saved it. ✨");
             ctx.session.journalEntryId = undefined;
             await showMainMenu(ctx, user);
             return;
        }

        const userInfo = `User: ${user.name || user.firstName}`; // Simplified user info

        const chatMessages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `${userInfo}\n\nEntry:\n${entryContent}\n\nProvide summary & question.` }
        ];
        
        const response = await openai.chat.completions.create({
            model: GPT_VERSION,
            messages: chatMessages,
            temperature: 0.7,
            max_tokens: 300,
            response_format: { type: "json_object" }
        });
        
        const content = response.choices[0].message.content || "{}";
        let parsedResponse = { summary: "Thank you for sharing.", question: "What stood out to you?" }; // Default
        try {
            parsedResponse = JSON.parse(content);
        } catch (error) {
            logger.error('Error parsing analysis JSON response:', error);
        }
        
        const summary = parsedResponse.summary || "Thank you for sharing.";
        const question = parsedResponse.question || "What stood out to you?";
        
        await completeJournalEntry(entryId, summary, question);
        if (ctx.chat) await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(e => logger.warn("Failed to delete wait msg", e));
        
        const formattedMessage = `<b>Reflection complete! 💫</b>\n\n<b>Summary:</b> ${summary}\n\n<b>A question for later:</b>\n<i>${question}</i>`;
        await ctx.reply(formattedMessage, { parse_mode: 'HTML' });
        
        ctx.session.journalEntryId = undefined;
        await showMainMenu(ctx, user);

    } catch (error) {
        logger.error(`Error finishing journal entry ${entryId} for user ${user.telegramId}:`, error);
        if (ctx.chat) await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(e => logger.warn("Failed to delete wait msg", e));
        await ctx.reply("I encountered an error analyzing your entry. It has been saved, but without detailed analysis.");
        
        // Attempt to complete entry even if AI fails
        try {
            await completeJournalEntry(entryId, "Analysis failed.", "Error during analysis.");
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
        const entry = await getJournalEntryById(entryId);
        
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
            await ctx.reply("There's nothing in your entry to analyze yet. Add some thoughts first! ✨");
            return; // Keep the entry active
        }
        
        const waitMsg = await ctx.reply("⏳ Generating questions...");
        const questions = await generateJournalQuestions(entry, user);
        await updateJournalEntryQuestions(entryId, questions);
        if (ctx.chat) await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(e => logger.warn("Failed to delete wait msg", e));
        
        if (questions.length > 0) {
            const questionsText = questions.map((q: string, i: number) => `<i>${i + 1}. ${q}</i>`).join('\n\n');
            await ctx.reply(`<b>🤔 Here are some questions to ponder:</b>\n\n${questionsText}`, { parse_mode: 'HTML' });
        }
        
        // Keep the entry active - remind user of options
        await ctx.reply(`Keep sharing, or use the buttons below... 💫`, {
            reply_markup: journalActionKeyboard, // Use the defined keyboard
            parse_mode: 'HTML'
        });
        
    } catch (error) {
        logger.error(`Error in Analyze Journal handler for user ${user.telegramId}:`, error);
        await ctx.reply(`<b>Oops!</b> My question generator is feeling shy. Let's try again later!`, { parse_mode: 'HTML' });
        // Don't necessarily go to main menu, let user continue or press cancel
    }
}

/**
 * Handles the "New Entry" command or button press.
 */
export async function newEntryHandler(ctx: JournalBotContext, user: IUser) {
     // Check if there's an active entry
    const activeEntry = await getActiveJournalEntry(user._id as Types.ObjectId);
    
    if (activeEntry) {
        ctx.session.journalEntryId = activeEntry._id?.toString() || '';
        await ctx.reply(`You have an unfinished entry. Continue writing or use the buttons below. ✨`, {
            reply_markup: journalActionKeyboard,
            parse_mode: 'HTML'
        });
    } else {
        const entry = await createJournalEntry(user._id as Types.ObjectId);
        ctx.session.journalEntryId = entry._id?.toString() || '';
        await ctx.reply(`New reflection started! Share your thoughts (text, voice, video). ✨`, {
            reply_markup: journalActionKeyboard,
            parse_mode: 'HTML'
        });
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
