import { Bot } from 'grammy'
import { TELEGRAM_API_TOKEN } from './config'
import { promptText, transcribeAudio } from './chatgpt'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const bot = new Bot(TELEGRAM_API_TOKEN)

bot.command('start', ctx => ctx.reply('Hey, beautiful!'))

bot.command('chat_id', ctx => ctx.reply(ctx.chat.id.toString()))

bot.on('message:text', async ctx => {
    const replyText = await promptText(ctx.message.text)
    ctx.reply(replyText)
})

// Handle voice messages
bot.on('message:voice', async ctx => {
    try {
        // Show typing status while processing
        await ctx.replyWithChatAction('typing')
        
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
        
        // Escape special characters for MarkdownV2 format
        const escapedText = transcription.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&')
        
        // Reply with the transcription in monospace format
        await ctx.reply(`I have done my best. You said:\n\`\`\`\n${escapedText}\n\`\`\``, { parse_mode: 'MarkdownV2' })
        
        // Clean up the temporary file
        fs.unlinkSync(tempFilePath)
    } catch (error) {
        console.error('Error processing voice message:', error)
        await ctx.reply('Sorry, I had trouble processing your voice message.')
    }
})

bot.start()
