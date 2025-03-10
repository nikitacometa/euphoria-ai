import { Bot, InlineKeyboard, Keyboard } from 'grammy'
import { TELEGRAM_API_TOKEN, LOG_LEVEL } from './config'
import { promptText, promptWithConversationHistory, transcribeAudio, generateImage } from './chatgpt'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { 
    connectToDatabase, 
    findOrCreateUser, 
    saveTextMessage, 
    saveVoiceMessage,
    saveVideoMessage,
    saveImageMessage,
    MessageType,
    MessageRole,
    IUser,
    IMessage,
    getMessagesByUser,
    createConversation,
    getActiveConversation,
    endAllUserConversations,
    getMessagesByConversation,
    getLastImageMessageByConversation
} from './database'
import { Types } from 'mongoose'
import { logger, createLogger, LogLevel } from './utils/logger'
import { withCommandLogging } from './utils/command-logger'

// Create a logger for the main application
const mainLogger = createLogger('Main', LOG_LEVEL);

// Connect to MongoDB
connectToDatabase().catch(error => mainLogger.error('Failed to connect to MongoDB:', error));

const bot = new Bot(TELEGRAM_API_TOKEN)

// Start command handler
const handleStartCommand = withCommandLogging('start', async (ctx) => {
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
    
    // Create a new conversation
    await endAllUserConversations(user._id as unknown as Types.ObjectId);
    const conversation = await createConversation(user._id as unknown as Types.ObjectId);
    
    // Create reset conversation button
    const keyboard = new Keyboard()
        .text('Reset Conversation')
        .resized();
    
    await ctx.reply('Hey, beautiful! I\'m your AI assistant. How can I help you today?', {
        reply_markup: keyboard
    });
});

// Register the start command
bot.command('start', handleStartCommand);

// Chat ID command handler
const handleChatIdCommand = withCommandLogging('chat_id', async (ctx) => {
    if (!ctx.from) {
        await ctx.reply('Cannot identify user.');
        return;
    }
    
    // Save user to database
    const user = await findOrCreateUser(
        ctx.from.id,
        ctx.from.first_name,
        ctx.from.last_name,
        ctx.from.username
    );
    
    await ctx.reply(ctx.chat.id.toString());
});

// Register the chat_id command
bot.command('chat_id', handleChatIdCommand);

// Image generation command handler
const handleImageCommand = withCommandLogging('image', async (ctx) => {
    try {
        if (!ctx.from || !ctx.message) {
            await ctx.reply('Cannot identify user or message.');
            return;
        }
        
        // Get the prompt from the message
        const prompt = ctx.message.text.replace('/image', '').trim();
        
        if (!prompt) {
            await ctx.reply('Please provide a description for the image you want to generate.\nExample: /image a beautiful sunset over mountains');
            return;
        }
        
        // Show typing status while processing
        await ctx.replyWithChatAction('upload_photo');
        
        // Save user to database
        const user = await findOrCreateUser(
            ctx.from.id,
            ctx.from.first_name,
            ctx.from.last_name,
            ctx.from.username
        );
        
        // Get or create active conversation
        let conversation = await getActiveConversation(user._id as unknown as Types.ObjectId);
        if (!conversation) {
            conversation = await createConversation(user._id as unknown as Types.ObjectId);
        }
        
        // Save text message to database
        await saveTextMessage(
            user._id as unknown as Types.ObjectId,
            conversation._id as unknown as Types.ObjectId,
            ctx.message.message_id,
            `/image ${prompt}`,
            MessageRole.USER
        );
        
        // Generate the image
        const { url, revisedPrompt } = await generateImage(prompt);
        
        // Create keyboard with regenerate button
        const keyboard = new Keyboard()
            .text('Regenerate Image')
            .row()
            .text('Reset Conversation')
            .resized();
        
        // Send the image
        const sentMessage = await ctx.replyWithPhoto(url, {
            caption: `Here's your image based on: "${revisedPrompt}"`,
            reply_markup: keyboard
        });
        
        // Save the image to the database
        await saveImageMessage(
            user._id as unknown as Types.ObjectId,
            conversation._id as unknown as Types.ObjectId,
            sentMessage.message_id,
            url,
            revisedPrompt,
            MessageRole.ASSISTANT
        );
    } catch (error) {
        mainLogger.error('Error generating image:', error);
        await ctx.reply('Sorry, I had trouble generating that image. Please try again with a different description.');
    }
});

