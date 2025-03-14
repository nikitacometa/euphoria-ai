import { Bot, Context, InlineKeyboard, Keyboard, session, SessionFlavor } from 'grammy';
import { TELEGRAM_API_TOKEN, LOG_LEVEL, GPT_VERSION } from './config';
import { 
    connectToDatabase, 
    findOrCreateUser,
    updateUserProfile,
    updateUserLanguage,
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
import { Language, getTextForUser, getText, updateText, reloadTexts, texts } from './utils/localization';

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

// Helper function to send transcription as a reply
async function sendTranscriptionReply(ctx: Context, messageId: number, transcription: string, user: IUser): Promise<void> {
    // Reply to the original message with the transcription in a single message
    await ctx.reply(getTextForUser('transcriptionText', user, { transcription }), {
        reply_to_message_id: messageId,
        parse_mode: 'HTML'
    });
}

// Define session interface
interface JournalBotSession {
    onboardingStep?: 'language' | 'name' | 'age' | 'gender' | 'occupation' | 'bio' | 'complete';
    journalEntryId?: string;
    journalChatMode?: boolean;
    waitingForJournalQuestion?: boolean;
    settingsMode?: boolean;
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
        // Start onboarding with language selection
        ctx.session.onboardingStep = 'language';
        
        // Create language selection keyboard
        const languageKeyboard = new Keyboard()
            .text("English 🇬🇧")
            .text("Русский 🇷🇺")
            .resized();
        
        await ctx.reply('Please select your preferred language / Пожалуйста, выберите предпочитаемый язык:', {
            reply_markup: languageKeyboard
        });
    }
});

// Register the start command
bot.command('start', handleStartCommand);

// Register main menu button handlers
bot.hears(["📝 Create New Entry", "📝 Создать новую запись"], async (ctx) => {
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
            .text(getTextForUser('finishEntry', user))
            .row()
            .text(getTextForUser('goDeeper', user))
            .row()
            .text(getTextForUser('cancelEntry', user))
            .resized();
        
        await ctx.reply(getTextForUser('continueEntry', user), {
            reply_markup: keyboard,
            parse_mode: 'HTML'
        });
    } else {
        // Create new entry
        const entry = await createJournalEntry(user._id as unknown as Types.ObjectId);
        ctx.session.journalEntryId = entry._id?.toString() || '';
        
        const keyboard = new Keyboard()
            .text(getTextForUser('finishEntry', user))
            .row()
            .text(getTextForUser('goDeeper', user))
            .row()
            .text(getTextForUser('cancelEntry', user))
            .resized();
        
        await ctx.reply(getTextForUser('newEntry', user), {
            reply_markup: keyboard,
            parse_mode: 'HTML'
        });
    }
});

bot.hears(["📚 View Journal History", "📚 Просмотр истории дневника"], async (ctx) => {
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
        await ctx.reply(getTextForUser('noEntries', user), {
            parse_mode: 'HTML'
        });
        await showMainMenu(ctx, user);
        return;
    }
    
    // Create inline keyboard with entries
    const keyboard = new InlineKeyboard();
    
    entries.slice(0, 10).forEach((entry) => {
        // Format date as [HH:MM DD/MM/YY]
        const date = new Date(entry.createdAt);
        const formattedDate = `[${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')} ${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear().toString().slice(-2)}]`;
        
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
    
    await ctx.reply(getTextForUser('journalHistory', user), {
        reply_markup: keyboard,
        parse_mode: 'HTML'
    });
});

bot.hears(["💬 Chat About My Journal", "💬 Обсудить мой дневник"], async (ctx) => {
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
        await ctx.reply(getTextForUser('noChatEntries', user), {
            parse_mode: 'HTML'
        });
        await showMainMenu(ctx, user);
        return;
    }
    
    // Enter journal chat mode
    ctx.session.journalChatMode = true;
    ctx.session.waitingForJournalQuestion = true;
    
    const keyboard = new Keyboard()
        .text(getTextForUser('exitChatMode', user))
        .resized();
    
    await ctx.reply(getTextForUser('chatIntro', user), {
        reply_markup: keyboard,
        parse_mode: 'HTML'
    });
});

