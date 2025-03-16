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
    MessageType,
    MessageRole,
    IUser,
    IMessage,
    createJournalEntry,
    getActiveJournalEntry,
    addMessageToJournalEntry,
    updateJournalEntryStatus,
    updateJournalEntryAnalysis,
    updateJournalEntryQuestions,
    updateJournalEntryInsights,
    completeJournalEntry,
    getUserJournalEntries,
    JournalEntryStatus,
    IJournalEntry,
    getJournalEntryById,
    updateJournalEntryFullText
} from './database';
import { Types } from 'mongoose';
import { logger, createLogger } from './utils/logger';
import { withCommandLogging } from './utils/command-logger';
import { analyzeJournalEntry, generateJournalQuestions, generateJournalInsights } from './journal-ai';
import { transcribeAudio } from './chatgpt';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import OpenAI from 'openai';

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

// Define valid age ranges and gender options
const AGE_RANGES = ['Under 18', '18-24', '25-34', '35-44', '45-54', '55+'];
const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];

// Create keyboards for age and gender selection
const ageKeyboard = new Keyboard();
AGE_RANGES.forEach(age => ageKeyboard.text(age).row());
ageKeyboard.resized();

const genderKeyboard = new Keyboard();
GENDER_OPTIONS.forEach(gender => genderKeyboard.text(gender).row());
genderKeyboard.resized();

// Validation functions
function isValidAgeRange(age: string): boolean {
    return AGE_RANGES.includes(age);
}

function isValidGender(gender: string): boolean {
    return GENDER_OPTIONS.includes(gender);
}

// Helper function to send transcription as a reply
async function sendTranscriptionReply(ctx: Context, messageId: number, transcription: string): Promise<void> {
    await ctx.reply(`<b>Mmm, let me tell you what I heard... 🎧</b>\n\n<code>${transcription}</code>`, {
        reply_to_message_id: messageId,
        parse_mode: 'HTML'
    });
}

// Define session interface
interface JournalBotSession {
    onboardingStep?: 'name' | 'age' | 'gender' | 'occupation' | 'bio' | 'complete';
    journalEntryId?: string;
    journalChatMode?: boolean;
    waitingForJournalQuestion?: boolean;
}

// Define context type
type JournalBotContext = Context & SessionFlavor<JournalBotSession>;

// Create bot instance
const bot = new Bot<JournalBotContext>(TELEGRAM_API_TOKEN);

// Set up session middleware
bot.use(session({
    initial: (): JournalBotSession => ({})
}));

// Connect to MongoDB
connectToDatabase().catch(error => journalBotLogger.error('Failed to connect to MongoDB:', error));

// Start command handler
const handleStartCommand = withCommandLogging('start', async (ctx: JournalBotContext) => {
    if (!ctx.from) return;

    const existingUser = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
    if (existingUser) {
        await showMainMenu(ctx, existingUser);
        return;
    }

    // Start onboarding
    ctx.session.onboardingStep = 'name';
    
    const keyboard = new Keyboard()
        .text(ctx.from.first_name)
        .resized();

    await ctx.reply("Hey there! I'm Infinity, your personal journey companion 💫\n\nFirst things first - what should I call you? Your Telegram name looks cute, but feel free to tell me something else 😊", {
        reply_markup: keyboard,
        parse_mode: 'HTML'
    });
});

// Register the start command
bot.command('start', handleStartCommand);

