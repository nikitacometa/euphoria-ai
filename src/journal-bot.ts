import { Bot, Context, InlineKeyboard, Keyboard, session, SessionFlavor } from 'grammy';
import { TELEGRAM_API_TOKEN, LOG_LEVEL, GPT_VERSION } from './config';
import { 
    connectToDatabase, 
    findOrCreateUser,
    updateUserProfile,
    completeUserOnboarding,
    saveTextMessage, 
    saveVoiceMessage,
    saveVideoMessage,
    createJournalEntry,
    getActiveJournalEntry,
    addMessageToJournalEntry,
    updateJournalEntryStatus,
    updateJournalEntryAnalysis,
    updateJournalEntryQuestions,
    updateJournalEntryInsights,
    completeJournalEntry,
    getUserJournalEntries,
    getJournalEntryById,
    updateJournalEntryFullText
} from './database';
import { Types } from 'mongoose';
import { logger, createLogger } from './utils/logger';
import { withCommandLogging } from './utils/command-logger';
import { 
    analyzeJournalEntry, 
    generateJournalQuestions, 
    generateJournalInsights 
} from './services/ai/journal-ai.service';
import { transcribeAudio } from './services/ai/openai.service';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import OpenAI from 'openai';
import { notificationService } from './services/notification.service';

// Import shared types
import {
    IUser, 
    IMessage, 
    IJournalEntry, 
    JournalEntryStatus, 
    MessageType, 
    MessageRole
} from './types/models';
import { JournalBotSession, JournalBotContext } from './types/session';
import { startOnboarding } from './features/onboarding/handlers';
import { registerOnboardingHandlers } from './features/onboarding';
import { registerJournalEntryHandlers } from './features/journal-entry';

// Import the specific handlers/utils needed by remaining functions in this file
import { 
    finishJournalEntryHandler, 
    analyzeAndSuggestQuestionsHandler 
} from './features/journal-entry/handlers';
import { sendTranscriptionReply } from './features/journal-entry/utils';

// Create OpenAI instance
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Define ChatMessage interface
interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

// Create a logger for the journal bot
const journalBotLogger = createLogger('JournalBot', LOG_LEVEL);

// Create bot instance
const bot = new Bot<JournalBotContext>(TELEGRAM_API_TOKEN);

// Set up session middleware
bot.use(session({
    initial: (): JournalBotSession => ({})
}));

// Connect to MongoDB
connectToDatabase().catch(error => journalBotLogger.error('Failed to connect to MongoDB:', error));

// === FEATURE REGISTRATION ===
registerOnboardingHandlers(bot);
registerJournalEntryHandlers(bot);
// ============================

// Start command handler
const handleStartCommand = withCommandLogging('start', async (ctx: JournalBotContext) => {
    if (!ctx.from) return;

    const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
    
    if (user.onboardingCompleted) {
        await showMainMenu(ctx, user);
    } else {
        await startOnboarding(ctx);
    }
});

// Register the start command
bot.command('start', handleStartCommand);

// Keep handlers for features not yet extracted
bot.hears("📚 Journal History", async (ctx: JournalBotContext) => {
    if (!ctx.from) return;
    
    const user = await findOrCreateUser(
        ctx.from.id,
        ctx.from.first_name,
        ctx.from.last_name,
        ctx.from.username
    );
    
    // Get user's journal entries
    const entries = await getUserJournalEntries(user._id as unknown as Types.ObjectId);
    
    if (entries.length === 0) {
        await ctx.reply(`<b>${user.name || user.firstName}</b>, you haven't created any entries yet. Ready to start? ✨`, {
            parse_mode: 'HTML'
        });
        await showMainMenu(ctx, user);
        return;
    }
    
    // Create inline keyboard with entries
    const keyboard = new InlineKeyboard();
    
    entries.slice(0, 10).forEach((entry) => {
        const date = new Date(entry.createdAt);
        const formattedDate = `[${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear().toString().slice(-2)} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}]`;
        
        // Get text snippet from entry
        let textSnippet = "";
        if (entry.fullText) {
            textSnippet = entry.fullText.substring(0, 15) + (entry.fullText.length > 15 ? "..." : "");
        } else {
            const messages = entry.messages as IMessage[];
            const firstTextMessage = messages.find(msg => msg.type === MessageType.TEXT && msg.text);
            if (firstTextMessage && firstTextMessage.text) {
                textSnippet = firstTextMessage.text.substring(0, 15) + (firstTextMessage.text.length > 15 ? "..." : "");
            } else {
                textSnippet = "Entry";
            }
        }
        
        keyboard.text(`${formattedDate} ${textSnippet}`, `view_entry:${entry._id}`).row();
    });
    
    keyboard.text("Back to Main Menu", "main_menu");
    
    await ctx.reply(`<b>${user.name || user.firstName}</b>, here are your past reflections 📚`, {
        reply_markup: keyboard,
        parse_mode: 'HTML'
    });
});