// Register the image command
bot.command('image', handleImageCommand);

// Regenerate image handler
const handleRegenerateImage = withCommandLogging('regenerate_image', async (ctx) => {
    try {
        if (!ctx.from || !ctx.message) {
            await ctx.reply('Cannot identify user or message.');
            return;
        }
        
        // Show typing status while processing
        await ctx.replyWithChatAction('upload_photo');
        
        // Save user to database
        const user = await findOrCreateUser(
            ctx.from.id,
            ctx.from.first_name,
            ctx.from.last_name,
            ctx.from.username
        );
        
        // Get active conversation
        const conversation = await getActiveConversation(user._id as unknown as Types.ObjectId);
        if (!conversation) {
            await ctx.reply('No active conversation found. Please start a new one with /start.');
            return;
        }
        
        // Get the last image message from this conversation
        const lastImageMessage = await getLastImageMessageByConversation(conversation._id as unknown as Types.ObjectId);
        
        if (!lastImageMessage || !lastImageMessage.imagePrompt) {
            await ctx.reply('No previous image found to regenerate. Please use /image command with a description.');
            return;
        }
        
        // Save regenerate request to database
        await saveTextMessage(
            user._id as unknown as Types.ObjectId,
            conversation._id as unknown as Types.ObjectId,
            ctx.message.message_id,
            'Regenerate Image',
            MessageRole.USER
        );
        
        // Generate a new image with the same prompt
        const { url, revisedPrompt } = await generateImage(lastImageMessage.imagePrompt);
        
        // Create keyboard with regenerate button
        const keyboard = new Keyboard()
            .text('Regenerate Image')
            .row()
            .text('Reset Conversation')
            .resized();
        
        // Send the image
        const sentMessage = await ctx.replyWithPhoto(url, {
            caption: `Here's your regenerated image based on: "${revisedPrompt}"`,
            reply_markup: keyboard
        });
        
        // Save the image to the database
        await saveImageMessage(
            user._id as unknown as Types.ObjectId,
            conversation._id as unknown as Types.ObjectId,
            sentMessage.message_id,
            url,
            revisedPrompt,
            MessageRole.ASSISTANT
        );
    } catch (error) {
        mainLogger.error('Error regenerating image:', error);
        await ctx.reply('Sorry, I had trouble regenerating the image. Please try again later.');
    }
});

// Register the regenerate image handler
bot.hears('Regenerate Image', handleRegenerateImage);

// Add a command to get user's message history
bot.command('history', async ctx => {
    try {
        if (!ctx.from) {
            await ctx.reply('Cannot identify user.');
            return;
        }
        
        // Save user to database
        const user = await findOrCreateUser(
            ctx.from.id,
            ctx.from.first_name,
            ctx.from.last_name,
            ctx.from.username
        );
        
        // Get user's messages
        const messages = await getMessagesByUser(user._id as unknown as Types.ObjectId);
        
        if (messages.length === 0) {
            await ctx.reply('You have no message history yet.');
            return;
        }
        
        // Format message history
        const messageHistory = messages.slice(0, 10).map((msg: IMessage, index: number) => {
            if (msg.type === MessageType.TEXT) {
                return `${index + 1}. <b>Text</b>: ${msg.text}`;
            } else if (msg.type === MessageType.VOICE) {
                return `${index + 1}. <b>Voice</b>: ${msg.transcription}`;
            } else if (msg.type === MessageType.IMAGE) {
                return `${index + 1}. <b>Image</b>: ${msg.imagePrompt}`;
            } else if (msg.type === MessageType.VIDEO) {
                return `${index + 1}. <b>Video</b>: ${msg.transcription}`;
            }
            return '';
        }).join('\n\n');
        
        await ctx.reply(`Your last ${Math.min(messages.length, 10)} messages:\n\n${messageHistory}`, {
            parse_mode: 'HTML'
        });
    } catch (error) {
        console.error('Error retrieving message history:', error);
        await ctx.reply('Sorry, I had trouble retrieving your message history.');
    }
});