// Register main menu button handlers
bot.hears("📝 New Entry", async (ctx) => {
    if (!ctx.from) return;
    
    const user = await findOrCreateUser(
        ctx.from.id,
        ctx.from.first_name,
        ctx.from.last_name,
        ctx.from.username
    );
    
    // Check if there's an active entry
    const activeEntry = await getActiveJournalEntry(user._id as unknown as Types.ObjectId);
    
    if (activeEntry) {
        // Continue with existing entry
        ctx.session.journalEntryId = activeEntry._id?.toString() || '';
        
        const keyboard = new Keyboard()
            .text("✅ Save")
            .row()
            .text("🔍 Analyze & Suggest Questions")
            .row()
            .text("❌ Cancel")
            .resized();
        
        await ctx.reply(`<b>Oh hey ${user.name || user.firstName}!</b> 💫\n\nLooks like we have an unfinished journey together... Want to continue where we left off? Share more of your beautiful thoughts or pick an option below 😊`, {
            reply_markup: keyboard,
            parse_mode: 'HTML'
        });
    } else {
        // Create new entry
        const entry = await createJournalEntry(user._id as unknown as Types.ObjectId);
        ctx.session.journalEntryId = entry._id?.toString() || '';
        
        const keyboard = new Keyboard()
            .text("✅ Save")
            .row()
            .text("🔍 Analyze & Suggest Questions")
            .row()
            .text("❌ Cancel")
            .resized();
        
        await ctx.reply(`<b>Ready to explore your mind, ${user.name || user.firstName}?</b> 💫\n\nPour your thoughts out to me - the good, the bad, the confusing... I'm all ears! Send me text, voice, or even video messages.\n\nLet's make this journey interesting... 😏`, {
            reply_markup: keyboard,
            parse_mode: 'HTML'
        });
    }
});