bot.hears("🤔 Ask My Journal", async (ctx: JournalBotContext) => {
    if (!ctx.from) return;
    
    const user = await findOrCreateUser(
        ctx.from.id,
        ctx.from.first_name,
        ctx.from.last_name,
        ctx.from.username
    );
    
    // Get user's journal entries
    const entries = await getUserJournalEntries(user._id as unknown as Types.ObjectId);
    
    if (entries.length === 0) {
        await ctx.reply(`<b>${user.name || user.firstName}</b>, let's create some entries first before we analyze them ✨`, {
            parse_mode: 'HTML'
        });
        await showMainMenu(ctx, user);
        return;
    }
    
    // Enter journal chat mode
    ctx.session.journalChatMode = true;
    ctx.session.waitingForJournalQuestion = true;
    
    const keyboard = new Keyboard()
        .text("❌ Exit Chat Mode")
        .resized();
    
    await ctx.reply(`<b>${user.name || user.firstName}</b>, what would you like to know about your journey? 🌟\n\nAsk about:\n<i>• Patterns in your entries\n• Personal growth\n• Hidden insights</i>`, {
        reply_markup: keyboard,
        parse_mode: 'HTML'
    });
});

// Settings handler
bot.hears("⚙️ Settings", async (ctx: JournalBotContext) => {
    if (!ctx.from) return;
    
    const user = await findOrCreateUser(
        ctx.from.id,
        ctx.from.first_name,
        ctx.from.last_name,
        ctx.from.username
    );
    
    const keyboard = new InlineKeyboard()
        .text(user.notificationsEnabled ? "🔔 Disable Notifications" : "🔔 Enable Notifications", "toggle_notifications")
        .row()
        .text("⏰ Set Notification Time", "set_notification_time")
        .row()
        .text("↩️ Back to Main Menu", "main_menu");
    
    const status = user.notificationsEnabled ? "enabled" : "disabled";
    const time = user.notificationTime || "not set";
    
    await ctx.reply(
        `<b>Settings</b> ⚙️\n\n` +
        `Notifications: ${status}\n` +
        `Time: ${time}\n\n` +
        `What would you like to change?`,
        {
            reply_markup: keyboard,
            parse_mode: 'HTML'
        }
    );
});

// Keep Exit Chat Mode until Chat feature is extracted
bot.hears("❌ Exit Chat Mode", async (ctx: JournalBotContext) => {
    if (!ctx.from) return;
    
    const user = await findOrCreateUser(
        ctx.from.id,
        ctx.from.first_name,
        ctx.from.last_name,
        ctx.from.username
    );
    
    ctx.session.journalChatMode = false;
    ctx.session.waitingForJournalQuestion = false;
    await ctx.reply(`Returning to main menu, ${user.name || user.firstName}. Feel free to ask more questions anytime ✨`, {
        parse_mode: 'HTML'
    });
    await showMainMenu(ctx, user);
});

// Helper function to safely get user ID as string
function getUserIdString(user: IUser | Types.ObjectId): string {
    if (user instanceof Types.ObjectId) {
        return user.toString();
    } else if (user && user._id) {
        // Check if it's a populated IUser object
        return user._id.toString();
    } else {
        // Handle unexpected cases or throw an error
        logger.error("Could not determine user ID string from:", user);
        throw new Error("Invalid user object provided"); 
    }
}

