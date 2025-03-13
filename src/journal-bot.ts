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
    getJournalEntryById
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
    onboardingStep?: 'age' | 'gender' | 'religion' | 'occupation' | 'complete';
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
        ctx.session.onboardingStep = 'age';
        await ctx.reply(`Welcome to your personal Journal Bot, ${user.firstName}! 📝\n\nLet's set up your profile to personalize your journaling experience.\n\nFirst, please tell me your age:`);
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
            .text("🔍 Analyze & Ask Questions")
            .row()
            .text("❌ Cancel Entry")
            .resized();
        
        await ctx.reply("You have an unfinished journal entry. You can continue adding to it or choose an option below:", {
            reply_markup: keyboard
        });
    } else {
        // Create new entry
        const entry = await createJournalEntry(user._id as unknown as Types.ObjectId);
        ctx.session.journalEntryId = entry._id?.toString() || '';
        
        const keyboard = new Keyboard()
            .text("✅ Finish Entry")
            .row()
            .text("🔍 Analyze & Ask Questions")
            .row()
            .text("❌ Cancel Entry")
            .resized();
        
        await ctx.reply("Let's create a new journal entry! Share your thoughts, experiences, or feelings. You can send text, voice messages, or videos.\n\nWhen you're done, press one of the buttons below:", {
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
        await ctx.reply("You don't have any journal entries yet. Start journaling to chat about your experiences!");
        await showMainMenu(ctx, user);
        return;
    }
    
    // Enter journal chat mode
    ctx.session.journalChatMode = true;
    ctx.session.waitingForJournalQuestion = true;
    
    const keyboard = new Keyboard()
        .text("Exit Chat Mode")
        .resized();
    
    await ctx.reply("You're now in chat mode! Ask me anything about your journal entries, and I'll provide insights based on what you've shared.\n\nFor example:\n- What patterns do you notice in my entries?\n- How have my feelings changed over time?\n- What insights can you give me about my recent experiences?", {
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

bot.hears("🔍 Analyze & Ask Questions", async (ctx) => {
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
    await ctx.reply("Journal entry canceled.");
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
bot.hears("Exit Chat Mode", async (ctx) => {
    if (!ctx.from) return;
    
    const user = await findOrCreateUser(
        ctx.from.id,
        ctx.from.first_name,
        ctx.from.last_name,
        ctx.from.username
    );
    
    ctx.session.journalChatMode = false;
    ctx.session.waitingForJournalQuestion = false;
    await ctx.reply("Exiting chat mode.");
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
            text === "🔍 Analyze & Ask Questions" ||
            text === "❌ Cancel Entry" ||
            text === "✅ Finish Reflection" ||
            text === "Exit Chat Mode"
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
            case 'age':
                const age = parseInt(text);
                if (isNaN(age) || age < 1 || age > 120) {
                    await ctx.reply('Please enter a valid age (a number between 1 and 120):');
                    return;
                }
                
                await updateUserProfile(ctx.from.id, { age });
                ctx.session.onboardingStep = 'gender';
                await ctx.reply('Thank you! Now, please tell me your gender:');
                break;
                
            case 'gender':
                await updateUserProfile(ctx.from.id, { gender: text });
                ctx.session.onboardingStep = 'religion';
                await ctx.reply('Thank you! Now, please tell me your religion (or "none" if you prefer not to specify):');
                break;
                
            case 'religion':
                await updateUserProfile(ctx.from.id, { religion: text });
                ctx.session.onboardingStep = 'occupation';
                await ctx.reply('Thank you! Finally, please tell me your occupation:');
                break;
                
            case 'occupation':
                await updateUserProfile(ctx.from.id, { occupation: text, onboardingCompleted: true });
                ctx.session.onboardingStep = undefined;
                
                // Get updated user
                const updatedUser = await findOrCreateUser(
                    ctx.from.id,
                    ctx.from.first_name,
                    ctx.from.last_name,
                    ctx.from.username
                );
                
                await ctx.reply('Thank you for completing your profile! Your journal is now ready to use.');
                await showMainMenu(ctx, updatedUser);
                break;
        }
    } else {
        await ctx.reply('Please send a text message to continue with the setup.');
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
    
    await ctx.reply(`Welcome to your Journal, ${user.firstName}! What would you like to do today?`, {
        reply_markup: keyboard
    });
}

// Handle journal entry messages
async function handleJournalEntry(ctx: JournalBotContext, user: IUser) {
    if (!ctx.message || !ctx.from || !ctx.session.journalEntryId) return;
    
    // Handle entry completion buttons - skip as they're handled by specific hears() handlers
    if ('text' in ctx.message) {
        const text = ctx.message.text || '';
        if (
            text === "✅ Finish Entry" ||
            text === "🔍 Analyze & Ask Questions" ||
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

Format your response as 5 concise bullet points that highlight the most important observations and suggestions.
Each bullet point should be 1-2 sentences maximum and start with "• ".
Focus on different aspects such as emotions, patterns, insights, strengths, and actionable next steps.`;

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
            { role: 'user', content: `${userInfo}\n\nJournal Entry and Reflections:\n${entryContent}\n\nAnalysis:\n${analysis}\n\nPlease provide 5 key insights and suggestions as bullet points.` }
        ];
        
        // Call OpenAI API
        const response = await openai.chat.completions.create({
            model: GPT_VERSION,
            messages: chatMessages,
            temperature: 0.7,
            max_tokens: 600
        });
        
        const insights = response.choices[0].message.content || 
            "Thank you for sharing your thoughts. Keep journaling regularly to build a meaningful record of your experiences and growth.";
        
        // Complete the entry
        await completeJournalEntry(entryId, analysis, insights);
        
        // Delete wait message
        if (ctx.chat) {
            await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);
        }
        
        // Send analysis and insights to user
        await ctx.reply("✅ Your journal entry has been saved!");
        await ctx.reply(`📊 *Analysis:*\n\n${analysis}`, {
            parse_mode: 'Markdown'
        });
        
        await ctx.reply(`💡 *Insights & Suggestions:*\n\n${insights}`, {
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
        await ctx.reply("You don't have an active journal entry. Please start a new journal entry first.");
        await showMainMenu(ctx, user);
        return;
    }
    
    try {
        const entryId = new Types.ObjectId(ctx.session.journalEntryId);
        const entry = await getJournalEntryById(entryId);
        
        if (!entry) {
            ctx.session.journalEntryId = undefined;
            await ctx.reply("Could not find your active journal entry.");
            await showMainMenu(ctx, user);
            return;
        }
        
        // Send wait message with sand clock emoji
        const waitMsg = await ctx.reply("⏳");
        
        // Generate analysis
        const analysis = await analyzeJournalEntry(entry, user);
        
        // Update the journal entry with the analysis
        await updateJournalEntryAnalysis(entryId, analysis);
        
        // Delete wait message
        if (ctx.chat) {
            await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);
        }
        
        // Send the analysis to the user
        await ctx.reply(`📊 *Analysis:*\n\n${analysis}`, {
            parse_mode: 'Markdown'
        });
        
        // Generate questions
        const questions = await generateJournalQuestions(entry, user);
        
        // Update the journal entry with the questions
        await updateJournalEntryQuestions(entryId, questions);
        
        // Send questions in one message
        if (questions.length > 0) {
            const questionsText = questions.map((q: string, i: number) => `${i + 1}. ${q}`).join('\n\n');
            await ctx.reply(`🤔 *Questions to reflect on:*\n\n${questionsText}`, {
                parse_mode: 'Markdown'
            });
        }
        
        // Show the "Go Deeper" and "Finish Journal" buttons
        const keyboard = new InlineKeyboard()
            .text("Go Deeper", "go_deeper")
            .text("Finish Journal", "finish_journal");
        
        await ctx.reply("When you're done reflecting on these questions, you can go deeper or finish your journal entry:", {
            reply_markup: keyboard
        });
        
    } catch (error) {
        logger.error('Error in Analyze Journal handler:', error);
        await ctx.reply("I encountered an error while analyzing your journal entry. Please try again later.");
        await showMainMenu(ctx, user);
    }
}

// Handle journal chat
async function handleJournalChat(ctx: JournalBotContext, user: IUser) {
    if (!ctx.message || !ctx.from) return;
    
    // Handle exit chat mode - skip as it's handled by specific hears() handler
    if ('text' in ctx.message && ctx.message.text === "Exit Chat Mode") {
        return;
    }
    
    // Get user's journal entries
    const entries = await getUserJournalEntries(user._id as unknown as Types.ObjectId);
    
    if (entries.length === 0) {
        await ctx.reply("You don't have any journal entries yet. Start journaling to chat about your experiences!");
        ctx.session.journalChatMode = false;
        await showMainMenu(ctx, user);
        return;
    }
    
    // Handle text message question
    if ('text' in ctx.message && ctx.session.waitingForJournalQuestion) {
        const question = ctx.message.text || '';
        
        // Send wait message with sand clock emoji
        const waitMsg = await ctx.reply("⏳");
        
        // Generate insights based on question
        const insights = await generateJournalInsights(entries, user, question);
        
        // Delete wait message
        if (ctx.chat) {
            await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);
        }
        
        // Send insights to user
        await ctx.reply(insights);
        
        // Prompt for another question
        await ctx.reply("Do you have another question about your journal entries?");
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
            await ctx.reply(`📝 *Your question:*\n\n${transcription}`, {
                parse_mode: 'Markdown'
            });
            
            // Generate insights based on transcribed question
            const insights = await generateJournalInsights(entries, user, transcription);
            
            // Delete wait message
            if (ctx.chat) {
                await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);
            }
            
            // Send insights to user
            await ctx.reply(insights);
            
            // Prompt for another question
            await ctx.reply("Do you have another question about your journal entries?");
            
            // Clean up
            fs.unlinkSync(localFilePath);
        } catch (error) {
            journalBotLogger.error('Error processing voice message in chat mode:', error);
            await ctx.reply("Sorry, I had trouble processing your voice message. Please try again or send a text message instead.");
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
            await ctx.reply(`📝 *Your question:*\n\n${transcription}`, {
                parse_mode: 'Markdown'
            });
            
            // Generate insights based on transcribed question
            const insights = await generateJournalInsights(entries, user, transcription);
            
            // Delete wait message
            if (ctx.chat) {
                await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);
            }
            
            // Send insights to user
            await ctx.reply(insights);
            
            // Prompt for another question
            await ctx.reply("Do you have another question about your journal entries?");
            
            // Clean up
            fs.unlinkSync(localFilePath);
        } catch (error) {
            journalBotLogger.error('Error processing video message in chat mode:', error);
            await ctx.reply("Sorry, I had trouble processing your video. Please try again or send a text message instead.");
        }
    } else {
        await ctx.reply("Please ask a question about your journal entries. You can send text, voice messages, or videos. Or type 'Exit Chat Mode' to return to the main menu.");
    }
}

// Handle "Go Deeper" button
async function handleGoDeeper(ctx: JournalBotContext) {
    const user = await findOrCreateUser(ctx.from?.id || 0, ctx.from?.username || '', ctx.from?.first_name || '');
    
    if (!ctx.session.journalEntryId) {
        await ctx.reply("You don't have an active journal entry. Please start a new journal entry first.");
        await showMainMenu(ctx, user);
        return;
    }
    
    try {
        const entryId = new Types.ObjectId(ctx.session.journalEntryId);
        const entry = await getJournalEntryById(entryId);
        
        if (!entry) {
            ctx.session.journalEntryId = undefined;
            await ctx.reply("Could not find your active journal entry.");
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
        const systemPrompt = `You are an insightful journal assistant that helps users reflect more deeply on their experiences.
Based on the user's journal entry, their responses to previous questions, and the previous analysis,
generate a brief preliminary analysis (2-3 sentences) that identifies deeper patterns, themes, or insights.
Then, generate 2-3 deeper, more probing questions that will help the user gain new insights.
Format your response as a JSON object with the following structure:
{
  "analysis": "Your brief preliminary analysis here",
  "questions": [
    "First deeper question here?",
    "Second deeper question here?",
    "Third deeper question here?"
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
            
            await ctx.reply("I encountered an error while generating deeper questions. Please try again later.");
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
        
        // Send the deeper analysis to the user
        await ctx.reply(`*Deeper Analysis:*\n\n${deeperAnalysis}`, {
            parse_mode: 'Markdown'
        });
        
        // Send questions in one message
        if (deeperQuestions.length > 0) {
            const questionsText = deeperQuestions.map((q: string, i: number) => `${i + 1}. ${q}`).join('\n\n');
            await ctx.reply(`🤔 *Questions to reflect on:*\n\n${questionsText}`, {
                parse_mode: 'Markdown'
            });
        }
        
        // Show the "Finish Journal" button
        const keyboard = new InlineKeyboard()
            .text("Finish Journal", "finish_journal");
        
        await ctx.reply("When you're done reflecting on these questions, you can finish your journal entry:", {
            reply_markup: keyboard
        });
        
    } catch (error) {
        logger.error('Error in Go Deeper handler:', error);
        await ctx.reply("I encountered an error while generating deeper questions. Please try again later.");
        await showMainMenu(ctx, user);
    }
}

// Export the bot
export { bot as journalBot }; 