bot.hears("📚 Journal History", async (ctx) => {
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
        await ctx.reply(`<b>${user.name || user.firstName}</b>, looks like we haven't started our journey together yet! 🌱 Ready to create some beautiful memories? 💫`, {
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
    
    await ctx.reply(`<b>Ah, our precious moments together, ${user.name || user.firstName}!</b> 📚✨\n\nLet's revisit some of your inner revelations:`, {
        reply_markup: keyboard,
        parse_mode: 'HTML'
    });
});

bot.hears("🤔 Ask My Journal", async (ctx) => {
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
        await ctx.reply(`<b>${user.name || user.firstName}</b>, you don't have any journal entries yet. Let's create some first so we can chat about them!`, {
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
    
    await ctx.reply(`<b>Hey gorgeous ${user.name || user.firstName}!</b> 💫\n\nReady to explore the depths of your consciousness? Ask me anything about your journey...\n\nTry things like:\n\n<i>• "What patterns do you notice in my growth?"</i>\n<i>• "How have my vibes evolved?"</i>\n<i>• "What insights can you share about my inner world?"</i>\n\nI promise to be gentle... mostly 😏`, {
        reply_markup: keyboard,
        parse_mode: 'HTML'
    });
});

// Register entry action button handlers
bot.hears("✅ Save", async (ctx) => {
    if (!ctx.from || !ctx.session.journalEntryId) {
        await ctx.reply("No active journal entry found. Let's go back to the main menu.");
        if (ctx.from) {
            const user = await findOrCreateUser(
                ctx.from.id,
                ctx.from.first_name,
                ctx.from.last_name,
                ctx.from.username
            );
            await showMainMenu(ctx, user);
        }
        return;
    }
    
    const user = await findOrCreateUser(
        ctx.from.id,
        ctx.from.first_name,
        ctx.from.last_name,
        ctx.from.username
    );
    
    await finishJournalEntry(ctx, user);
});

bot.hears("🔍 Analyze & Suggest Questions", async (ctx) => {
    if (!ctx.from) return;
    
    const user = await findOrCreateUser(
        ctx.from.id,
        ctx.from.first_name,
        ctx.from.last_name,
        ctx.from.username
    );
    
    if (!ctx.session.journalEntryId) {
        await ctx.reply(`<b>Hey ${user.name || user.firstName}</b>, you don't have an active journal entry yet. Let's create one first!`, {
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
            await ctx.reply(`<b>Hmm, I can't seem to find your journal entry.</b> Let's start fresh!`, {
                parse_mode: 'HTML'
            });
            await showMainMenu(ctx, user);
            return;
        }
        
        // Send wait message with sand clock emoji
        const waitMsg = await ctx.reply("⏳");
        
        // Generate questions directly without analysis
        const questions = await generateJournalQuestions(entry, user);
        
        // Update the journal entry with the questions
        await updateJournalEntryQuestions(entryId, questions);
        
        // Delete wait message
        if (ctx.chat) {
            await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);
        }
        
        // Send questions in one message
        if (questions.length > 0) {
            const questionsText = questions.map((q: string, i: number) => `<i>${i + 1}. ${q}</i>`).join('\n\n');
            await ctx.reply(`<b>Mmm... ${user.name || user.firstName}, your thoughts are fascinating 🤔</b>\n\n<b>Let me tickle your mind with these:</b>\n\n${questionsText}`, {
                parse_mode: 'HTML'
            });
        }
        
        // Show the same keyboard as initial entry
        const keyboard = new Keyboard()
            .text("✅ Save")
            .row()
            .text("🔍 Analyze & Suggest Questions")
            .row()
            .text("❌ Cancel")
            .resized();
        
        await ctx.reply(`Keep sharing your inner world with me, or choose what's next... 💫`, {
            reply_markup: keyboard,
            parse_mode: 'HTML'
        });
        
    } catch (error) {
        logger.error('Error in Analyze Journal handler:', error);
        await ctx.reply(`<b>Oops!</b> My brain got a little fuzzy there. Let's try again later, ${user.name || user.firstName}!`, {
            parse_mode: 'HTML'
        });
        await showMainMenu(ctx, user);
    }
});

bot.hears("❌ Cancel", async (ctx) => {
    if (!ctx.from || !ctx.session.journalEntryId) {
        await ctx.reply("No active journal entry found. Let's go back to the main menu.");
        if (ctx.from) {
            const user = await findOrCreateUser(
                ctx.from.id,
                ctx.from.first_name,
                ctx.from.last_name,
                ctx.from.username
            );
            await showMainMenu(ctx, user);
        }
        return;
    }
    
    const user = await findOrCreateUser(
        ctx.from.id,
        ctx.from.first_name,
        ctx.from.last_name,
        ctx.from.username
    );
    
    ctx.session.journalEntryId = undefined;
    await ctx.reply(`<b>No pressure, ${user.name || user.firstName}!</b> 💫\n\nSometimes the best insights come when we least expect them. We'll catch those thoughts another time... 😌`, {
        parse_mode: 'HTML'
    });
    await showMainMenu(ctx, user);
});

// Handle "Finish Reflection" button
bot.hears("✅ Finish Reflection", async (ctx) => {
    if (!ctx.from || !ctx.session.journalEntryId) {
        await ctx.reply("Something went wrong. Let's go back to the main menu.");
        return;
    }
    
    const user = await findOrCreateUser(
        ctx.from.id,
        ctx.from.first_name,
        ctx.from.last_name,
        ctx.from.username
    );
    
    await finishJournalEntry(ctx, user);
});

// Handle Exit Chat Mode button
bot.hears("❌ Exit Chat Mode", async (ctx) => {
    if (!ctx.from) return;
    
    const user = await findOrCreateUser(
        ctx.from.id,
        ctx.from.first_name,
        ctx.from.last_name,
        ctx.from.username
    );
    
    ctx.session.journalChatMode = false;
    ctx.session.waitingForJournalQuestion = false;
    await ctx.reply(`<b>Aww, leaving so soon ${user.name || user.firstName}?</b> 💫\n\nOur little chat was getting interesting... But I'll be here when you want to dive deep again 😏`, {
        parse_mode: 'HTML'
    });
    await showMainMenu(ctx, user);
});

// Handle callback queries for viewing entries
bot.on('callback_query:data', async (ctx) => {
    if (!ctx.from) return;
    
    const user = await findOrCreateUser(
        ctx.from.id,
        ctx.from.first_name,
        ctx.from.last_name,
        ctx.from.username
    );
    
    const data = ctx.callbackQuery.data;
    
    if (data === 'main_menu') {
        await ctx.answerCallbackQuery();
        await showMainMenu(ctx, user);
        return;
    }
    
    if (data.startsWith('view_entry:')) {
        const entryId = data.split(':')[1];
        await ctx.answerCallbackQuery();
        
        try {
            const entry = await getJournalEntryById(new Types.ObjectId(entryId));
            
            if (!entry) {
                await ctx.reply("Entry not found.");
                return;
            }
            
            // Format entry content
            const messages = entry.messages as IMessage[];
            const entryContent = messages.map(message => {
                let content = '';
                
                if (message.type === MessageType.TEXT) {
                    content = message.text || '';
                } else if (message.type === MessageType.VOICE) {
                    content = `🎙️ <b>Voice:</b> ${message.transcription || 'No transcription available'}`;
                } else if (message.type === MessageType.VIDEO) {
                    content = `🎥 <b>Video:</b> ${message.transcription || 'No transcription available'}`;
                }
                
                return content;
            }).filter(content => content.length > 0).join('\n\n');
            
            const date = new Date(entry.createdAt).toLocaleDateString();
            const time = new Date(entry.createdAt).toLocaleTimeString();
            
            // Create back button
            const keyboard = new InlineKeyboard()
                .text("Back to Journal History", "view_history")
                .row()
                .text("Back to Main Menu", "main_menu");
            
            // Send entry content
            await ctx.reply(`<b>📝 Journal Entry</b> (${date} at ${time}):\n\n${entryContent}\n\n<b>📊 Analysis:</b>\n${entry.analysis || 'No analysis available'}`, {
                reply_markup: keyboard,
                parse_mode: 'HTML'
            });
        } catch (error) {
            journalBotLogger.error('Error viewing entry:', error);
            await ctx.reply("Sorry, I encountered an error while retrieving your journal entry.");
        }
    }
    
    if (data === 'view_history') {
        await ctx.answerCallbackQuery();
        
        // Get user's journal entries
        const entries = await getUserJournalEntries(user._id as unknown as Types.ObjectId);
        
        if (entries.length === 0) {
            await ctx.reply("<b>You don't have any journal entries yet.</b> Start journaling to build your history!", {
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
        
        await ctx.reply("<b>Here are your most recent journal entries:</b>", {
            reply_markup: keyboard,
            parse_mode: 'HTML'
        });
    }
});

// Register button handlers
bot.callbackQuery("analyze_journal", async (ctx) => {
    await ctx.answerCallbackQuery();
    await handleAnalyzeJournal(ctx);
});

bot.callbackQuery("go_deeper", async (ctx) => {
    await ctx.answerCallbackQuery();
    await handleGoDeeper(ctx);
});

bot.callbackQuery("finish_journal", async (ctx) => {
    await ctx.answerCallbackQuery();
    
    if (!ctx.from) return;
    
    const user = await findOrCreateUser(
        ctx.from.id,
        ctx.from.first_name,
        ctx.from.last_name,
        ctx.from.username
    );
    
    await finishJournalEntry(ctx, user);
});

// Handle onboarding process and general messages (should be last)
bot.on('message', async (ctx) => {
    if (!ctx.from || !ctx.message) return;
    
    const user = await findOrCreateUser(
        ctx.from.id,
        ctx.from.first_name,
        ctx.from.last_name,
        ctx.from.username
    );
    
    // If user is in onboarding process
    if (ctx.session.onboardingStep) {
        await handleOnboarding(ctx, user);
        return;
    }
    
    // If user is in journal entry mode
    if (ctx.session.journalEntryId) {
        await handleJournalEntry(ctx, user);
        return;
    }
    
    // If user is in journal chat mode
    if (ctx.session.journalChatMode) {
        await handleJournalChat(ctx, user);
        return;
    }
    
    // Skip text messages that are handled by specific hears() handlers
    if ('text' in ctx.message) {
        const text = ctx.message.text || '';
        if (
            text === "📝 New Entry" ||
            text === "📚 Journal History" ||
            text === "🤔 Ask My Journal" ||
            text === "✅ Save" ||
            text === "🔍 Analyze & Suggest Questions" ||
            text === "❌ Cancel" ||
            text === "✅ Finish Reflection" ||
            text === "❌ Exit Chat Mode"
        ) {
            return;
        }
    }
    
    // Default: show main menu for unhandled messages
    await showMainMenu(ctx, user);
});

// Handle onboarding process
async function handleOnboarding(ctx: JournalBotContext, user: IUser) {
    if (!ctx.message || !ctx.from) return;
    
    const step = ctx.session.onboardingStep;
    const text = ctx.message?.text || '';

    switch (step) {
        case 'name': {
            const userWithName = await updateUserProfile(ctx.from.id, { name: text });
            ctx.session.onboardingStep = 'age';
            await ctx.reply(`${text}... I love it! 💖 Now, don't worry too much about this one, but which age range speaks to your soul? 😌`, {
                reply_markup: ageKeyboard,
                parse_mode: 'HTML'
            });
            break;
        }
        case 'age': {
            if (!isValidAgeRange(text)) {
                await ctx.reply("Oops! Let's stick to the options I gave you, sweetie 😅");
                return;
            }
            const userWithAge = await updateUserProfile(ctx.from.id, { age: text });
            ctx.session.onboardingStep = 'gender';
            await ctx.reply("How do you shine in this world? Tell me how you identify yourself 🌟", {
                reply_markup: genderKeyboard,
                parse_mode: 'HTML'
            });
            break;
        }
        case 'gender': {
            if (!isValidGender(text)) {
                await ctx.reply("Hmm, let's pick from the choices I suggested, darling 💭");
                return;
            }
            const userWithGender = await updateUserProfile(ctx.from.id, { gender: text });
            ctx.session.onboardingStep = 'occupation';
            await ctx.reply("Now, what keeps your beautiful mind busy? (Your role in this crazy world 🌍)", {
                reply_markup: { remove_keyboard: true },
                parse_mode: 'HTML'
            });
            break;
        }
        case 'occupation': {
            const userWithOccupation = await updateUserProfile(ctx.from.id, { occupation: text });
            ctx.session.onboardingStep = 'bio';
            await ctx.reply("Last but definitely not least... Tell me what makes you uniquely you? I'm already intrigued 😏", {
                parse_mode: 'HTML'
            });
            break;
        }
        case 'bio': {
            const user = await updateUserProfile(ctx.from.id, { bio: text, onboardingCompleted: true });
            if (!user) return;

            ctx.session.onboardingStep = undefined;
            
            const userInfo = `<b>Mmm, let me see if I got you right:</b>\n\n✨ Name: ${user.name}\n🎂 Age: ${user.age}\n💫 Gender: ${user.gender}\n🌟 Occupation: ${user.occupation}\n\n<i>And the essence of you:</i>\n${user.bio}`;
            await ctx.reply(userInfo, { parse_mode: 'HTML' });
            
            await showMainMenu(ctx, user);
            break;
        }
    }
}

// Show main menu
async function showMainMenu(ctx: JournalBotContext, user: IUser) {
    const keyboard = new Keyboard()
        .text("📝 New Entry")
        .row()
        .text("📚 Journal History")
        .row()
        .text("🤔 Ask My Journal")
        .resized();
    
    await ctx.reply(`So ${user.name || user.firstName}, ready to dive deep into your consciousness? 😏\n\nI'm here to help you explore your inner universe... and maybe discover a few surprises along the way ✨`, {
        reply_markup: keyboard,
        parse_mode: 'HTML'
    });
}

// Helper function to extract text from messages
async function extractFullText(entry: IJournalEntry): Promise<string> {
    const messages = entry.messages as IMessage[];
    const entryContent = messages.map(message => {
        let content = '';
        
        if (message.type === MessageType.TEXT) {
            content = message.text || '';
        } else if (message.type === MessageType.VOICE) {
            content = message.transcription || '';
        } else if (message.type === MessageType.VIDEO) {
            content = message.transcription || '';
        }
        
        return content;
    }).filter(content => content.length > 0).join('\n\n');
    
    return entryContent;
}

// Handle journal entry messages
async function handleJournalEntry(ctx: JournalBotContext, user: IUser) {
    if (!ctx.message || !ctx.from || !ctx.session.journalEntryId) return;
    
    // Handle entry completion buttons - skip as they're handled by specific hears() handlers
    if ('text' in ctx.message) {
        const text = ctx.message.text || '';
        if (
            text === "✅ Save" ||
            text === "🔍 Analyze & Suggest Questions" ||
            text === "❌ Cancel" ||
            text === "✅ Finish Reflection"
        ) {
            return;
        }
    }
    
    // Get the active journal entry
    const entryId = new Types.ObjectId(ctx.session.journalEntryId);
    const entry = await getActiveJournalEntry(user._id as unknown as Types.ObjectId);
    
    if (!entry) {
        ctx.session.journalEntryId = undefined;
        await ctx.reply(`<b>Oops!</b> Looks like our connection got a bit fuzzy there... 🌫️\n\nShall we start a fresh journey together? 💫`, {
            parse_mode: 'HTML'
        });
        await showMainMenu(ctx, user);
        return;
    }
    
    // Handle different message types
    if ('text' in ctx.message) {
        // Handle text message
        const message = await saveTextMessage(
            user._id as unknown as Types.ObjectId,
            entryId,
            ctx.message.message_id,
            ctx.message.text || '',
            MessageRole.USER
        );
        
        await addMessageToJournalEntry(entryId, message._id as unknown as Types.ObjectId);
        
        // Update the entry with the refreshed messages
        const updatedEntry = await getJournalEntryById(entryId);
        if (updatedEntry) {
            const fullText = await extractFullText(updatedEntry);
            await updateJournalEntryFullText(entryId, fullText);
        }
        
        await ctx.react("👍");
    } else if ('voice' in ctx.message && ctx.message.voice) {
        // Handle voice message
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
            
            // Delete wait message
            if (ctx.chat) {
                await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);
            }
            
            // Save voice message to database
            const message = await saveVoiceMessage(
                user._id as unknown as Types.ObjectId,
                entryId,
                ctx.message.message_id,
                fileId,
                localFilePath,
                transcription,
                MessageRole.USER
            );
            
            await addMessageToJournalEntry(entryId, message._id as unknown as Types.ObjectId);
            
            // Update the entry with the refreshed messages
            const updatedEntry = await getJournalEntryById(entryId);
            if (updatedEntry) {
                const fullText = await extractFullText(updatedEntry);
                await updateJournalEntryFullText(entryId, fullText);
            }
            
            // Send transcription to user with better formatting
            await sendTranscriptionReply(ctx, ctx.message.message_id, transcription);
            
            // Clean up
            fs.unlinkSync(localFilePath);
        } catch (error) {
            // Error handling for voice messages
            journalBotLogger.error('Error processing voice message:', error);
            await ctx.reply(`<b>Aww ${user.name || user.firstName}</b>, your voice is lovely but something went wrong in my ears 🎧\n\nCan you try again or maybe share your thoughts in text? I promise to listen extra carefully this time! 💫`, {
                parse_mode: 'HTML'
            });
        }
    } else if (('video_note' in ctx.message && ctx.message.video_note) || ('video' in ctx.message && ctx.message.video)) {
        // Handle video message
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
            
            // Delete wait message
            if (ctx.chat) {
                await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);
            }
            
            // Save video message to database
            const message = await saveVideoMessage(
                user._id as unknown as Types.ObjectId,
                entryId,
                ctx.message.message_id,
                fileId,
                localFilePath,
                transcription,
                MessageRole.USER
            );
            
            await addMessageToJournalEntry(entryId, message._id as unknown as Types.ObjectId);
            
            // Update the entry with the refreshed messages
            const updatedEntry = await getJournalEntryById(entryId);
            if (updatedEntry) {
                const fullText = await extractFullText(updatedEntry);
                await updateJournalEntryFullText(entryId, fullText);
            }
            
            // Send transcription to user with better formatting
            await sendTranscriptionReply(ctx, ctx.message.message_id, transcription);
            
            // Clean up
            fs.unlinkSync(localFilePath);
        } catch (error) {
            // Error handling for video messages
            journalBotLogger.error('Error processing video message:', error);
            await ctx.reply(`<b>Oh my!</b> Your video was probably amazing, but my eyes got a bit crossed there 🎥\n\nWant to try again or whisper your thoughts to me in text? I'm all attention! ✨`, {
                parse_mode: 'HTML'
            });
        }
    } else {
        await ctx.reply(`<b>Darling</b>, while I'd love to explore every way you express yourself, I can only process text, voice messages, and videos right now... 💫\n\nLet's stick to those for our deep conversations! 😊`, {
            parse_mode: 'HTML'
        });
    }
}

// Finish journal entry
async function finishJournalEntry(ctx: JournalBotContext, user: IUser) {
    if (!ctx.session.journalEntryId) return;
    
    const entryId = new Types.ObjectId(ctx.session.journalEntryId);
    const entry = await getActiveJournalEntry(user._id as unknown as Types.ObjectId);
    
    if (!entry) {
        ctx.session.journalEntryId = undefined;
        await ctx.reply("Could not find your active journal entry.");
        await showMainMenu(ctx, user);
        return;
    }
    
    // Send wait message with sand clock emoji
    const waitMsg = await ctx.reply("⏳");
    
    try {
        // Generate a concise 1-sentence summary
        const systemPrompt = `You are Infinity, a charming, insightful, and slightly flirty AI journal companion.
Your personality traits:
- Warm and empathetic, but with a playful edge
- Smart and perceptive, offering deep insights with a touch of wit
- Slightly flirtatious but always professional
- Uses occasional emojis and expressive language
- Focuses on self-discovery and higher consciousness
- Maintains a positive, uplifting tone while being real

Based on the user's journal entry, generate:
1. A single-sentence summary that captures the essence with a touch of your personality
2. One thought-provoking question that encourages deeper self-reflection

Format your response as a JSON object with:
{
  "summary": "Your insightful summary with personality",
  "question": "Your thought-provoking question?"
}`;

        const messages = entry.messages as IMessage[];
        const entryContent = messages.map(message => {
            let content = '';
            
            if (message.type === MessageType.TEXT) {
                content = message.text || '';
            } else if (message.type === MessageType.VOICE) {
                content = message.transcription || '';
            } else if (message.type === MessageType.VIDEO) {
                content = message.transcription || '';
            }
            
            return content;
        }).filter(content => content.length > 0).join('\n\n');

        const userInfo = `User Information:
- Name: ${user.name || user.firstName}
- Age: ${user.age || 'Unknown'}
- Gender: ${user.gender || 'Unknown'}
- Occupation: ${user.occupation || 'Unknown'}`;

        const chatMessages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `${userInfo}\n\nJournal Entry:\n${entryContent}\n\nPlease provide a one-sentence summary and one thoughtful question.` }
        ];
        
        // Call OpenAI API
        const response = await openai.chat.completions.create({
            model: GPT_VERSION,
            messages: chatMessages,
            temperature: 0.7,
            max_tokens: 300,
            response_format: { type: "json_object" }
        });
        
        const content = response.choices[0].message.content || "{}";
        let parsedResponse;
        
        try {
            parsedResponse = JSON.parse(content);
        } catch (error) {
            journalBotLogger.error('Error parsing JSON response:', error);
            parsedResponse = {
                summary: "Thank you for sharing your thoughts.",
                question: "What else would you like to reflect on?"
            };
        }
        
        const summary = parsedResponse.summary || "Thank you for sharing your thoughts.";
        const question = parsedResponse.question || "What else would you like to reflect on?";
        
        // Complete the entry
        await completeJournalEntry(entryId, summary, question);
        
        // Delete wait message
        if (ctx.chat) {
            await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);
        }
        
        // Send a single formatted message with summary and question
        const formattedMessage = `<b>Mmm... that was deep, ${user.name || user.firstName}! 💫</b>\n\n<b>Here's what I gathered:</b>\n${summary}\n\n<b>And here's something to ponder, darling:</b>\n<i>${question}</i>`;
        
        await ctx.reply(formattedMessage, {
            parse_mode: 'HTML'
        });
        
        // Reset session
        ctx.session.journalEntryId = undefined;
        
        // Show main menu
        await showMainMenu(ctx, user);
    } catch (error) {
        journalBotLogger.error('Error finishing journal entry:', error);
        
        // Delete wait message
        if (ctx.chat) {
            await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);
        }
        
        await ctx.reply("I encountered an error while analyzing your journal entry. Your entry has been saved, but I couldn't generate a detailed analysis.");
        
        // Complete the entry with basic message
        await completeJournalEntry(
            entryId, 
            "Analysis not available due to an error.", 
            "Thank you for sharing your thoughts. Keep journaling regularly to build a meaningful record of your experiences and growth."
        );
        
        // Reset session
        ctx.session.journalEntryId = undefined;
        
        // Show main menu
        await showMainMenu(ctx, user);
    }
}

