import { Bot } from 'grammy'
import { TELEGRAM_API_TOKEN } from './config'

const bot = new Bot(TELEGRAM_API_TOKEN)

bot.on('message:text', ctx => ctx.reply(ctx.message.text))

bot.start()
