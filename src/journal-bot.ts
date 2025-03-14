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

// Define session interface
interface JournalBotSession {
    onboardingStep?: 'name' | 'age' | 'gender' | 'religion' | 'occupation' | 'bio' | 'complete';
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
    if (!ctx.from) {
        await ctx.reply('Hello there!');
        return;
    }
    
    // Save user to database
    const user = await findOrCreateUser(
        ctx.from.id,
        ctx.from.first_name,
        ctx.from.last_name,
        ctx.from.username
    );
    
    // Reset session
    ctx.session = {};
    
    // Check if user has completed onboarding
    if (user.onboardingCompleted) {
        await showMainMenu(ctx, user);
    } else {
        // Start onboarding
        ctx.session.onboardingStep = 'name';
        await ctx.reply(`Hey there, ${user.firstName}! 👋 I'm your personal journal buddy! I'm here to help you reflect, grow, and have some fun along the way.\n\nBefore we dive in, I'd love to get to know you better.\n\nFirst things first - what name would you like me to call you?`);
    }
});

// Register the start command
bot.command('start', handleStartCommand);

// Register main menu button handlers
bot.hears("📝 Create New Entry", async (ctx) => {
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
            .text("✅ Finish Entry")
            .row()
            .text("🔍 Go Deeper, Ask Me")
            .row()
            .text("❌ Cancel Entry")
            .resized();
        
        await ctx.reply(`Hey ${user.name || user.firstName}! You already have an entry in progress. Want to continue where you left off? You can add more thoughts or choose an option below:`, {
            reply_markup: keyboard
        });
    } else {
        // Create new entry
        const entry = await createJournalEntry(user._id as unknown as Types.ObjectId);
        ctx.session.journalEntryId = entry._id?.toString() || '';
        
        const keyboard = new Keyboard()
            .text("✅ Finish Entry")
            .row()
            .text("🔍 Go Deeper, Ask Me")
            .row()
            .text("❌ Cancel Entry")
            .resized();
        
        await ctx.reply(`Let's create a new journal entry, ${user.name || user.firstName}! 📝✨\n\nShare whatever's on your mind - your thoughts, feelings, experiences... anything at all! You can send text, voice messages, or videos.\n\nI'm here to listen and help you reflect. When you're ready, just choose one of the options below:`, {
            reply_markup: keyboard
        });
    }
});

bot.hears("📚 View Journal History", async (ctx) => {
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
        await ctx.reply(`${user.name || user.firstName}, you haven't created any journal entries yet. Let's start your journaling journey today!`);
        await showMainMenu(ctx, user);
        return;
    }
    
    // Create inline keyboard with entries
    const keyboard = new InlineKeyboard();
    
    entries.slice(0, 10).forEach((entry, index) => {
        const date = new Date(entry.createdAt).toLocaleDateString();
        keyboard.text(`Entry ${index + 1} (${date})`, `view_entry:${entry._id}`).row();
    });
    
    keyboard.text("Back to Main Menu", "main_menu");
    
    await ctx.reply(`Here's your journaling history, ${user.name || user.firstName}! 📚 Tap on any entry to view it:`, {
        reply_markup: keyboard
    });
});

bot.hears("💬 Chat About My Journal", async (ctx) => {
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
        await ctx.reply(`${user.name || user.firstName}, you don't have any journal entries yet. Let's create some first so we can chat about them!`);
        await showMainMenu(ctx, user);
        return;
    }
    
    // Enter journal chat mode
    ctx.session.journalChatMode = true;
    ctx.session.waitingForJournalQuestion = true;
    
    const keyboard = new Keyboard()
        .text("❌ Exit Chat Mode")
        .resized();
    
    await ctx.reply(`Hey ${user.name || user.firstName}! 💬 I'm all ears and ready to chat about your journal entries!\n\nYou can ask me things like:\n- "What patterns do you notice in my entries?"\n- "How have my feelings changed over time?"\n- "What insights can you give me about my recent experiences?"\n\nJust ask away - I'll do my best to give you thoughtful insights!`, {
        reply_markup: keyboard
    });
});