// Handle callback queries for viewing entries
bot.on('callback_query:data', async (ctx: JournalBotContext) => {
    // Ensure ctx.from and ctx.callbackQuery exist
    if (!ctx.from || !ctx.callbackQuery || !ctx.callbackQuery.data) {
        logger.warn('Callback query received without from or data');
        // Attempt to answer anyway if possible, otherwise log and return
        if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: "Error processing request" }).catch(e => logger.error("Failed to answer empty callback query", e));
        return; 
    }

    const user = await findOrCreateUser(
        ctx.from.id,
        ctx.from.first_name,
        ctx.from.last_name,
        ctx.from.username
    );
    
    // Guaranteed to exist because of the check above
    const data: string = ctx.callbackQuery.data; 

    if (data.startsWith('view_entry:')) {
        const entryIdStr = data.split(':')[1];
        if (!entryIdStr) {
            await ctx.answerCallbackQuery({ text: "Error: Invalid entry ID" });
            return;
        }

        try {
            const entryId = new Types.ObjectId(entryIdStr);
            const entry = await getJournalEntryById(entryId);
            if (!entry) {
                await ctx.answerCallbackQuery({ text: "Error: Entry not found" });
                return;
            }

            // Make sure entry belongs to the user using helper function
            const entryUserId = getUserIdString(entry.user);
            const currentUserId = getUserIdString(user); // Use user object directly

            if (entryUserId !== currentUserId) {
                await ctx.answerCallbackQuery({ text: "Error: Access denied" });
                logger.warn(`User ${user.telegramId} tried to access entry ${entryIdStr} belonging to ${entryUserId}`);
                return;
            }

            await ctx.answerCallbackQuery();
            
            const date = new Date(entry.createdAt);
            const formattedDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;

            let entryText = "";
            if (entry.fullText) {
                entryText = entry.fullText;
            } else {
                entryText = (entry.messages as IMessage[]) // Assume messages are populated
                    .map(msg => msg.text || msg.transcription || `[${msg.type}]`)
                    .join('\n---\n');
            }

            // Truncate if too long for a single message
            const maxLength = 4000; 
            if (entryText.length > maxLength) {
                entryText = entryText.substring(0, maxLength) + "... [truncated]";
            }

            const keyboard = new InlineKeyboard()
                .text("📚 Back to History", "journal_history")
                .row()
                .text("↩️ Back to Main Menu", "main_menu");

            await ctx.editMessageText(
                `<b>Reflection from ${formattedDate}</b> 📚\n\n${entryText}\n\n${entry.analysis ? `\n<b>Analysis:</b>\n${entry.analysis}` : ''}${entry.aiInsights ? `\n<b>Insights:</b>\n${entry.aiInsights}` : ''}`,
                {
                    reply_markup: keyboard,
                    parse_mode: 'HTML'
                }
            );
        } catch (error: any) {
            logger.error(`Error fetching/displaying entry ${entryIdStr}:`, error);
             // Check if it's a CastError (invalid ObjectId format)
            if (error.name === 'CastError' && error.kind === 'ObjectId') {
                 await ctx.answerCallbackQuery({ text: "Error: Invalid entry format." });
            } else {
                await ctx.answerCallbackQuery({ text: "Error displaying entry." });
            }
        }
    } else if (data === 'journal_history') {
        // TODO: Extract this logic into a reusable function
        await ctx.answerCallbackQuery();
        const currentUserId = getUserIdString(user);
        const entries = await getUserJournalEntries(new Types.ObjectId(currentUserId));
        if (entries.length === 0) {
            await ctx.editMessageText(`<b>${user.name || user.firstName}</b>, you haven't created any entries yet. Ready to start? ✨`, {
                parse_mode: 'HTML',
                reply_markup: new InlineKeyboard().text("↩️ Back to Main Menu", "main_menu")
            });
            return;
        }
        const historyKeyboard = new InlineKeyboard();
        entries.slice(0, 10).forEach((entry) => {
            const date = new Date(entry.createdAt);
            const formattedDate = `[${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear().toString().slice(-2)} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}]`;
            let textSnippet = "";
             if (entry.fullText) {
                textSnippet = entry.fullText.substring(0, 15) + (entry.fullText.length > 15 ? "..." : "");
            } else if (Array.isArray(entry.messages)) {
                 // Check if messages is an array before trying to find
                const messages = entry.messages as IMessage[]; // Assuming messages are populated
                const firstTextMessage = messages.find(msg => msg.type === MessageType.TEXT && msg.text);
                if (firstTextMessage && firstTextMessage.text) {
                    textSnippet = firstTextMessage.text.substring(0, 15) + (firstTextMessage.text.length > 15 ? "..." : "");
                } else {
                    textSnippet = "Entry";
                }
            } else {
                textSnippet = "Entry"; // Fallback if messages aren't populated or not an array
            }
            historyKeyboard.text(`${formattedDate} ${textSnippet}`, `view_entry:${entry._id}`).row();
        });
        historyKeyboard.text("↩️ Back to Main Menu", "main_menu");
        await ctx.editMessageText(`<b>${user.name || user.firstName}</b>, here are your past reflections 📚`, {
            reply_markup: historyKeyboard,
            parse_mode: 'HTML'
        });

    } else if (data === 'toggle_notifications') {
        await ctx.answerCallbackQuery();
        user.notificationsEnabled = !user.notificationsEnabled;
        await user.save();
        const status = user.notificationsEnabled ? "enabled" : "disabled";
        const time = user.notificationTime || "not set";
        const keyboard = new InlineKeyboard()
            .text(user.notificationsEnabled ? "🔔 Disable Notifications" : "🔔 Enable Notifications", "toggle_notifications")
            .row()
            .text("⏰ Set Notification Time", "set_notification_time")
            .row()
            .text("↩️ Back to Main Menu", "main_menu");
        await ctx.editMessageText(
            `<b>Settings</b> ⚙️\n\n` +
            `Notifications: ${status}\n` +
            `Time: ${time}\n\n` +
            `What would you like to change?`,
            {
                reply_markup: keyboard,
                parse_mode: 'HTML'
            }
        );
    } else if (data === 'set_notification_time') {
        await ctx.answerCallbackQuery();
        ctx.session.waitingForNotificationTime = true;
        const cancelKeyboard = new Keyboard().text("❌ Cancel").resized().oneTime();
        await ctx.reply(`Please enter your preferred notification time in HH:mm format (24-hour clock, e.g., 21:00 for 9 PM) ✨`, {
            reply_markup: cancelKeyboard
        });
        try {
            await ctx.deleteMessage(); 
        } catch (e) {
            logger.warn("Could not delete settings message after prompt, maybe already deleted?");
        }

    } else if (data === 'main_menu') {
        await ctx.answerCallbackQuery();
        try {
             await ctx.deleteMessage();
        } catch (e) {
            logger.warn("Could not delete message before showing main menu, maybe already deleted?");
        }
        await showMainMenu(ctx, user);
    } else {
        await ctx.answerCallbackQuery({text: "Action not recognized"}); // Acknowledge other callbacks 
        logger.info(`Unhandled callback_query data: ${data}`);
    }
});

