import { Bot } from 'grammy';
import { JournalBotContext } from '../types/session';

export const HOWTO_GUIDE = `<b>Welcome to Infinity ♾️ </b>

<i>I might do crazy things with you...</i>

• <b>Basic journaling.</b> Write down thoughts, ideas, feelings, etc. I'll help you analyze all that and get some insights

• <b>Save good voices and videos</b> FROM OTHER CHATS 🤯 Store all your good content! IT'S TOO GOOD TO JUST FORGET

• <b>Get a reminder</b> to share something. Likely in the evening. <i>Send even THE SHORTEST VOICE, even 5 seconds!</i> It works unbeliavably good... Build the habit

• <b>Want to save any info</b>, idea or Bitcoin private key? Create a new entry to store forever and retrieve it anytime

• <b>Deep AI talk</b> with your jornal, with yourself - ask questions, explore insights, brainstorm, ask support

• <b>Customize in settings:</b>
- Reminder time
- Preferred language
- See transcribed text for voice/video messages or hide
- Other amazing stuff...`;

export function registerHowToCommand(bot: Bot<JournalBotContext>) {
    bot.command('howto', async (ctx) => {
        await ctx.reply(HOWTO_GUIDE, {
            parse_mode: 'HTML'
        });
    });
} 