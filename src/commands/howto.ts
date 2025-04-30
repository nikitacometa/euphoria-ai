import { Bot } from 'grammy';
import { JournalBotContext } from '../types/session';
import { findOrCreateUser } from '../database';

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


export const HOWTO_GUIDE_RU = `<b>Почувствуй Бесконечность ♾️</b>

<i>Со мной ты сможешь тааакое... хихи 😉</i>

• <b>Киллер-фича:</b> Я твоя <b>супер-база знаний</b>! Сохраняй всё-всё навсегда и легко находи голосом! Удобно, не правда ли? 🤔🤔

    - Пересылай <i>голосовые/видео из других чатов</i> (те, что для тебя важны, конечно!) — собирай ценную инфу в одном местечке и лучше понимай себя... потенциал ох 
    
    - Отправляй <i>старые дневники/заметки</i> (файлики скоро тоже можно будет!) — всё будет структурировано и доступно для поиска! 📂
    
    - Сохраняй <i>важные номера, адреса, ссылки</i> — а потом просто спроси меня голосом! Я всё помню! 😇

    
• <b>Просто записывай в дневник.</b> Записывай мысли, идейки, чувства... Я помогу всё проанализировать и выцепить сочных инсайтов

• Записал классное голосовое/видео в личку друга? Он разок глянул и всё, оно забыто... <b>Сохрани навсегда, просто перешли мне!</b> Собирай весь свой крутой контент! Ты слишком хорош(а), чтобы это забывать! 🥰


• <b>Я напомню</b> тебе записать что-нибудь. Вечером, скорее всего. <i>Ответь ХОТЯ БЫ КОРОТЕНЬКОЕ голосовое, даже 5 секундочек!</i> Это работает невероятно! Изи привычка, полный флекс

• <b>Глубокий чат с AI</b> твоего дневника. Поговори с собой! Проси оценить своё состояние, ищи инсайты, или просто находи информацию... Я сделаю всё, что ты захочешь 😏

• Настрой под себя напоминания, язык и всякое ещё в /settings


<i>Бесконечные возможности, если будешь меня использовать 😉</i>`;


export function registerHowToCommand(bot: Bot<JournalBotContext>) {
    bot.command('howto', async (ctx) => {
        if (!ctx.from) return;

        const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);

        const howToText = user.aiLanguage === 'ru' ? HOWTO_GUIDE_RU : HOWTO_GUIDE;

        await ctx.reply(howToText, {
            parse_mode: 'HTML'
        });
    });
} 