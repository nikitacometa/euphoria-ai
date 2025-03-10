import { Bot } from 'grammy'
import { TELEGRAM_API_TOKEN } from './config'
import { promptText, transcribeAudio } from './chatgpt'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { 
    connectToDatabase, 
    findOrCreateUser, 
    saveTextMessage, 
    saveVoiceMessage,
    MessageType,
    IUser,
    IMessage,
    getMessagesByUser
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
    
    await ctx.reply('Hey, beautiful!');
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

bot.on('message:text', async ctx => {
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
        
        // Save text message to database
        await saveTextMessage(
            user._id as unknown as Types.ObjectId,
            ctx.message.message_id,
            ctx.message.text
        );
        
        const replyText = await promptText(ctx.message.text);
        await ctx.reply(replyText);
    } catch (error) {
        console.error('Error processing text message:', error);
        await ctx.reply('Sorry, I had trouble processing your message.');
    }
})

// Handle voice messages
bot.on('message:voice', async ctx => {
    try {
        // Show typing status while processing
        await ctx.replyWithChatAction('typing')
        
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
        
        // Get file info
        const fileId = ctx.message.voice.file_id
        const file = await ctx.api.getFile(fileId)
        
        // Create a temporary file path
        const tempDir = os.tmpdir()
        const tempFilePath = path.join(tempDir, `voice_${Date.now()}.oga`)
        
        // Download the file
        const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_API_TOKEN}/${file.file_path}`
        const response = await fetch(fileUrl)
        const arrayBuffer = await response.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        fs.writeFileSync(tempFilePath, buffer)
        
        // Transcribe the audio
        const transcription = await transcribeAudio(tempFilePath)
        
        // Save voice message to database
        await saveVoiceMessage(
            user._id as unknown as Types.ObjectId,
            ctx.message.message_id,
            fileId,
            file.file_path || '',
            transcription
        );
        
        // Use HTML formatting which is more reliable
        await ctx.reply(`I have done my best. You said:\n\n<pre>${transcription}</pre>`, { 
            parse_mode: 'HTML' 
        })
        
        // Clean up the temporary file
        fs.unlinkSync(tempFilePath)
    } catch (error) {
        console.error('Error processing voice message:', error)
        await ctx.reply('Sorry, I had trouble processing your voice message.')
    }
})


bot.start()
