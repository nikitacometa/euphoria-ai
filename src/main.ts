import { Bot, InlineKeyboard, Keyboard } from 'grammy'
import { TELEGRAM_API_TOKEN } from './config'
import { promptText, promptWithConversationHistory, transcribeAudio, generateImage } from './chatgpt'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { 
    connectToDatabase, 
    findOrCreateUser, 
    saveTextMessage, 
    saveVoiceMessage,
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

// Connect to MongoDB
connectToDatabase().catch(console.error);

const bot = new Bot(TELEGRAM_API_TOKEN)

bot.command('start', async ctx => {
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
})

bot.command('chat_id', async ctx => {
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
})

// Add image generation command
bot.command('image', async ctx => {
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
        console.error('Error generating image:', error);
        await ctx.reply('Sorry, I had trouble generating the image. Please try again later.');
    }
});

// Handle regenerate image command
bot.hears('Regenerate Image', async ctx => {
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
        console.error('Error regenerating image:', error);
        await ctx.reply('Sorry, I had trouble regenerating the image. Please try again later.');
    }
});

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

// Handle reset conversation text command
bot.hears('Reset Conversation', async ctx => {
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
        console.error('Error resetting conversation:', error);
        await ctx.reply('Sorry, I had trouble resetting the conversation.');
    }
});

// Handle text messages
bot.on('message:text', async ctx => {
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
        console.error('Error processing text message:', error);
        await ctx.reply('Sorry, I had trouble processing your message.');
    }
});

// Handle voice messages
bot.on('message:voice', async ctx => {
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
        console.error('Error processing voice message:', error);
        await ctx.reply('Sorry, I had trouble processing your voice message.');
    }
});

bot.start();