// Add handler for Analyze Today
bot.hears(["📊 Analyze Today", "📊 Анализ сегодняшнего дня"], async (ctx) => {
    if (!ctx.from) return;
    
    const user = await findOrCreateUser(
        ctx.from.id,
        ctx.from.first_name,
        ctx.from.last_name,
        ctx.from.username
    );
    
    await handleAnalyzeToday(ctx, user);
});

// Add handler for Settings
bot.hears(["⚙️ Settings", "⚙️ Настройки"], async (ctx) => {
    if (!ctx.from) return;
    
    const user = await findOrCreateUser(
        ctx.from.id,
        ctx.from.first_name,
        ctx.from.last_name,
        ctx.from.username
    );
    
    ctx.session.settingsMode = true;
    await showSettings(ctx, user);
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

// Register entry action button handlers
bot.hears(["✅ Finish Entry", "✅ Завершить запись"], async (ctx) => {
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

bot.hears(["🔍 Go Deeper, Ask Me", "🔍 Копнуть глубже"], async (ctx) => {
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

bot.hears(["❌ Cancel Entry", "❌ Отменить запись"], async (ctx) => {
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
    await ctx.reply(getTextForUser('entryCanceled', user), {
        parse_mode: 'HTML'
    });
    await showMainMenu(ctx, user);
});

// Handle "Finish Reflection" button
bot.hears(["✅ Finish Reflection"], async (ctx) => {
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
bot.hears(["❌ Exit Chat Mode", "❌ Выйти из режима обсуждения"], async (ctx) => {
    if (!ctx.from) return;
    
    const user = await findOrCreateUser(
        ctx.from.id,
        ctx.from.first_name,
        ctx.from.last_name,
        ctx.from.username
    );
    
    ctx.session.journalChatMode = false;
    ctx.session.waitingForJournalQuestion = false;
    await ctx.reply(getTextForUser('exitedChatMode', user), {
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
                    content = getTextForUser('voiceTranscription', user, { transcription: message.transcription || 'No transcription available' });
                } else if (message.type === MessageType.VIDEO) {
                    content = getTextForUser('videoTranscription', user, { transcription: message.transcription || 'No transcription available' });
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
            await ctx.reply(getTextForUser('journalEntry', user, {
                date,
                time,
                content: entryContent,
                analysis: entry.analysis || 'No analysis available'
            }), {
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
            await ctx.reply(getTextForUser('noEntries', user), {
                parse_mode: 'HTML'
            });
            await showMainMenu(ctx, user);
            return;
        }
        
        // Create inline keyboard with entries
        const keyboard = new InlineKeyboard();
        
        entries.slice(0, 10).forEach((entry) => {
            // Format date as [HH:MM DD/MM/YY]
            const date = new Date(entry.createdAt);
            const formattedDate = `[${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')} ${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear().toString().slice(-2)}]`;
            
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
        
        await ctx.reply(getTextForUser('journalHistory', user), {
            reply_markup: keyboard,
            parse_mode: 'HTML'
        });
    }
    
    if (data === 'change_language') {
        await ctx.answerCallbackQuery();
        
        // Create language selection keyboard
        const languageKeyboard = new Keyboard()
            .text("English 🇬🇧")
            .text("Русский 🇷🇺")
            .row()
            .text(getTextForUser('backToMainMenu', user))
            .resized();
        
        await ctx.reply('Please select your preferred language / Пожалуйста, выберите предпочитаемый язык:', {
            reply_markup: languageKeyboard
        });
    }
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
    
    // If user is in settings mode
    if (ctx.session.settingsMode) {
        await handleSettings(ctx, user);
        return;
    }
    
    // Handle text messages
    if ('text' in ctx.message) {
        const text = ctx.message.text || '';
        
        // Check for main menu options in both languages
        const createEntryEN = getText('createNewEntry', Language.ENGLISH);
        const createEntryRU = getText('createNewEntry', Language.RUSSIAN);
        
        const viewHistoryEN = getText('viewJournalHistory', Language.ENGLISH);
        const viewHistoryRU = getText('viewJournalHistory', Language.RUSSIAN);
        
        const chatAboutJournalEN = getText('chatAboutJournal', Language.ENGLISH);
        const chatAboutJournalRU = getText('chatAboutJournal', Language.RUSSIAN);
        
        const analyzeTodayEN = getText('analyzeToday', Language.ENGLISH);
        const analyzeTodayRU = getText('analyzeToday', Language.RUSSIAN);
        
        const settingsEN = getText('settings', Language.ENGLISH);
        const settingsRU = getText('settings', Language.RUSSIAN);
        
        const finishEntryEN = getText('finishEntry', Language.ENGLISH);
        const finishEntryRU = getText('finishEntry', Language.RUSSIAN);
        
        const goDeeperEN = getText('goDeeper', Language.ENGLISH);
        const goDeeperRU = getText('goDeeper', Language.RUSSIAN);
        
        const cancelEntryEN = getText('cancelEntry', Language.ENGLISH);
        const cancelEntryRU = getText('cancelEntry', Language.RUSSIAN);
        
        const exitChatModeEN = getText('exitChatMode', Language.ENGLISH);
        const exitChatModeRU = getText('exitChatMode', Language.RUSSIAN);
        
        // Skip if it's a button we handle elsewhere
        if (
            text === createEntryEN || text === createEntryRU ||
            text === viewHistoryEN || text === viewHistoryRU ||
            text === chatAboutJournalEN || text === chatAboutJournalRU ||
            text === analyzeTodayEN || text === analyzeTodayRU ||
            text === settingsEN || text === settingsRU ||
            text === finishEntryEN || text === finishEntryRU ||
            text === goDeeperEN || text === goDeeperRU ||
            text === cancelEntryEN || text === cancelEntryRU ||
            text === exitChatModeEN || text === exitChatModeRU
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
            case 'language':
                let language: Language;
                
                // Set language based on selection
                if (text === "English 🇬🇧") {
                    language = Language.ENGLISH;
                } else if (text === "Русский 🇷🇺") {
                    language = Language.RUSSIAN;
                } else {
                    // Default to English if invalid selection
                    language = Language.ENGLISH;
                }
                
                // Update user's language preference
                user = await updateUserLanguage(ctx.from.id, language) || user;
                
                // Move to name step
                ctx.session.onboardingStep = 'name';
                
                // Send welcome message in selected language
                await ctx.reply(getTextForUser('welcome', user), {
                    parse_mode: 'HTML'
                });
                break;
                
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
                
                await ctx.reply(getTextForUser('niceMeet', user, { name: text }), {
                    reply_markup: ageKeyboard,
                    parse_mode: 'HTML'
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
                
                await ctx.reply(getTextForUser('thanks', user), {
                    reply_markup: genderKeyboard,
                    parse_mode: 'HTML'
                });
                break;
                
            case 'gender':
                await updateUserProfile(ctx.from.id, { gender: text });
                ctx.session.onboardingStep = 'occupation';
                await ctx.reply(getTextForUser('gotIt', user), {
                    parse_mode: 'HTML'
                });
                break;
                
            case 'occupation':
                await updateUserProfile(ctx.from.id, { occupation: text });
                ctx.session.onboardingStep = 'bio';
                
                await ctx.reply(getTextForUser('almostDone', user), {
                    reply_markup: { remove_keyboard: true },
                    parse_mode: 'HTML'
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
                
                await ctx.reply(getTextForUser('amazing', updatedUser), {
                    parse_mode: 'HTML'
                });
                await showMainMenu(ctx, updatedUser);
                break;
        }
    } else if ('voice' in ctx.message && ctx.message.voice && ctx.session.onboardingStep === 'bio') {
        // Handle voice message for bio
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
            
            // Reply to the original message with the transcription
            await sendTranscriptionReply(ctx, ctx.message.message_id, transcription, user);
            
            // Parse bio information
            const { parsedBio, structuredInfo } = await parseBioInformation(transcription);
            
            // Save bio with both raw transcription and parsed information
            await updateUserProfile(ctx.from.id, { 
                bio: transcription,
                parsedBio: parsedBio,
                onboardingCompleted: true 
            });
            
            // Delete wait message
            if (ctx.chat) {
                await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);
            }
            
            // Get updated user
            const updatedUser = await findOrCreateUser(
                ctx.from.id,
                ctx.from.first_name,
                ctx.from.last_name,
                ctx.from.username
            );
            
            // Send the structured information
            await ctx.reply(`${structuredInfo}`, {
                parse_mode: 'HTML'
            });
            
            await ctx.reply(getTextForUser('welcomeAboard', updatedUser), {
                parse_mode: 'HTML'
            });
            await showMainMenu(ctx, updatedUser);
            
            // Clean up
            fs.unlinkSync(localFilePath);
        } catch (error) {
            journalBotLogger.error('Error processing voice message for bio:', error);
            await ctx.reply(getTextForUser('errorProcessingVoice', user));
        }
    } else if (('video_note' in ctx.message && ctx.message.video_note) || ('video' in ctx.message && ctx.message.video) && ctx.session.onboardingStep === 'bio') {
        // Handle video message for bio
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
                journalBotLogger.error('Error transcribing video for bio:', transcriptionError);
                transcription = "Could not transcribe audio from video. The video might not have clear audio.";
            }
            
            // Reply to the original message with the transcription
            await sendTranscriptionReply(ctx, ctx.message.message_id, transcription, user);
            
            // Parse bio information
            const { parsedBio, structuredInfo } = await parseBioInformation(transcription);
            
            // Save bio with both raw transcription and parsed information
            await updateUserProfile(ctx.from.id, { 
                bio: transcription,
                parsedBio: parsedBio,
                onboardingCompleted: true 
            });
            
            // Delete wait message
            if (ctx.chat) {
                await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);
            }
            
            // Get updated user
            const updatedUser = await findOrCreateUser(
                ctx.from.id,
                ctx.from.first_name,
                ctx.from.last_name,
                ctx.from.username
            );
            
            // Send the structured information
            await ctx.reply(`${structuredInfo}`, {
                parse_mode: 'HTML'
            });
            
            await ctx.reply(getTextForUser('welcomeAboard', updatedUser), {
                parse_mode: 'HTML'
            });
            await showMainMenu(ctx, updatedUser);
            
            // Clean up
            fs.unlinkSync(localFilePath);
        } catch (error) {
            journalBotLogger.error('Error processing video message for bio:', error);
            await ctx.reply(getTextForUser('errorProcessingVideo', user));
        }
    } else {
        await ctx.reply('Please send a text message, voice message, or video to continue with the setup.');
    }
}

// Show main menu
async function showMainMenu(ctx: JournalBotContext, user: IUser) {
    const keyboard = new Keyboard()
        .text(getTextForUser('createNewEntry', user))
        .row()
        .text(getTextForUser('viewJournalHistory', user))
        .row()
        .text(getTextForUser('chatAboutJournal', user))
        .row()
        .text(getTextForUser('analyzeToday', user))
        .row()
        .text(getTextForUser('settings', user))
        .resized();
    
    await ctx.reply(getTextForUser('mainMenu', user), {
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
            await sendTranscriptionReply(ctx, ctx.message.message_id, transcription, user);
            
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
            await sendTranscriptionReply(ctx, ctx.message.message_id, transcription, user);
            
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
            .text("✅ Finish Entry")
            .row()
            .text("🔍 Go Deeper, Ask Me")
            .row()
            .text("❌ Cancel Entry")
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

// Show settings menu
async function showSettings(ctx: JournalBotContext, user: IUser) {
    const keyboard = new Keyboard()
        .text(getTextForUser('changeLanguage', user))
        .row()
        .text(getTextForUser('backToMainMenu', user))
        .resized();
    
    await ctx.reply(getTextForUser('settingsTitle', user), {
        reply_markup: keyboard,
        parse_mode: 'HTML'
    });
}

// Handle settings menu
async function handleSettings(ctx: JournalBotContext, user: IUser) {
    if (!ctx.message || !ctx.from) return;
    
    // Handle text messages for settings
    if ('text' in ctx.message) {
        const text = ctx.message.text || '';
        
        // Check for language change option
        const changeLanguageEN = getText('changeLanguage', Language.ENGLISH);
        const changeLanguageRU = getText('changeLanguage', Language.RUSSIAN);
        
        const backToMainMenuEN = getText('backToMainMenu', Language.ENGLISH);
        const backToMainMenuRU = getText('backToMainMenu', Language.RUSSIAN);
        
        if (text === changeLanguageEN || text === changeLanguageRU) {
            // Create language selection keyboard
            const languageKeyboard = new Keyboard()
                .text("English 🇬🇧")
                .text("Русский 🇷🇺")
                .row()
                .text(getTextForUser('backToMainMenu', user))
                .resized();
            
            await ctx.reply('Please select your preferred language / Пожалуйста, выберите предпочитаемый язык:', {
                reply_markup: languageKeyboard
            });
        } else if (text === "English 🇬🇧") {
            // Update user's language to English
            await updateUserLanguage(ctx.from.id, Language.ENGLISH);
            
            // Get updated user
            const updatedUser = await findOrCreateUser(
                ctx.from.id,
                ctx.from.first_name,
                ctx.from.last_name,
                ctx.from.username
            );
            
            await ctx.reply(getTextForUser('languageChanged', updatedUser), {
                parse_mode: 'HTML'
            });
            
            // Exit settings mode
            ctx.session.settingsMode = false;
            await showMainMenu(ctx, updatedUser);
        } else if (text === "Русский 🇷🇺") {
            // Update user's language to Russian
            await updateUserLanguage(ctx.from.id, Language.RUSSIAN);
            
            // Get updated user
            const updatedUser = await findOrCreateUser(
                ctx.from.id,
                ctx.from.first_name,
                ctx.from.last_name,
                ctx.from.username
            );
            
            await ctx.reply(getTextForUser('languageChanged', updatedUser), {
                parse_mode: 'HTML'
            });
            
            // Exit settings mode
            ctx.session.settingsMode = false;
            await showMainMenu(ctx, updatedUser);
        } else if (text === backToMainMenuEN || text === backToMainMenuRU) {
            // Exit settings mode
            ctx.session.settingsMode = false;
            await showMainMenu(ctx, user);
        } else {
            // Unknown option, show settings menu again
            await showSettings(ctx, user);
        }
    }
}

// Handle Analyze Today feature
async function handleAnalyzeToday(ctx: JournalBotContext, user: IUser) {
    // Get today's entries
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Get user's journal entries from today
    const entries = await getUserJournalEntries(
        user._id as unknown as Types.ObjectId
    ).then(allEntries => 
        allEntries.filter(entry => {
            const entryDate = new Date(entry.createdAt);
            return entryDate >= today && entryDate < tomorrow;
        })
    );
    
    if (entries.length === 0) {
        await ctx.reply(getTextForUser('noTodayEntries', user), {
            parse_mode: 'HTML'
        });
        await showMainMenu(ctx, user);
        return;
    }
    
    // Send wait message with sand clock emoji
    const waitMsg = await ctx.reply("⏳");
    
    try {
        // Generate insights based on today's entries
        const question = "Analyze my entries from today and provide insights about my day, mood, and experiences.";
        const analysis = await generateJournalInsights(entries, user, question);
        
        // Delete wait message
        if (ctx.chat) {
            await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);
        }
        
        // Enter journal chat mode
        ctx.session.journalChatMode = true;
        ctx.session.waitingForJournalQuestion = true;
        
        const keyboard = new Keyboard()
            .text(getTextForUser('exitChatMode', user))
            .resized();
        
        // Send analysis to user
        await ctx.reply(getTextForUser('todayAnalysis', user, { analysis }), {
            reply_markup: keyboard,
            parse_mode: 'HTML'
        });
    } catch (error) {
        journalBotLogger.error('Error analyzing today\'s entries:', error);
        
        // Delete wait message
        if (ctx.chat) {
            await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);
        }
        
        await ctx.reply("I encountered an error while analyzing your entries. Please try again later.");
        await showMainMenu(ctx, user);
    }
}

// Handle Go Deeper feature
async function handleGoDeeper(ctx: JournalBotContext) {
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
    
    try {
        const entryId = new Types.ObjectId(ctx.session.journalEntryId);
        const entry = await getJournalEntryById(entryId);
        
        if (!entry) {
            ctx.session.journalEntryId = undefined;
            await ctx.reply(getTextForUser('entryNotFound', user), {
                parse_mode: 'HTML'
            });
            await showMainMenu(ctx, user);
            return;
        }
        
        // Send wait message with sand clock emoji
        const waitMsg = await ctx.reply("⏳");
        
        // Generate deeper analysis and questions
        const deeperAnalysis = await analyzeJournalEntry(entry, user);
        const questions = await generateJournalQuestions(entry, user);
        
        // Update the journal entry with the analysis and questions
        await updateJournalEntryAnalysis(entryId, deeperAnalysis);
        await updateJournalEntryQuestions(entryId, questions);
        
        // Delete wait message
        if (ctx.chat) {
            await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);
        }
        
        // Send analysis and questions in one message
        if (questions.length > 0) {
            const questionsText = questions.map((q: string, i: number) => `<i>${i + 1}. ${q}</i>`).join('\n\n');
            
            await ctx.reply(getTextForUser('deeperQuestions', user, {
                analysis: deeperAnalysis,
                questions: questionsText
            }), {
                parse_mode: 'HTML'
            });
        }
        
        // Show the same keyboard as initial entry
        const keyboard = new Keyboard()
            .text(getTextForUser('finishEntry', user))
            .row()
            .text(getTextForUser('goDeeper', user))
            .row()
            .text(getTextForUser('cancelEntry', user))
            .resized();
        
        await ctx.reply(getTextForUser('thoughtsOnQuestions', user), {
            reply_markup: keyboard,
            parse_mode: 'HTML'
        });
        
    } catch (error) {
        logger.error('Error in Go Deeper handler:', error);
        await ctx.reply(`<b>Something went wrong with my thinking cap, ${user.name || user.firstName}!</b> Let's try again later.`, {
            parse_mode: 'HTML'
        });
        await showMainMenu(ctx, user);
    }
}

// Handle journal chat
async function handleJournalChat(ctx: JournalBotContext, user: IUser) {
    // Get all user's journal entries
    const allEntries = await getUserJournalEntries(user._id as unknown as Types.ObjectId);
    
    if (allEntries.length === 0) {
        await ctx.reply(getTextForUser('noChatEntries', user), {
            parse_mode: 'HTML'
        });
        ctx.session.journalChatMode = false;
        await showMainMenu(ctx, user);
        return;
    }
    
    // Check if message exists
    if (!ctx.message) {
        await ctx.reply(getTextForUser('askMeAnything', user), {
            parse_mode: 'HTML'
        });
        return;
    }
    
    // Handle text messages for chat
    if ('text' in ctx.message) {
        const text = ctx.message.text || '';
        
        // Check if user wants to exit chat mode
        const exitChatModeEN = getText('exitChatMode', Language.ENGLISH);
        const exitChatModeRU = getText('exitChatMode', Language.RUSSIAN);
        
        if (text === exitChatModeEN || text === exitChatModeRU) {
            return; // This will be handled by the specific hears handler
        }
        
        // Generate insights based on user's question using all entries
        try {
            // Send wait message with sand clock emoji
            const waitMsg = await ctx.reply("⏳");
            
            // Generate insights
            const insights = await generateJournalInsights(allEntries, user, text);
            
            // Delete wait message
            if (ctx.chat) {
                await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);
            }
            
            // Send insights to user
            await ctx.reply(`<b>${insights}</b>`, {
                parse_mode: 'HTML'
            });
            
            // Prompt for another question
            await ctx.reply(getTextForUser('anythingElse', user), {
                parse_mode: 'HTML'
            });
        } catch (error) {
            journalBotLogger.error('Error generating insights:', error);
            await ctx.reply("I'm having trouble analyzing your journal right now. Let's try again later.");
        }
    } 
    // Handle voice message
    else if ('voice' in ctx.message && ctx.message.voice) {
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
            await sendTranscriptionReply(ctx, ctx.message.message_id, transcription, user);
            
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
            await ctx.reply(getTextForUser('anyOtherQuestions', user), {
                parse_mode: 'HTML'
            });
            
            // Clean up
            fs.unlinkSync(localFilePath);
        } catch (error) {
            journalBotLogger.error('Error processing voice message in chat mode:', error);
            await ctx.reply(getTextForUser('errorProcessingVoice', user), {
                parse_mode: 'HTML'
            });
        }
    }
    // Handle video message
    else if (ctx.message && (('video_note' in ctx.message && ctx.message.video_note) || ('video' in ctx.message && ctx.message.video))) {
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
            await sendTranscriptionReply(ctx, ctx.message.message_id, transcription, user);
            
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
            await ctx.reply(getTextForUser('gotMoreQuestions', user), {
                parse_mode: 'HTML'
            });
            
            // Clean up
            fs.unlinkSync(localFilePath);
        } catch (error) {
            journalBotLogger.error('Error processing video message in chat mode:', error);
            await ctx.reply(getTextForUser('errorProcessingVideo', user), {
                parse_mode: 'HTML'
            });
        }
    } else {
        await ctx.reply(getTextForUser('askMeAnything', user), {
            parse_mode: 'HTML'
        });
    }
}

// Parse bio information from text
async function parseBioInformation(text: string): Promise<{ parsedBio: string, structuredInfo: any }> {
    try {
        // Call OpenAI to parse the bio information
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: "You are an assistant that extracts structured information from user bios. Extract key details like age, gender, occupation, interests, goals, challenges, and any other relevant information. Format the output as JSON."
                },
                {
                    role: "user",
                    content: `Parse the following bio information into a structured JSON format: "${text}"`
                }
            ],
            response_format: { type: "json_object" }
        });
        
        const parsedBio = response.choices[0]?.message?.content || "{}";
        const structuredInfo = JSON.parse(parsedBio);
        
        return { parsedBio, structuredInfo };
    } catch (error) {
        journalBotLogger.error('Error parsing bio information:', error);
        return { parsedBio: "{}", structuredInfo: {} };
    }
}

// Admin command to update text messages
bot.command('updatetext', async (ctx: JournalBotContext) => {
    // Only allow specific admin users to update texts
    const adminIds = [60972166]; // Add your Telegram ID here
    
    if (!ctx.from || !adminIds.includes(ctx.from.id)) {
        await ctx.reply("Sorry, you don't have permission to use this command.");
        return;
    }
    
    const args = ctx.message?.text?.split(' ').slice(1).join(' ');
    
    if (!args) {
        await ctx.reply(
            "Usage: /updatetext key language text\n\n" +
            "Example: /updatetext welcome en Hello, welcome to the journal bot!\n\n" +
            "To see all available keys, use: /updatetext list"
        );
        return;
    }
    
    if (args === 'list') {
        // Reload texts to ensure we have the latest version
        reloadTexts();
        
        // Get all text keys
        const keys = Object.keys(texts).sort();
        const keysList = keys.map(key => `- ${key}`).join('\n');
        
        await ctx.reply(`Available text keys:\n\n${keysList}`);
        return;
    }
    
    // Parse arguments
    const match = args.match(/^(\S+)\s+(en|ru)\s+(.+)$/s);
    
    if (!match) {
        await ctx.reply(
            "Invalid format. Usage: /updatetext key language text\n\n" +
            "Example: /updatetext welcome en Hello, welcome to the journal bot!"
        );
        return;
    }
    
    const [, key, langCode, newText] = match;
    const language = langCode === 'en' ? Language.ENGLISH : Language.RUSSIAN;
    
    // Update the text
    const success = updateText(key, language, newText);
    
    if (success) {
        await ctx.reply(`✅ Text updated successfully for key "${key}" in ${langCode.toUpperCase()}`);
    } else {
        await ctx.reply(`❌ Failed to update text. Key "${key}" not found.`);
    }
});

// Export the bot
export { bot as journalBot };