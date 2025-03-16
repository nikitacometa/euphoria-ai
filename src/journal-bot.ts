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
    // Reply to the original message with the transcription in a single message
    await ctx.reply(`<b>Text:</b>\n\n<code>${transcription}</code>`, {
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
    
    // Create keyboard with user's Telegram name
    const keyboard = new Keyboard()
        .text(ctx.from.first_name)
        .resized();

    await ctx.reply("What's your name? You can use your Telegram name or type a different one.", {
        reply_markup: keyboard,
        parse_mode: 'HTML'
    });
});

// Register the start command
bot.command('start', handleStartCommand);

// Register main menu button handlers
bot.hears("New Entry", async (ctx) => {
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
            .text("Save")
            .row()
            .text("Let's Go Deeper! Ask questions")
            .row()
            .text("Cancel")
            .resized();
        
        await ctx.reply(`<b>Hey ${user.name || user.firstName}!</b>\n\nYou already have an entry in progress. Want to continue where you left off? You can add more thoughts or choose an option below:`, {
            reply_markup: keyboard,
            parse_mode: 'HTML'
        });
    } else {
        // Create new entry
        const entry = await createJournalEntry(user._id as unknown as Types.ObjectId);
        ctx.session.journalEntryId = entry._id?.toString() || '';
        
        const keyboard = new Keyboard()
            .text("Save")
            .row()
            .text("Let's Go Deeper! Ask questions")
            .row()
            .text("Cancel")
            .resized();
        
        await ctx.reply(`<b>Let's create a new journal entry, ${user.name || user.firstName}!</b> 📝✨\n\nShare whatever's on your mind - your thoughts, feelings, experiences... anything at all! You can send text, voice messages, or videos.\n\nI'm here to listen and help you reflect. When you're ready, just choose one of the options below:`, {
            reply_markup: keyboard,
            parse_mode: 'HTML'
        });
    }
});