// Register button handlers
bot.callbackQuery("analyze_journal", async (ctx: JournalBotContext) => {
    await ctx.answerCallbackQuery();
    // This callback seems redundant if the button is handled by hears()?
    // But keeping the call for now, assuming it might be triggered differently.
    if (!ctx.from) return;
    const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
    await analyzeAndSuggestQuestionsHandler(ctx, user); // Use imported handler
});

bot.callbackQuery("go_deeper", async (ctx: JournalBotContext) => {
    await ctx.answerCallbackQuery();
    await handleGoDeeper(ctx); // Use local handleGoDeeper for now
});

bot.callbackQuery("finish_journal", async (ctx: JournalBotContext) => {
    await ctx.answerCallbackQuery();
    if (!ctx.from) return;
    const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
    await finishJournalEntryHandler(ctx, user); // Use imported handler
});

// Handle remaining messages (AFTER feature-specific handlers)
// Onboarding and Journal Entry inputs are now handled by their respective middlewares
bot.on('message', async (ctx: JournalBotContext) => {
    if (!ctx.from || !ctx.message) return;
    
    const user = await findOrCreateUser(
        ctx.from.id,
        ctx.from.first_name,
        ctx.from.last_name,
        ctx.from.username
    );
    
    // If user is in journal chat mode (to be moved later)
    if (ctx.session?.journalChatMode) {
        await handleJournalChat(ctx, user); // Uses local handleJournalChat
        return;
    }
    
    // Handle notification time input (to be moved later)
    if (ctx.session?.waitingForNotificationTime && 'text' in ctx.message) {
        const time = ctx.message.text;
        if (time && /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
            // TODO: Move notificationService call to settings feature
            await notificationService.updateUserNotificationSettings(
                user.telegramId,
                user.notificationsEnabled ?? true, // Assume true if unset?
                time
            );
            // Also update user model directly for immediate feedback
            await updateUserProfile(user.telegramId, { notificationTime: time });
            
            ctx.session.waitingForNotificationTime = false;
            await ctx.reply(`Great! I'll send you notifications at ${time} 🌟`);
            await showMainMenu(ctx, user);
            return;
        } else {
            await ctx.reply(
                "Please enter a valid time in 24-hour format (HH:mm)\n" +
                "For example: 09:00 or 21:00"
            );
            // Keep waitingForNotificationTime = true
            return; 
        }
    }
    
    // Skip text messages handled by specific hears() handlers for REMAINING features
    if ('text' in ctx.message) {
        const text = ctx.message.text || '';
        if (
            // Keep checks for hears handlers still in this file
            text === "📚 Journal History" ||
            text === "🤔 Ask My Journal" ||
            text === "⚙️ Settings" ||
            text === "❌ Exit Chat Mode"
        ) {
            return; // Let bot.hears handle these
        }
    }
    
    // Default: show main menu for unhandled messages if not handled by any feature
    logger.debug(`Unhandled message type received for user ${user.telegramId}, showing main menu.`);
    await showMainMenu(ctx, user);
});