// Register entry action button handlers
bot.hears("✅ Finish Entry", async (ctx) => {
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

bot.hears("🔍 Go Deeper, Ask Me", async (ctx) => {
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
    
    await handleAnalyzeJournal(ctx);
});

bot.hears("❌ Cancel Entry", async (ctx) => {
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
    await ctx.reply(`No worries, ${user.name || user.firstName}! I've canceled this entry. We can start fresh whenever you're ready.`);
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
    await ctx.reply(`Alright ${user.name || user.firstName}, we're back to the main menu! Let me know if you want to chat again later.`);
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
                    content = `🎙️ Voice: ${message.transcription || 'No transcription available'}`;
                } else if (message.type === MessageType.VIDEO) {
                    content = `🎥 Video: ${message.transcription || 'No transcription available'}`;
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
            await ctx.reply(`📝 Journal Entry (${date} at ${time}):\n\n${entryContent}\n\n📊 Analysis:\n${entry.analysis || 'No analysis available'}`, {
                reply_markup: keyboard
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
            await ctx.reply("You don't have any journal entries yet. Start journaling to build your history!");
            await showMainMenu(ctx, user);
            return;
        }
        
        // Create inline keyboard with entries
        const keyboard = new InlineKeyboard();
        
        entries.slice(0, 10).forEach((entry, index) => {
            const date = new Date(entry.createdAt).toLocaleDateString();
            keyboard.text(`Entry ${index + 1} (${date})`, `view_entry:${entry._id}`).row();
        });
        
        keyboard.text("Back to Main Menu", "main_menu");
        
        await ctx.reply("Here are your most recent journal entries:", {
            reply_markup: keyboard
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
            text === "📝 Create New Entry" ||
            text === "📚 View Journal History" ||
            text === "💬 Chat About My Journal" ||
            text === "✅ Finish Entry" ||
            text === "🔍 Go Deeper, Ask Me" ||
            text === "❌ Cancel Entry" ||
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
    
    // Handle text messages for onboarding
    if ('text' in ctx.message) {
        const text = ctx.message.text || '';
        
        switch (ctx.session.onboardingStep) {
            case 'name':
                await updateUserProfile(ctx.from.id, { name: text });
                ctx.session.onboardingStep = 'age';
                
                // Create age selection keyboard
                const ageKeyboard = new Keyboard()
                    .text("0-18")
                    .text("18-24")
                    .row()
                    .text("25-34")
                    .text("35-44")
                    .row()
                    .text("45-60")
                    .text("60+")
                    .resized();
                
                await ctx.reply(`Nice to meet you, ${text}! 😊 How old are you? Feel free to pick from these options:`, {
                    reply_markup: ageKeyboard
                });
                break;
                
            case 'age':
                // Handle age selection
                let age: number;
                
                // Parse age range or direct number
                if (text === "0-18") age = 15;
                else if (text === "18-24") age = 21;
                else if (text === "25-34") age = 30;
                else if (text === "35-44") age = 40;
                else if (text === "45-60") age = 50;
                else if (text === "60+") age = 65;
                else {
                    // Try to parse as direct number
                    age = parseInt(text);
                    if (isNaN(age) || age < 1 || age > 120) {
                        await ctx.reply('Please select one of the age ranges or enter a valid age (a number between 1 and 120):');
                        return;
                    }
                }
                
                await updateUserProfile(ctx.from.id, { age });
                ctx.session.onboardingStep = 'gender';
                
                // Create gender selection keyboard
                const genderKeyboard = new Keyboard()
                    .text("Male")
                    .text("Female")
                    .row()
                    .text("Non-binary")
                    .text("Other")
                    .resized();
                
                await ctx.reply('Thanks! And what gender do you identify as?', {
                    reply_markup: genderKeyboard
                });
                break;
                
            case 'gender':
                await updateUserProfile(ctx.from.id, { gender: text });
                ctx.session.onboardingStep = 'religion';
                await ctx.reply('Got it! What about your spiritual or religious beliefs? (or "none" if you prefer not to specify)');
                break;
                
            case 'religion':
                await updateUserProfile(ctx.from.id, { religion: text });
                ctx.session.onboardingStep = 'occupation';
                await ctx.reply('Thanks for sharing! What do you do for work or study?');
                break;
                
            case 'occupation':
                await updateUserProfile(ctx.from.id, { occupation: text });
                ctx.session.onboardingStep = 'bio';
                
                await ctx.reply('Almost done! Now for the fun part - tell me a bit more about yourself! 💫\n\nFeel free to share anything you want, like you\'re introducing yourself to a new friend (which I am, actually!).\n\nWhere are you from? Where are you now? Do you travel? Are you in a relationship? What are your hobbies? Dreams? Goals? Do you have pets? What about smoking, drugs, alcohol? Any spiritual practices?\n\nYou can reply with text, voice message, or even a video!', {
                    reply_markup: { remove_keyboard: true }
                });
                break;
                
            case 'bio':
                await updateUserProfile(ctx.from.id, { bio: text, onboardingCompleted: true });
                ctx.session.onboardingStep = undefined;
                
                // Get updated user
                const updatedUser = await findOrCreateUser(
                    ctx.from.id,
                    ctx.from.first_name,
                    ctx.from.last_name,
                    ctx.from.username
                );
                
                await ctx.reply(`Amazing! Thanks for sharing, ${updatedUser.name || updatedUser.firstName}! 🎉 I'm so excited to be your journal buddy. Let's start this journey together!`);
                await showMainMenu(ctx, updatedUser);
                break;
        }
    } else if ('voice' in ctx.message && ctx.message.voice && ctx.session.onboardingStep === 'bio') {
        // Handle voice message for bio
        try {
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
            
            // Save bio
            await updateUserProfile(ctx.from.id, { bio: transcription, onboardingCompleted: true });
            
            // Get updated user
            const updatedUser = await findOrCreateUser(
                ctx.from.id,
                ctx.from.first_name,
                ctx.from.last_name,
                ctx.from.username
            );
            
            await ctx.reply(`Thanks for sharing your voice message! 🎤 I've saved your introduction.`);
            await ctx.reply(`Welcome aboard, ${updatedUser.name || updatedUser.firstName}! 🎉 I'm so excited to be your journal buddy. Let's start this journey together!`);
            await showMainMenu(ctx, updatedUser);
            
            // Clean up
            fs.unlinkSync(localFilePath);
        } catch (error) {
            journalBotLogger.error('Error processing voice message for bio:', error);
            await ctx.reply("Sorry, I had trouble processing your voice message. Could you try sending a text message instead?");
        }
    } else if (('video_note' in ctx.message && ctx.message.video_note) || ('video' in ctx.message && ctx.message.video) && ctx.session.onboardingStep === 'bio') {
        // Handle video message for bio
        try {
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
                journalBotLogger.error('Error transcribing video for bio:', transcriptionError);
                transcription = "Could not transcribe audio from video. The video might not have clear audio.";
            }
            
            // Delete wait message
            if (ctx.chat) {
                await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);
            }
            
            // Save bio
            await updateUserProfile(ctx.from.id, { bio: transcription, onboardingCompleted: true });
            
            // Get updated user
            const updatedUser = await findOrCreateUser(
                ctx.from.id,
                ctx.from.first_name,
                ctx.from.last_name,
                ctx.from.username
            );
            
            await ctx.reply(`Thanks for sharing your video! 📹 I've saved your introduction.`);
            await ctx.reply(`Welcome aboard, ${updatedUser.name || updatedUser.firstName}! 🎉 I'm so excited to be your journal buddy. Let's start this journey together!`);
            await showMainMenu(ctx, updatedUser);
            
            // Clean up
            fs.unlinkSync(localFilePath);
        } catch (error) {
            journalBotLogger.error('Error processing video message for bio:', error);
            await ctx.reply("Sorry, I had trouble processing your video. Could you try sending a text message instead?");
        }
    } else {
        await ctx.reply('Please send a text message, voice message, or video to continue with the setup.');
    }
}

// Show main menu
async function showMainMenu(ctx: JournalBotContext, user: IUser) {
    const keyboard = new Keyboard()
        .text("📝 Create New Entry")
        .row()
        .text("📚 View Journal History")
        .row()
        .text("💬 Chat About My Journal")
        .resized();
    
    await ctx.reply(`Hey ${user.name || user.firstName}! 😊 What's on your mind today?`, {
        reply_markup: keyboard
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
            text === "✅ Finish Entry" ||
            text === "🔍 Go Deeper, Ask Me" ||
            text === "❌ Cancel Entry" ||
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
        await ctx.reply("Could not find your active journal entry. Let's start a new one.");
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
            await ctx.reply(`📝 *Transcription of your voice message:*\n\n${transcription}`, {
                parse_mode: 'Markdown'
            });
            
            // Clean up
            fs.unlinkSync(localFilePath);
        } catch (error) {
            journalBotLogger.error('Error processing voice message:', error);
            await ctx.reply("Sorry, I had trouble processing your voice message. Please try again or send a text message instead.");
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
            await ctx.reply(`📝 *Transcription of your video message:*\n\n${transcription}`, {
                parse_mode: 'Markdown'
            });
            
            // Clean up
            fs.unlinkSync(localFilePath);
        } catch (error) {
            journalBotLogger.error('Error processing video message:', error);
            await ctx.reply("Sorry, I had trouble processing your video. Please try again or send a text message instead.");
        }
    } else {
        await ctx.reply("I can only accept text, voice messages, and videos for your journal entries.");
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
        // Generate comprehensive analysis
        const analysis = await analyzeJournalEntry(entry, user);
        
        // Generate personalized insights
        const systemPrompt = `You are an empathetic and insightful journal assistant.
Based on the user's journal entry and their reflections, provide personalized insights and suggestions.
Focus on identifying patterns, growth opportunities, and actionable suggestions.
Be supportive, encouraging, and constructive in your insights.

Format your response as 3 concise bullet points that highlight only the most important observations and suggestions.
Each bullet point should be 1 sentence maximum and start with "• ".
Focus on the most significant aspects: key insights, main patterns, and one actionable next step.`;

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
- Age: ${user.age || 'Unknown'}
- Gender: ${user.gender || 'Unknown'}
- Religion: ${user.religion || 'Unknown'}
- Occupation: ${user.occupation || 'Unknown'}`;

        const chatMessages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `${userInfo}\n\nJournal Entry and Reflections:\n${entryContent}\n\nAnalysis:\n${analysis}\n\nPlease provide 3 key insights and suggestions as bullet points.` }
        ];
        
        // Call OpenAI API
        const response = await openai.chat.completions.create({
            model: GPT_VERSION,
            messages: chatMessages,
            temperature: 0.7,
            max_tokens: 300
        });
        
        const insights = response.choices[0].message.content || 
            "Thank you for sharing your thoughts. Keep journaling regularly to build a meaningful record of your experiences and growth.";
        
        // Complete the entry
        await completeJournalEntry(entryId, analysis, insights);
        
        // Delete wait message
        if (ctx.chat) {
            await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);
        }
        
        // Send a single formatted message with analysis and insights
        const formattedMessage = `Good job, ${user.name || user.firstName}! ✨ One more important entry created.\n\n📝 **Key thoughts:**\n\n${analysis}\n\n💡 **Ideas:**\n\n${insights}`;
        
        await ctx.reply(formattedMessage, {
            parse_mode: 'Markdown'
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
        await ctx.reply(`Hey ${user.name || user.firstName}, you don't have an active journal entry yet. Let's create one first!`);
        await showMainMenu(ctx, user);
        return;
    }
    
    try {
        const entryId = new Types.ObjectId(ctx.session.journalEntryId);
        const entry = await getJournalEntryById(entryId);
        
        if (!entry) {
            ctx.session.journalEntryId = undefined;
            await ctx.reply(`Hmm, I can't seem to find your journal entry. Let's start fresh!`);
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
            const questionsText = questions.map((q: string, i: number) => `${i + 1}. ${q}`).join('\n\n');
            await ctx.reply(`I've been thinking about what you shared, ${user.name || user.firstName}... 🤔\n\n**Questions to ponder:**\n\n${questionsText}`, {
                parse_mode: 'Markdown'
            });
        }
        
        // Show the same keyboard as initial entry
        const keyboard = new Keyboard()
            .text("✅ Finish Entry")
            .row()
            .text("🔍 Go Deeper, Ask Me")
            .row()
            .text("❌ Cancel Entry")
            .resized();
        
        await ctx.reply(`Feel free to share your thoughts on these questions, or we can wrap up whenever you're ready!`, {
            reply_markup: keyboard
        });
        
    } catch (error) {
        logger.error('Error in Analyze Journal handler:', error);
        await ctx.reply(`Oops! My brain got a little fuzzy there. Let's try again later, ${user.name || user.firstName}!`);
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
        await ctx.reply(`${user.name || user.firstName}, you don't have any journal entries yet. Let's create some first so we can chat about them!`);
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
        await ctx.reply(insights);
        
        // Prompt for another question
        await ctx.reply(`Anything else you'd like to know about your journal, ${user.name || user.firstName}? I'm all ears! 👂`);
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
            await ctx.reply(`I heard you ask: *${transcription}*`, {
                parse_mode: 'Markdown'
            });
            
            // Generate insights based on transcribed question using all entries
            const insights = await generateJournalInsights(allEntries, user, transcription);
            
            // Delete wait message
            if (ctx.chat) {
                await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);
            }
            
            // Send insights to user
            await ctx.reply(insights);
            
            // Prompt for another question
            await ctx.reply(`Any other questions about your journaling journey, ${user.name || user.firstName}?`);
            
            // Clean up
            fs.unlinkSync(localFilePath);
        } catch (error) {
            journalBotLogger.error('Error processing voice message in chat mode:', error);
            await ctx.reply(`Sorry ${user.name || user.firstName}, I had trouble understanding your voice message. Could you try again or type your question?`);
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
            await ctx.reply(`From your video, I heard: *${transcription}*`, {
                parse_mode: 'Markdown'
            });
            
            // Generate insights based on transcribed question using all entries
            const insights = await generateJournalInsights(allEntries, user, transcription);
            
            // Delete wait message
            if (ctx.chat) {
                await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);
            }
            
            // Send insights to user
            await ctx.reply(insights);
            
            // Prompt for another question
            await ctx.reply(`Got any more questions for me, ${user.name || user.firstName}? I'm loving our chat!`);
            
            // Clean up
            fs.unlinkSync(localFilePath);
        } catch (error) {
            journalBotLogger.error('Error processing video message in chat mode:', error);
            await ctx.reply(`Oops! I had trouble with your video, ${user.name || user.firstName}. Mind trying again or sending a text message?`);
        }
    } else {
        await ctx.reply(`${user.name || user.firstName}, you can ask me anything about your journal entries! Send me a text, voice message, or video with your question. Or type '❌ Exit Chat Mode' if you want to go back to the main menu.`);
    }
}