bot.hears("Journal History", async (ctx) => {
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
        await ctx.reply(`<b>${user.name || user.firstName}</b>, you haven't created any journal entries yet. Let's start your journaling journey today!`, {
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
    
    await ctx.reply(`<b>Here's your journaling history, ${user.name || user.firstName}!</b> 📚\n\nTap on any entry to view it:`, {
        reply_markup: keyboard,
        parse_mode: 'HTML'
    });
});

bot.hears("Ask My Journal", async (ctx) => {
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
    
    await ctx.reply(`<b>Hey ${user.name || user.firstName}!</b> 💬\n\nI'm all ears and ready to chat about your journal entries!\n\nYou can ask me things like:\n\n<i>• "What patterns do you notice in my entries?"</i>\n<i>• "How have my feelings changed over time?"</i>\n<i>• "What insights can you give me about my recent experiences?"</i>\n\nJust ask away - I'll do my best to give you thoughtful insights!`, {
        reply_markup: keyboard,
        parse_mode: 'HTML'
    });
});

// Register entry action button handlers
bot.hears("Save", async (ctx) => {
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

bot.hears("Let's Go Deeper! Ask questions", async (ctx) => {
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
    
    await handleGoDeeper(ctx);
});

bot.hears("Cancel", async (ctx) => {
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
    await ctx.reply(`<b>No worries, ${user.name || user.firstName}!</b> I've canceled this entry. We can start fresh whenever you're ready.`, {
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
    await ctx.reply(`<b>Alright ${user.name || user.firstName}!</b> We're back to the main menu. Let me know if you want to chat again later.`, {
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
            text === "New Entry" ||
            text === "Journal History" ||
            text === "Ask My Journal" ||
            text === "Save" ||
            text === "Let's Go Deeper! Ask questions" ||
            text === "Cancel" ||
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
            await ctx.reply(`Nice to meet you, ${text}! What's your age range?`, {
                reply_markup: ageKeyboard,
                parse_mode: 'HTML'
            });
            break;
        }
        case 'age': {
            if (!isValidAgeRange(text)) {
                await ctx.reply("Please select a valid age range from the options provided.");
                return;
            }
            const userWithAge = await updateUserProfile(ctx.from.id, { age: text });
            ctx.session.onboardingStep = 'gender';
            await ctx.reply("How do you identify yourself?", {
                reply_markup: genderKeyboard,
                parse_mode: 'HTML'
            });
            break;
        }
        case 'gender': {
            if (!isValidGender(text)) {
                await ctx.reply("Please select a valid option from the choices provided.");
                return;
            }
            const userWithGender = await updateUserProfile(ctx.from.id, { gender: text });
            ctx.session.onboardingStep = 'occupation';
            await ctx.reply("What do you do? (Your occupation or role)", {
                reply_markup: { remove_keyboard: true },
                parse_mode: 'HTML'
            });
            break;
        }
        case 'occupation': {
            const userWithOccupation = await updateUserProfile(ctx.from.id, { occupation: text });
            ctx.session.onboardingStep = 'bio';
            await ctx.reply("Tell me a bit about yourself - what makes you, you? 😊", {
                parse_mode: 'HTML'
            });
            break;
        }
        case 'bio': {
            const user = await updateUserProfile(ctx.from.id, { bio: text, onboardingCompleted: true });
            if (!user) return;

            ctx.session.onboardingStep = undefined;
            
            // Send user info message with proper formatting
            const userInfo = `<b>Profile Info:</b>\n\nName: ${user.name}\nAge: ${user.age}\nGender: ${user.gender}\nOccupation: ${user.occupation}\nBio: ${user.bio}`;
            await ctx.reply(userInfo, { parse_mode: 'HTML' });
            
            // Show main menu immediately without welcome message
            await showMainMenu(ctx, user);
            break;
        }
    }
}

// Show main menu
async function showMainMenu(ctx: JournalBotContext, user: IUser) {
    const keyboard = new Keyboard()
        .text("New Entry")
        .row()
        .text("Journal History")
        .row()
        .text("Ask My Journal")
        .resized();
    
    await ctx.reply(`So, ${user.name || user.firstName}… Wanna share something cool or just casually explore yourself? 😏`, {
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
            text === "Save" ||
            text === "Let's Go Deeper! Ask questions" ||
            text === "Cancel" ||
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
            await sendTranscriptionReply(ctx, ctx.message.message_id, transcription);
            
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
            await sendTranscriptionReply(ctx, ctx.message.message_id, transcription);
            
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
        // Generate a concise 1-sentence summary
        const systemPrompt = `You are a warm, empathetic, and insightful journal assistant with a friendly personality.
Your task is to analyze the user's journal entry and provide:
1. A single-sentence summary that captures the essence of their entry
2. One thoughtful, non-trivial question for reflection that helps them think more deeply about what they shared

The summary should be concise but insightful, capturing the core emotion or experience.
The question should be open-ended and thought-provoking, not requiring an immediate answer.
It should encourage deeper reflection about emotions, patterns, next steps, or broader implications.

Format your response as a JSON object with the following structure:
{
  "summary": "Your one-sentence summary here.",
  "question": "Your thoughtful question here?"
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
        const formattedMessage = `<b>Good job, ${user.name || user.firstName}! ✨ Entry saved.</b>\n\n<b>📝 Summary:</b>\n${summary}\n\n<b>💭 Something to reflect on:</b>\n<i>${question}</i>`;
        
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
            await ctx.reply(`<b>I've been thinking about what you shared, ${user.name || user.firstName}... 🤔</b>\n\n<b>Questions to ponder:</b>\n\n${questionsText}`, {
                parse_mode: 'HTML'
            });
        }
        
        // Show the same keyboard as initial entry
        const keyboard = new Keyboard()
            .text("Save")
            .row()
            .text("Let's Go Deeper! Ask questions")
            .row()
            .text("Cancel")
            .resized();
        
        await ctx.reply(`<b>Feel free to share your thoughts on these questions</b>, or we can wrap up whenever you're ready!`, {
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
        await ctx.reply(`<b>${user.name || user.firstName}</b>, you don't have any journal entries yet. Let's create some first so we can chat about them!`, {
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
        await ctx.reply(`<b>Anything else you'd like to know about your journal, ${user.name || user.firstName}?</b> I'm all ears! 👂`, {
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
            await ctx.reply(`<b>Sorry ${user.name || user.firstName}</b>, I had trouble understanding your voice message. Could you try again or type your question?`, {
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
        await ctx.reply(`<b>${user.name || user.firstName}</b>, you can ask me anything about your journal entries! Send me a text, voice message, or video with your question. Or type '❌ Exit Chat Mode' if you want to return to the main menu.`, {
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
            await ctx.reply(`<b>Hmm, I can't find your active journal entry.</b> Let's start fresh!`, {
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
        
        // Show the keyboard with options
        const keyboard = new Keyboard()
            .text("Save")
            .row()
            .text("Let's Go Deeper! Ask questions")
            .row()
            .text("Cancel")
            .resized();
        
        await ctx.reply(`<b>What are your thoughts on these questions, ${user.name || user.firstName}?</b> Or would you like to wrap up this entry?`, {
            reply_markup: keyboard
        });
        
    } catch (error) {
        logger.error('Error in Go Deeper handler:', error);
        await ctx.reply(`<b>Something went wrong with my thinking cap, ${user.name || user.firstName}!</b> Let's try again later.`, {
            parse_mode: 'HTML'
        });
        await showMainMenu(ctx, user);
    }
}

// Export the bot
export { bot as journalBot }; 