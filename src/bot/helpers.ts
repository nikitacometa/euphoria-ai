import { Context, Keyboard } from 'grammy';
import { IUser } from '../database';
import { Language, getText, getTextForUser } from '../utils/localization';
import { createLogger } from '../utils/logger';
import { LOG_LEVEL } from '../config';
import { JournalBotContext } from './context';

const helpersLogger = createLogger('BotHelpers', LOG_LEVEL);

/**
 * Matches a message text against the current localized labels of a button,
 * so handlers stay in sync with texts even when they are edited at runtime.
 */
export function matchesButton(key: string, text: string | undefined): boolean {
    if (!text) {
        return false;
    }
    return text === getText(key, Language.ENGLISH) || text === getText(key, Language.RUSSIAN);
}

/** Predicate factory for `bot.filter()`: matches a localized keyboard button. */
export function buttonFilter(key: string): (ctx: JournalBotContext) => boolean {
    return ctx => matchesButton(key, ctx.message?.text);
}

/**
 * Shows a "⏳" placeholder while a slow task runs and always removes it
 * afterwards, so failed tasks don't leave a dangling wait message.
 */
export async function withWaitMessage<T>(ctx: Context, task: () => Promise<T>): Promise<T> {
    const waitMessage = await ctx.reply('⏳');
    try {
        return await task();
    } finally {
        if (ctx.chat) {
            await ctx.api
                .deleteMessage(ctx.chat.id, waitMessage.message_id)
                .catch(error => helpersLogger.warn('Failed to delete wait message:', error));
        }
    }
}

/** Replies to the original voice/video message with its transcription. */
export async function sendTranscriptionReply(
    ctx: Context,
    messageId: number,
    transcription: string,
    user: IUser
): Promise<void> {
    await ctx.reply(getTextForUser('transcriptionText', user, { transcription }), {
        reply_to_message_id: messageId,
        parse_mode: 'HTML'
    });
}

/** Shows the main menu keyboard. */
export async function showMainMenu(ctx: Context, user: IUser): Promise<void> {
    const keyboard = new Keyboard()
        .text(getTextForUser('createNewEntry', user))
        .row()
        .text(getTextForUser('viewJournalHistory', user))
        .row()
        .text(getTextForUser('chatAboutJournal', user))
        .row()
        .text(getTextForUser('analyzeToday', user))
        .row()
        .text(getTextForUser('settings', user))
        .resized();

    await ctx.reply(getTextForUser('mainMenu', user), {
        reply_markup: keyboard,
        parse_mode: 'HTML'
    });
}

/** Language selection keyboard shared by onboarding and settings. */
export function buildLanguageKeyboard(backButtonLabel?: string): Keyboard {
    const keyboard = new Keyboard().text('English 🇬🇧').text('Русский 🇷🇺');
    if (backButtonLabel) {
        keyboard.row().text(backButtonLabel);
    }
    return keyboard.resized();
}

export const LANGUAGE_PROMPT = 'Please select your preferred language / Пожалуйста, выберите предпочитаемый язык:';
