import { Bot } from 'grammy';
import { ADMIN_TELEGRAM_IDS } from '../../config';
import { Language, reloadTexts, texts, updateText } from '../../utils/localization';
import { JournalBotContext } from '../context';

/** Admin-only command for editing localized texts at runtime. */
export function registerAdminRoutes(bot: Bot<JournalBotContext>): void {
    bot.command('updatetext', async ctx => {
        if (!ctx.from || !ADMIN_TELEGRAM_IDS.includes(ctx.from.id)) {
            await ctx.reply("Sorry, you don't have permission to use this command.");
            return;
        }

        const args = ctx.message?.text?.split(' ').slice(1).join(' ');
        if (!args) {
            await ctx.reply(
                'Usage: /updatetext key language text\n\n' +
                    'Example: /updatetext welcome en Hello, welcome to the journal bot!\n\n' +
                    'To see all available keys, use: /updatetext list'
            );
            return;
        }

        if (args === 'list') {
            await reloadTexts();
            const keys = Object.keys(texts).sort();
            await ctx.reply(`Available text keys:\n\n${keys.map(key => `- ${key}`).join('\n')}`);
            return;
        }

        const match = args.match(/^(\S+)\s+(en|ru)\s+(.+)$/s);
        if (!match) {
            await ctx.reply(
                'Invalid format. Usage: /updatetext key language text\n\n' +
                    'Example: /updatetext welcome en Hello, welcome to the journal bot!'
            );
            return;
        }

        const [, key, langCode, newText] = match;
        const language = langCode === 'en' ? Language.ENGLISH : Language.RUSSIAN;

        const success = await updateText(key, language, newText);
        if (success) {
            await ctx.reply(`✅ Text updated successfully for key "${key}" in ${langCode.toUpperCase()}`);
        } else {
            await ctx.reply(`❌ Failed to update text. Key "${key}" not found.`);
        }
    });
}