// Reset conversation handler
const handleResetConversation = withCommandLogging('reset_conversation', async (ctx) => {
    try {
        if (!ctx.from) {
            await ctx.reply('Cannot identify user.');
            return;
        }
        
        // Save user to database
        const user = await findOrCreateUser(
            ctx.from.id,
            ctx.from.first_name,
            ctx.from.last_name,
            ctx.from.username
        );
        
        // End all active conversations and create a new one
        await endAllUserConversations(user._id as unknown as Types.ObjectId);
        await createConversation(user._id as unknown as Types.ObjectId);
        
        // Create reset conversation button
        const keyboard = new Keyboard()
            .text('Reset Conversation')
            .resized();
        
        await ctx.reply('I\'ve reset our conversation. What would you like to talk about now?', {
            reply_markup: keyboard
        });
    } catch (error) {
        mainLogger.error('Error resetting conversation:', error);
        await ctx.reply('Sorry, I had trouble resetting the conversation.');
    }
});

// Register the reset conversation handler
bot.hears('Reset Conversation', handleResetConversation);

// Text message handler
const handleTextMessage = withCommandLogging('text_message', async (ctx) => {
    try {
        if (!ctx.message) {
            await ctx.reply('Cannot identify message.');
            return;
        }
        
        // Skip processing for the reset command as it's handled separately
        if (ctx.message.text === 'Reset Conversation' || ctx.message.text === 'Regenerate Image') {
            return;
        }
        
        if (!ctx.from) {
            await ctx.reply('Cannot identify user.');
            return;
        }
        
        // Show typing status while processing
        await ctx.replyWithChatAction('typing');
        
        // Save user to database
        const user = await findOrCreateUser(
            ctx.from.id,
            ctx.from.first_name,
            ctx.from.last_name,
            ctx.from.username
        );
        
        // Get or create active conversation
        let conversation = await getActiveConversation(user._id as unknown as Types.ObjectId);
        if (!conversation) {
            conversation = await createConversation(user._id as unknown as Types.ObjectId);
        }
        
        // Save text message to database
        await saveTextMessage(
            user._id as unknown as Types.ObjectId,
            conversation._id as unknown as Types.ObjectId,
            ctx.message.message_id,
            ctx.message.text,
            MessageRole.USER
        );
        
        // Get conversation history
        const conversationHistory = await getMessagesByConversation(
            conversation._id as unknown as Types.ObjectId
        );
        
        // Generate AI response with conversation context
        const replyText = await promptWithConversationHistory(
            ctx.message.text,
            conversationHistory
        );
        
        // Create reset conversation button
        const keyboard = new Keyboard()
            .text('Reset Conversation')
            .resized();
        
        // Send the response
        const sentMessage = await ctx.reply(replyText, {
            reply_markup: keyboard
        });
        
        // Save the assistant's response to the database
        await saveTextMessage(
            user._id as unknown as Types.ObjectId,
            conversation._id as unknown as Types.ObjectId,
            sentMessage.message_id,
            replyText,
            MessageRole.ASSISTANT
        );
    } catch (error) {
        mainLogger.error('Error processing text message:', error);
        await ctx.reply('Sorry, I had trouble processing your message.');
    }
});

// Register the text message handler
bot.on('message:text', handleTextMessage);

