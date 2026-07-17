import { Bot, Keyboard } from 'grammy';
import { updateUserLanguage } from '../../database';
import { Language, getTextForUser } from '../../utils/localization';
import { JournalBotContext } from '../context';
import { buildLanguageKeyboard, LANGUAGE_PROMPT, matchesButton, showMainMenu } from '../helpers';

export function registerSettingsRoutes(bot: Bot<JournalBotContext>): void {
    bot.callbackQuery('change_language', async ctx => {
        await ctx.answerCallbackQuery();
        ctx.session.mode = { kind: 'settings' };
        await ctx.reply(LANGUAGE_PROMPT, {
            reply_markup: buildLanguageKeyboard(getTextForUser('backToMainMenu', ctx.user))
        });
    });
}

/** Enters the settings menu. */
export async function enterSettings(ctx: JournalBotContext): Promise<void> {
    ctx.session.mode = { kind: 'settings' };
    await showSettings(ctx);
}

async function showSettings(ctx: JournalBotContext): Promise<void> {
    const keyboard = new Keyboard()
        .text(getTextForUser('changeLanguage', ctx.user))
        .row()
        .text(getTextForUser('backToMainMenu', ctx.user))
        .resized();

    await ctx.reply(getTextForUser('settingsTitle', ctx.user), {
        reply_markup: keyboard,
        parse_mode: 'HTML'
    });
}

/** Handles settings replies; the message router calls this while mode is 'settings'. */
export async function handleSettingsMessage(ctx: JournalBotContext): Promise<void> {
    if (!ctx.message || ctx.message.text === undefined) {
        return;
    }
    const text = ctx.message.text;

    if (matchesButton('changeLanguage', text)) {
        await ctx.reply(LANGUAGE_PROMPT, {
            reply_markup: buildLanguageKeyboard(getTextForUser('backToMainMenu', ctx.user))
        });
        return;
    }

    if (text === 'English 🇬🇧' || text === 'Русский 🇷🇺') {
        const language = text === 'Русский 🇷🇺' ? Language.RUSSIAN : Language.ENGLISH;
        const updatedUser = (await updateUserLanguage(ctx.from!.id, language)) || ctx.user;

        ctx.session.mode = { kind: 'idle' };
        await ctx.reply(getTextForUser('languageChanged', updatedUser), { parse_mode: 'HTML' });
        await showMainMenu(ctx, updatedUser);
        return;
    }

    if (matchesButton('backToMainMenu', text)) {
        ctx.session.mode = { kind: 'idle' };
        await showMainMenu(ctx, ctx.user);
        return;
    }

    await showSettings(ctx);
}