// Show main menu with shorter, more elegant messages
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

// Handle journal chat
async function handleJournalChat(ctx: JournalBotContext, user: IUser) {
    if (!ctx.message || !ctx.from) return;
    
    // Handle exit chat mode - skip as it's handled by specific hears() handler
    if ('text' in ctx.message && ctx.message.text === "❌ Exit Chat Mode") {
        return;
    }
    
    // Get all user's journal entries
    const allEntries = await getUserJournalEntries(user._id as unknown as Types.ObjectId);
    
    if (allEntries.length === 0) {
        await ctx.reply(`<b>${user.name || user.firstName}</b>, we need some juicy thoughts to analyze first! 💭\n\nLet's create some entries together, and then we can have our deep conversations... 😏`, {
            parse_mode: 'HTML'
        });
        ctx.session.journalChatMode = false;
        await showMainMenu(ctx, user);
        return;
    }
    
    // Handle text message question
    if ('text' in ctx.message && ctx.session.waitingForJournalQuestion) {
        const question = ctx.message.text || '';
        
        // Send wait message with sand clock emoji
        const waitMsg = await ctx.reply("⏳");
        
        // Generate insights based on question using all entries
        const insights = await generateJournalInsights(allEntries, user, question);
        
        // Delete wait message
        if (ctx.chat) {
            await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);
        }
        
        // Send insights to user
        await ctx.reply(`<b>${insights}</b>`, {
            parse_mode: 'HTML'
        });
        
        // Prompt for another question
        await ctx.reply(`<b>Mmm... your mind is fascinating, ${user.name || user.firstName}!</b> 💫\n\nWhat else shall we explore together? I'm all ears and full of insights... 😏`, {
            parse_mode: 'HTML'
        });
    } 
    // Handle voice message
    else if ('voice' in ctx.message && ctx.message.voice && ctx.session.waitingForJournalQuestion) {
        try {
            await ctx.react("👍");
            
            // Download voice message
            const fileId = ctx.message.voice.file_id;
            const file = await ctx.api.getFile(fileId);
            const filePath = file.file_path;
            
            if (!filePath) {
                throw new Error('File path not found');
            }
            
            const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_API_TOKEN}/${filePath}`;
            const tempDir = path.join(os.tmpdir(), 'journal-bot');
            
            // Create temp directory if it doesn't exist
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            
            const localFilePath = path.join(tempDir, `voice_${Date.now()}.oga`);
            
            // Download file
            const response = await fetch(fileUrl);
            const buffer = await response.arrayBuffer();
            fs.writeFileSync(localFilePath, Buffer.from(buffer));
            
            // Send wait message with sand clock emoji
            const waitMsg = await ctx.reply("⏳");
            
            // Transcribe audio
            const transcription = await transcribeAudio(localFilePath);
            
            // Send transcription to user
            await sendTranscriptionReply(ctx, ctx.message.message_id, transcription);
            
            // Generate insights based on transcribed question using all entries
            const insights = await generateJournalInsights(allEntries, user, transcription);
            
            // Delete wait message
            if (ctx.chat) {
                await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);
            }
            
            // Send insights to user
            await ctx.reply(`<b>${insights}</b>`, {
                parse_mode: 'HTML'
            });
            
            // Prompt for another question
            await ctx.reply(`<b>Any other questions about your journaling journey, ${user.name || user.firstName}?</b>`, {
                parse_mode: 'HTML'
            });
            
            // Clean up
            fs.unlinkSync(localFilePath);
        } catch (error) {
            journalBotLogger.error('Error processing voice message in chat mode:', error);
            await ctx.reply(`<b>Oops! ${user.name || user.firstName}</b>, seems like my ears got a bit tangled there 🙈\n\nCan you try again or maybe whisper your thoughts in text? 💭`, {
                parse_mode: 'HTML'
            });
        }
    }
    // Handle video message
    else if (('video_note' in ctx.message && ctx.message.video_note) || ('video' in ctx.message && ctx.message.video) && ctx.session.waitingForJournalQuestion) {
        try {
            await ctx.react("👍");
            
            // Get file details
            const fileId = 'video_note' in ctx.message && ctx.message.video_note 
                ? ctx.message.video_note.file_id 
                : (ctx.message.video ? ctx.message.video.file_id : '');
                
            if (!fileId) {
                throw new Error('File ID not found');
            }
            
            const file = await ctx.api.getFile(fileId);
            const filePath = file.file_path;
            
            if (!filePath) {
                throw new Error('File path not found');
            }
            
            const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_API_TOKEN}/${filePath}`;
            const tempDir = path.join(os.tmpdir(), 'journal-bot');
            
            // Create temp directory if it doesn't exist
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            
            const localFilePath = path.join(tempDir, `video_${Date.now()}.mp4`);
            
            // Download file
            const response = await fetch(fileUrl);
            const buffer = await response.arrayBuffer();
            fs.writeFileSync(localFilePath, Buffer.from(buffer));
            
            // Send wait message with sand clock emoji
            const waitMsg = await ctx.reply("⏳");
            
            // Extract audio and transcribe it
            let transcription;
            try {
                transcription = await transcribeAudio(localFilePath);
            } catch (transcriptionError) {
                journalBotLogger.error('Error transcribing video:', transcriptionError);
                transcription = "Could not transcribe audio from video. The video might not have clear audio.";
            }
            
            // Send transcription to user
            await sendTranscriptionReply(ctx, ctx.message.message_id, transcription);
            
            // Generate insights based on transcribed question using all entries
            const insights = await generateJournalInsights(allEntries, user, transcription);
            
            // Delete wait message
            if (ctx.chat) {
                await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);
            }
            
            // Send insights to user
            await ctx.reply(`<b>${insights}</b>`, {
                parse_mode: 'HTML'
            });
            
            // Prompt for another question
            await ctx.reply(`<b>Got any more questions for me, ${user.name || user.firstName}?</b> I'm loving our chat!`, {
                parse_mode: 'HTML'
            });
            
            // Clean up
            fs.unlinkSync(localFilePath);
        } catch (error) {
            journalBotLogger.error('Error processing video message in chat mode:', error);
            await ctx.reply(`<b>Oops!</b> I had trouble with your video, ${user.name || user.firstName}. Mind trying again or sending a text message?`, {
                parse_mode: 'HTML'
            });
        }
    } else {
        await ctx.reply(`<b>${user.name || user.firstName}</b>, I'm here to explore the depths of your consciousness! 🌟\n\nShare your curiosities through text, voice, or video... or type '❌ Exit Chat Mode' if you need a breather 💫`, {
            parse_mode: 'HTML'
        });
    }
}