// Voice message handler
const handleVoiceMessage = withCommandLogging('voice_message', async (ctx) => {
    try {
        // Show typing status while processing
        await ctx.replyWithChatAction('typing');
        
        if (!ctx.from) {
            await ctx.reply('Cannot identify user.');
            return;
        }
        
        // Save user to database
        const user = await findOrCreateUser(
            ctx.from.id,
            ctx.from.first_name,
            ctx.from.last_name,
            ctx.from.username
        );
        
        // Get or create active conversation
        let conversation = await getActiveConversation(user._id as unknown as Types.ObjectId);
        if (!conversation) {
            conversation = await createConversation(user._id as unknown as Types.ObjectId);
        }
        
        // Get file info
        const fileId = ctx.message.voice.file_id;
        const file = await ctx.api.getFile(fileId);
        
        // Create a temporary file path
        const tempDir = os.tmpdir();
        const tempFilePath = path.join(tempDir, `voice_${Date.now()}.oga`);
        
        // Download the file
        const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_API_TOKEN}/${file.file_path}`;
        const response = await fetch(fileUrl);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        fs.writeFileSync(tempFilePath, buffer);
        
        // Transcribe the audio
        const transcription = await transcribeAudio(tempFilePath);
        
        // Save voice message to database
        await saveVoiceMessage(
            user._id as unknown as Types.ObjectId,
            conversation._id as unknown as Types.ObjectId,
            ctx.message.message_id,
            fileId,
            file.file_path || '',
            transcription,
            MessageRole.USER
        );
        
        // Get conversation history
        const conversationHistory = await getMessagesByConversation(
            conversation._id as unknown as Types.ObjectId
        );
        
        // Generate AI response with conversation context
        const replyText = await promptWithConversationHistory(
            transcription,
            conversationHistory
        );
        
        // Create reset conversation button
        const keyboard = new Keyboard()
            .text('Reset Conversation')
            .resized();
        
        // Send the response
        const sentMessage = await ctx.reply(replyText, {
            reply_markup: keyboard
        });
        
        // Save the assistant's response to the database
        await saveTextMessage(
            user._id as unknown as Types.ObjectId,
            conversation._id as unknown as Types.ObjectId,
            sentMessage.message_id,
            replyText,
            MessageRole.ASSISTANT
        );
        
        // Clean up the temporary file
        fs.unlinkSync(tempFilePath);
    } catch (error) {
        mainLogger.error('Error processing voice message:', error);
        await ctx.reply('Sorry, I had trouble processing your voice message.');
    }
});

// Register the voice message handler
bot.on('message:voice', handleVoiceMessage);

// Video message handler
const handleVideoMessage = withCommandLogging('video_message', async (ctx) => {
    try {
        mainLogger.info('Received video message');
        
        // Log the message object for debugging
        mainLogger.debug('Message object:', JSON.stringify(ctx.message, null, 2));
        
        // Show typing status while processing
        await ctx.replyWithChatAction('typing');
        
        if (!ctx.from) {
            await ctx.reply('Cannot identify user.');
            return;
        }
        
        if (!ctx.message || !ctx.message.video) {
            mainLogger.error('No video found in message');
            await ctx.reply('Sorry, I couldn\'t process your video. Please try again.');
            return;
        }
        
        mainLogger.debug(`Processing video from user: ${ctx.from.id} (${ctx.from.first_name})`);
        
        // Save user to database
        const user = await findOrCreateUser(
            ctx.from.id,
            ctx.from.first_name,
            ctx.from.last_name,
            ctx.from.username
        );
        
        // Get or create active conversation
        let conversation = await getActiveConversation(user._id as unknown as Types.ObjectId);
        if (!conversation) {
            conversation = await createConversation(user._id as unknown as Types.ObjectId);
        }
        
        // Get file info
        const fileId = ctx.message.video.file_id;
        mainLogger.debug(`Video file ID: ${fileId}`);
        
        const file = await ctx.api.getFile(fileId);
        if (!file || !file.file_path) {
            mainLogger.error('Could not get file path from Telegram');
            await ctx.reply('Sorry, I couldn\'t access your video. Please try again.');
            return;
        }
        
        mainLogger.debug(`File path: ${file.file_path}`);
        
        // Determine file extension from mime type or file path
        const fileExt = file.file_path.split('.').pop() || 'mp4';
        mainLogger.debug(`File extension: ${fileExt}`);
        
        // Create a temporary file path
        const tempDir = os.tmpdir();
        const tempFilePath = path.join(tempDir, `video_${Date.now()}.${fileExt}`);
        mainLogger.debug(`Temporary file path: ${tempFilePath}`);
        
        try {
            // Download the file
            const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_API_TOKEN}/${file.file_path}`;
            mainLogger.debug(`Downloading from URL: ${fileUrl}`);
            
            const response = await fetch(fileUrl);
            
            if (!response.ok) {
                throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            
            if (buffer.length === 0) {
                throw new Error('Downloaded file is empty');
            }
            
            fs.writeFileSync(tempFilePath, buffer);
            mainLogger.info(`Video downloaded, size: ${buffer.length} bytes`);
        } catch (downloadError) {
            mainLogger.error('Error downloading video:', downloadError);
            await ctx.reply('Sorry, I had trouble downloading your video. Please try again with a smaller video.');
            return;
        }
        
        // Transcribe the audio from the video
        mainLogger.info('Transcribing audio from video...');
        let transcription;
        try {
            transcription = await transcribeAudio(tempFilePath);
            mainLogger.info(`Transcription result: "${transcription}"`);
            
            if (!transcription || transcription.includes("Sorry, I couldn't transcribe")) {
                throw new Error('Transcription failed or returned empty result');
            }
        } catch (transcriptionError) {
            mainLogger.error('Error during transcription:', transcriptionError);
            await ctx.reply('Sorry, I couldn\'t transcribe the audio from your video. The video might not have clear audio or might be in an unsupported format.');
            
            // Clean up the temporary file
            try {
                fs.unlinkSync(tempFilePath);
            } catch (cleanupError) {
                mainLogger.error('Error cleaning up temporary file:', cleanupError);
            }
            
            return;
        }
        
        // Save video message to database
        await saveVideoMessage(
            user._id as unknown as Types.ObjectId,
            conversation._id as unknown as Types.ObjectId,
            ctx.message.message_id,
            fileId,
            file.file_path,
            transcription,
            MessageRole.USER
        );
        
        // First, send the transcription to the user
        await ctx.reply(`📝 <b>Transcription</b>:\n\n${transcription}`, {
            parse_mode: 'HTML'
        });
        
        // Get conversation history
        const conversationHistory = await getMessagesByConversation(
            conversation._id as unknown as Types.ObjectId
        );
        
        // Generate AI response with conversation context
        mainLogger.info('Generating AI response...');
        const replyText = await promptWithConversationHistory(
            transcription,
            conversationHistory
        );
        
        // Create reset conversation button
        const keyboard = new Keyboard()
            .text('Reset Conversation')
            .resized();
        
        // Send the response
        const sentMessage = await ctx.reply(replyText, {
            reply_markup: keyboard
        });
        
        // Save the assistant's response to the database
        await saveTextMessage(
            user._id as unknown as Types.ObjectId,
            conversation._id as unknown as Types.ObjectId,
            sentMessage.message_id,
            replyText,
            MessageRole.ASSISTANT
        );
        
        // Clean up the temporary file
        try {
            fs.unlinkSync(tempFilePath);
            mainLogger.info('Temporary file deleted successfully');
        } catch (cleanupError) {
            mainLogger.error('Error cleaning up temporary file:', cleanupError);
        }
        
        mainLogger.info('Video message processing completed successfully');
    } catch (error) {
        mainLogger.error('Error processing video message:', error);
        
        // More detailed error logging
        if (error instanceof Error) {
            mainLogger.error(`Error name: ${error.name}, message: ${error.message}`);
            mainLogger.error(`Stack trace: ${error.stack}`);
        }
        
        await ctx.reply('Sorry, I had trouble processing your video message. Please try again or send a voice message instead.');
    }
});

