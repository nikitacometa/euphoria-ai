import { Bot } from 'grammy'
import { TELEGRAM_API_TOKEN } from './config'
import { promptText } from './chatgpt'

const bot = new Bot(TELEGRAM_API_TOKEN)

bot.command('start', ctx => ctx.reply('Hey, beautiful!'))

bot.command('chat_id', ctx => ctx.reply(ctx.chat.id.toString()))

bot.on('message:text', async ctx => {
    const replyText = await promptText(ctx.message.text)
    ctx.reply(replyText)
})

bot.start()