// Handle "Go Deeper" button
async function handleGoDeeper(ctx: JournalBotContext) {
    const user = await findOrCreateUser(ctx.from?.id || 0, ctx.from?.username || '', ctx.from?.first_name || '');
    
    if (!ctx.session.journalEntryId) {
        await ctx.reply(`<b>Hey ${user.name || user.firstName}</b>, you don't have an active journal entry. Let's start a new one first!`, {
            parse_mode: 'HTML'
        });
        await showMainMenu(ctx, user);
        return;
    }
    
    try {
        const entryId = new Types.ObjectId(ctx.session.journalEntryId);
        const entry = await getJournalEntryById(entryId);
        
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
        
        // Generate deeper analysis
        const deeperAnalysisPrompt = `You are Infinity, an insightful and supportive guide.
Your personality:
- Warm and empathetic
- Clear and perceptive
- Professional with a gentle touch
- Focused on personal growth
- Uses minimal emojis (✨ 🌟 💫)

Based on the user's responses and previous analysis, provide:
1. A brief analysis identifying key patterns or insights
2. Two questions for deeper reflection

Format as JSON:
{
  "analysis": "Your insightful analysis",
  "questions": [
    "First question about personal growth?",
    "Second question about deeper insights?"
  ]
}`;

        const chatMessages: ChatMessage[] = [
            { role: 'system', content: deeperAnalysisPrompt },
            { 
                role: 'user', 
                content: `User's Journal Entry and Responses:\n${userResponses}\n\nPrevious Questions:\n${previousQuestions}\n\nPrevious Analysis:\n${previousAnalysis}\n\nPlease generate a deeper analysis and more probing questions.` 
            }
        ];
        
        // Call OpenAI API
        const response = await openai.chat.completions.create({
            model: GPT_VERSION,
            messages: chatMessages,
            temperature: 0.7,
            max_tokens: 800,
            response_format: { type: "json_object" }
        });
        
        const responseContent = response.choices[0].message.content || '';
        let parsedResponse;
        
        try {
            parsedResponse = JSON.parse(responseContent);
        } catch (error) {
            logger.error('Error parsing JSON response:', error);
            
            // Delete wait message
            if (ctx.chat) {
                await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);
            }
            
            await ctx.reply(`<b>Oops!</b> My brain got a little tangled there. Let's try again later, ${user.name || user.firstName}!`, {
                parse_mode: 'HTML'
            });
            return;
        }
        
        const deeperAnalysis = parsedResponse.analysis || "Looking deeper at your reflections...";
        const deeperQuestions = parsedResponse.questions || ["What else would you like to explore about this experience?"];
        
        // Update the journal entry with the deeper analysis and questions
        await updateJournalEntryAnalysis(entryId, `${previousAnalysis}\n\nDeeper Analysis: ${deeperAnalysis}`);
        await updateJournalEntryQuestions(entryId, deeperQuestions);
        
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
        logger.error('Error in Go Deeper handler:', error);
        await ctx.reply(`<b>Oh sweetie</b>, seems like my third eye got a bit cloudy there 👁️\n\nLet's take a breath and try again when the energy aligns... 🌟`, {
            parse_mode: 'HTML'
        });
        await showMainMenu(ctx, user);
    }
}

// Handle error cases with Infinity's personality
bot.catch((err: Error) => {
    logger.error('Bot error:', err);
});

// Start the bot
bot.start();

// Start the notification service
notificationService.start();

// Export the bot
export { bot as journalBot }; 