// Register the video message handler
bot.on('message:video', handleVideoMessage);

// Add handler for video notes (circular videos in Telegram)
bot.on('message:video_note', async (ctx) => {
    try {
        mainLogger.info('Received video note message');
        mainLogger.debug('Message object:', JSON.stringify(ctx.message, null, 2));
        
        // Show typing status while processing
        await ctx.replyWithChatAction('typing');
        
        if (!ctx.from) {
            await ctx.reply('Cannot identify user.');
            return;
        }
        
        if (!ctx.message || !ctx.message.video_note) {
            mainLogger.error('No video note found in message');
            await ctx.reply('Sorry, I couldn\'t process your video note. Please try again.');
            return;
        }
        
        mainLogger.debug(`Processing video note from user: ${ctx.from.id} (${ctx.from.first_name})`);
        
        // Save user to database
        const user = await findOrCreateUser(
            ctx.from.id,
            ctx.from.first_name,
            ctx.from.last_name,
            ctx.from.username
        );
        
        // Get or create active conversation
        let conversation = await getActiveConversation(user._id as unknown as Types.ObjectId);
        if (!conversation) {
            conversation = await createConversation(user._id as unknown as Types.ObjectId);
        }
        
        // Get file info
        const fileId = ctx.message.video_note.file_id;
        mainLogger.debug(`Video note file ID: ${fileId}`);
        
        const file = await ctx.api.getFile(fileId);
        if (!file || !file.file_path) {
            mainLogger.error('Could not get file path from Telegram');
            await ctx.reply('Sorry, I couldn\'t access your video note. Please try again.');
            return;
        }
        
        mainLogger.debug(`File path: ${file.file_path}`);
        
        // Determine file extension from mime type or file path
        const fileExt = file.file_path.split('.').pop() || 'mp4';
        mainLogger.debug(`File extension: ${fileExt}`);
        
        // Create a temporary file path
        const tempDir = os.tmpdir();
        const tempFilePath = path.join(tempDir, `video_note_${Date.now()}.${fileExt}`);
        mainLogger.debug(`Temporary file path: ${tempFilePath}`);
        
        try {
            // Download the file
            const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_API_TOKEN}/${file.file_path}`;
            mainLogger.debug(`Downloading from URL: ${fileUrl}`);
            
            const response = await fetch(fileUrl);
            
            if (!response.ok) {
                throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            
            if (buffer.length === 0) {
                throw new Error('Downloaded file is empty');
            }
            
            fs.writeFileSync(tempFilePath, buffer);
            mainLogger.info(`Video note downloaded, size: ${buffer.length} bytes`);
        } catch (downloadError) {
            mainLogger.error('Error downloading video note:', downloadError);
            await ctx.reply('Sorry, I had trouble downloading your video note. Please try again with a smaller video.');
            return;
        }
        
        // Transcribe the audio from the video note
        mainLogger.info('Transcribing audio from video note...');
        let transcription;
        try {
            transcription = await transcribeAudio(tempFilePath);
            mainLogger.info(`Transcription result: "${transcription}"`);
            
            if (!transcription || transcription.includes("Sorry, I couldn't transcribe")) {
                throw new Error('Transcription failed or returned empty result');
            }
        } catch (transcriptionError) {
            mainLogger.error('Error during transcription:', transcriptionError);
            await ctx.reply('Sorry, I couldn\'t transcribe the audio from your video note. The video might not have clear audio or might be in an unsupported format.');
            
            // Clean up the temporary file
            try {
                fs.unlinkSync(tempFilePath);
            } catch (cleanupError) {
                mainLogger.error('Error cleaning up temporary file:', cleanupError);
            }
            
            return;
        }
        
        // Save video message to database (using video type since we don't have a specific video_note type)
        await saveVideoMessage(
            user._id as unknown as Types.ObjectId,
            conversation._id as unknown as Types.ObjectId,
            ctx.message.message_id,
            fileId,
            file.file_path,
            transcription,
            MessageRole.USER
        );
        
        // First, send the transcription to the user
        await ctx.reply(`📝 <b>Transcription</b>:\n\n${transcription}`, {
            parse_mode: 'HTML'
        });
        
        // Get conversation history
        const conversationHistory = await getMessagesByConversation(
            conversation._id as unknown as Types.ObjectId
        );
        
        // Generate AI response with conversation context
        mainLogger.info('Generating AI response...');
        const replyText = await promptWithConversationHistory(
            transcription,
            conversationHistory
        );
        
        // Create reset conversation button
        const keyboard = new Keyboard()
            .text('Reset Conversation')
            .resized();
        
        // Send the response
        const sentMessage = await ctx.reply(replyText, {
            reply_markup: keyboard
        });
        
        // Save the assistant's response to the database
        await saveTextMessage(
            user._id as unknown as Types.ObjectId,
            conversation._id as unknown as Types.ObjectId,
            sentMessage.message_id,
            replyText,
            MessageRole.ASSISTANT
        );
        
        // Clean up the temporary file
        try {
            fs.unlinkSync(tempFilePath);
            mainLogger.info('Temporary file deleted successfully');
        } catch (cleanupError) {
            mainLogger.error('Error cleaning up temporary file:', cleanupError);
        }
        
        mainLogger.info('Video note message processing completed successfully');
    } catch (error) {
        mainLogger.error('Error processing video note message:', error);
        
        // More detailed error logging
        if (error instanceof Error) {
            mainLogger.error(`Error name: ${error.name}, message: ${error.message}`);
            mainLogger.error(`Stack trace: ${error.stack}`);
        }
        
        await ctx.reply('Sorry, I had trouble processing your video note. Please try again or send a voice message instead.');
    }
});

// Debug handler for all message types
bot.on('message', (ctx) => {
    if (ctx.message) {
        const messageType = Object.keys(ctx.message).find(key => 
            ['text', 'voice', 'video', 'photo', 'document', 'audio', 'sticker'].includes(key)
        );
        
        mainLogger.debug(`Received message of type: ${messageType || 'unknown'}`);
        
        // If it's a video message but wasn't caught by the specific handler
        if (messageType === 'video' && ctx.message.video) {
            mainLogger.warn('Video message detected in general handler - specific handler may not be working');
            mainLogger.debug('Video message details:', JSON.stringify(ctx.message.video, null, 2));
        }
    }
});

// Log level command handler
const handleLogLevelCommand = withCommandLogging('log_level', async (ctx) => {
    if (!ctx.from) {
        await ctx.reply('Cannot identify user.');
        return;
    }
    
    // Get the level from the message
    const level = ctx.message?.text.replace('/log_level', '').trim();
    
    if (!level || !Object.values(LogLevel).includes(parseInt(level) as LogLevel)) {
        await ctx.reply(
            'Please provide a valid log level (0-5):\n' +
            '0 - NONE: No logging\n' +
            '1 - ERROR: Only errors\n' +
            '2 - WARN: Errors and warnings\n' +
            '3 - INFO: Normal logging (default)\n' +
            '4 - DEBUG: Verbose logging\n' +
            '5 - TRACE: Most verbose logging'
        );
        return;
    }
    
    // Set the log level
    const newLevel = parseInt(level) as LogLevel;
    mainLogger.setLogLevel(newLevel);
    
    // Log the change
    mainLogger.info(`Log level changed to ${LogLevel[newLevel]} (${newLevel})`);
    
    await ctx.reply(`Log level set to ${LogLevel[newLevel]} (${newLevel})`);
});

// Register the log level command
bot.command('log_level', handleLogLevelCommand);

bot.start();

// Log application start
mainLogger.info('Bot started successfully!');