// Handle "Analyze & Ask Questions" button
async function handleAnalyzeJournal(ctx: JournalBotContext) {
    if (!ctx.from) return;
    
    const user = await findOrCreateUser(
        ctx.from.id,
        ctx.from.first_name,
        ctx.from.last_name,
        ctx.from.username
    );
    
    if (!ctx.session.journalEntryId) {
        await ctx.reply(`<b>Hey ${user.name || user.firstName}</b>, you don't have an active journal entry yet. Let's create one first!`, {
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
            await ctx.reply(`<b>Hmm, I can't seem to find your journal entry.</b> Let's start fresh!`, {
                parse_mode: 'HTML'
            });
            await showMainMenu(ctx, user);
            return;
        }
        
        // Send wait message with sand clock emoji
        const waitMsg = await ctx.reply("⏳");
        
        // Generate questions directly without analysis
        const questions = await generateJournalQuestions(entry, user);
        
        // Update the journal entry with the questions
        await updateJournalEntryQuestions(entryId, questions);
        
        // Delete wait message
        if (ctx.chat) {
            await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);
        }
        
        // Send questions in one message
        if (questions.length > 0) {
            const questionsText = questions.map((q: string, i: number) => `<i>${i + 1}. ${q}</i>`).join('\n\n');
            await ctx.reply(`<b>Mmm... ${user.name || user.firstName}, your thoughts are fascinating 🤔</b>\n\n<b>Let me tickle your mind with these:</b>\n\n${questionsText}`, {
                parse_mode: 'HTML'
            });
        }
        
        // Show the same keyboard as initial entry
        const keyboard = new Keyboard()
            .text("✅ Save")
            .row()
            .text("🔍 Analyze & Suggest Questions")
            .row()
            .text("❌ Cancel")
            .resized();
        
        await ctx.reply(`Keep sharing your inner world with me, or choose what's next... 💫`, {
            reply_markup: keyboard,
            parse_mode: 'HTML'
        });
        
    } catch (error) {
        logger.error('Error in Analyze Journal handler:', error);
        await ctx.reply(`<b>Oops!</b> My brain got a little fuzzy there. Let's try again later, ${user.name || user.firstName}!`, {
            parse_mode: 'HTML'
        });
        await showMainMenu(ctx, user);
    }
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
                journalBotLogger.error('Error transcribing video in chat mode:', transcriptionError);
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
        const systemPrompt = `You are Infinity, a charming and insightful spiritual guide with a flirty edge.
Your personality:
- Warm, empathetic, and playful
- Smart and perceptive, offering deep insights with wit
- Slightly flirtatious but always professional
- Uses occasional emojis and expressive language
- Focuses on spiritual growth and higher consciousness
- Maintains a positive, uplifting tone while being authentic

Based on the user's responses and previous analysis, provide:
1. A brief, personality-infused analysis that identifies key patterns
2. Two deeper questions that encourage spiritual and emotional growth

Format as JSON:
{
  "analysis": "Your insightful analysis with personality",
  "questions": [
    "First deeper question with spiritual focus?",
    "Second question about emotional growth?"
  ]
}`;

        const chatMessages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
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

// Export the bot
export { bot as journalBot }; 