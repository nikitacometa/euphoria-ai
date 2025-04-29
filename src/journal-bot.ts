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
import { showMainMenu } from './features/core/handlers';
import { registerCoreHandlers } from './features/core';
import { registerJournalHistoryHandlers } from './features/journal-history';
import { registerJournalChatHandlers } from './features/journal-chat';
import { registerSettingsHandlers } from './features/settings';

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
    initial: (): JournalBotSession => ({
        journalChatMode: false,
        waitingForJournalQuestion: false
    })
}));

// Connect to MongoDB
connectToDatabase().catch(error => journalBotLogger.error('Failed to connect to MongoDB:', error));

// === FEATURE REGISTRATION ===
registerOnboardingHandlers(bot);
registerJournalEntryHandlers(bot);
registerCoreHandlers(bot);
registerJournalHistoryHandlers(bot);
registerJournalChatHandlers(bot);
registerSettingsHandlers(bot);
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

// Universal cancel command to reset any user state
bot.command(['cancel', 'reset', 'stop'], async (ctx) => {
    if (!ctx.from) return;
    
    const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
    
    // Reset all session flags
    if (ctx.session.journalEntryId) {
        logger.info(`Cancelling journal entry ${ctx.session.journalEntryId} via /cancel command`);
        ctx.session.journalEntryId = undefined;
    }
    
    if (ctx.session.journalChatMode) {
        logger.info(`Exiting journal chat mode via /cancel command`);
        ctx.session.journalChatMode = false;
        ctx.session.waitingForJournalQuestion = false;
    }
    
    if (ctx.session.waitingForNotificationTime) {
        logger.info(`Cancelling notification time setting via /cancel command`);
        ctx.session.waitingForNotificationTime = false;
    }
    
    if (ctx.session.onboardingStep) {
        logger.info(`Cancelling onboarding step ${ctx.session.onboardingStep} via /cancel command`);
        ctx.session.onboardingStep = undefined;
    }
    
    await ctx.reply("✨ All active sessions have been reset. Returning to main menu.");
    await showMainMenu(ctx, user);
});

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
    
    const data: string = ctx.callbackQuery.data; 

    // Keep generic fallback/logging for now
    if (!data.startsWith('view_entry:') && 
        data !== 'journal_history' && 
        data !== 'main_menu' && 
        data !== 'toggle_notifications' && 
        data !== 'set_notification_time' &&
        data !== 'exit_chat_mode')
    {
        // Acknowledge specific callbacks handled by bot.callbackQuery
        if (["analyze_journal", "go_deeper", "finish_journal"].includes(data)) {
             await ctx.answerCallbackQuery().catch(e => logger.warn("Failed to ack handled callback", e));
        } else {
            // Log others
            await ctx.answerCallbackQuery({text: "Action not recognized"});
            logger.info(`Unhandled callback_query data in generic handler: ${data}`);
        }
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
    
    // Default: show main menu for unhandled messages if not handled by any feature
    logger.debug(`Unhandled message type received for user ${user.telegramId}, showing main menu.`);
    await showMainMenu(ctx, user);
});

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