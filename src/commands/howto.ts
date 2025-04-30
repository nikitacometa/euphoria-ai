import { Bot } from 'grammy';
import { JournalBotContext } from '../types/session';

export const HOWTO_GUIDE = `<b>Feel Infinity ♾️ </b>

<i>I might do crazy things with you...</i>

• The killer feature is that I am your <b>ultimate KNOWLEDGE DATABASE</b> — save anything forever and easy access anything with voice AI search 🤯
  
   - forward all voices/videos from other chats that you can find — save valueble info in one place and improve a lot with understanding of your true self...
   - send your old journals/notes (files support soon) — have those structured and searchable
   - save important numbers, addresses, links — then ask any of them with voice

• <b>Basic journaling.</b> Write down thoughts, ideas, feelings, etc. I'll help you analyze all that and get some insights

• Made a cool voice/video for your friend? <b>Save it forever, just forward me</b>. Store all your good content! You are too good to forget

• <b>Get reminders</b> to journal. Likely in the evening. <i>Send even THE SHORTEST VOICE, even 5 seconds!</i> It works unbeliavably good... Build the habit

• <b>Deep AI talk</b> with your journal. Talk with yourself. Ask questions about your state, explore insights, find information

• You can customize reminders, AI language, and other UI studd, just go /settings

<i>Infinite potential, you know...</i>`;

export function registerHowToCommand(bot: Bot<JournalBotContext>) {
    bot.command('howto', async (ctx) => {
        await ctx.reply(HOWTO_GUIDE, {
            parse_mode: 'HTML'
        });
    });
} 