// Handle "Go Deeper" button
async function handleGoDeeper(ctx: JournalBotContext) {
    const user = await findOrCreateUser(ctx.from?.id || 0, ctx.from?.username || '', ctx.from?.first_name || '');
    
    if (!ctx.session.journalEntryId) {
        await ctx.reply(`Hey ${user.name || user.firstName}, you don't have an active journal entry. Let's start a new one first!`);
        await showMainMenu(ctx, user);
        return;
    }
    
    try {
        const entryId = new Types.ObjectId(ctx.session.journalEntryId);
        const entry = await getJournalEntryById(entryId);
        
        if (!entry) {
            ctx.session.journalEntryId = undefined;
            await ctx.reply(`Hmm, I can't find your active journal entry. Let's start fresh!`);
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
        const systemPrompt = `You are a friendly, insightful journal assistant with a warm personality.
You help users reflect more deeply on their experiences in a conversational, supportive way.
Based on the user's journal entry, their responses to previous questions, and the previous analysis,
generate a brief preliminary analysis (1 sentence) that identifies the most significant pattern or insight.
Then, generate 2 deeper, more probing questions that will help the user gain new insights.
Make your tone warm, friendly, and slightly playful - like a smart friend who asks great questions.
Format your response as a JSON object with the following structure:
{
  "analysis": "Your brief preliminary analysis here",
  "questions": [
    "First deeper question here?",
    "Second deeper question here?"
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
            
            await ctx.reply(`Oops! My brain got a little tangled there. Let's try again later, ${user.name || user.firstName}!`);
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
            questionsText = deeperQuestions.map((q: string, i: number) => `${i + 1}. ${q}`).join('\n\n');
        }
        
        const formattedMessage = `${deeperAnalysis}\n\n🤔 **Let's dig a bit deeper:**\n\n${questionsText}`;
        
        await ctx.reply(formattedMessage, {
            parse_mode: 'Markdown'
        });
        
        // Show the keyboard with options
        const keyboard = new Keyboard()
            .text("✅ Finish Entry")
            .row()
            .text("🔍 Go Deeper, Ask Me")
            .row()
            .text("❌ Cancel Entry")
            .resized();
        
        await ctx.reply(`What are your thoughts on these questions, ${user.name || user.firstName}? Or would you like to wrap up this entry?`, {
            reply_markup: keyboard
        });
        
    } catch (error) {
        logger.error('Error in Go Deeper handler:', error);
        await ctx.reply(`Something went wrong with my thinking cap, ${user.name || user.firstName}! Let's try again later.`);
        await showMainMenu(ctx, user);
    }
}

// Export the bot
export { bot as journalBot }; 