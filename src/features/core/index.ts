import { Bot } from 'grammy';
import { JournalBotContext } from '../../types/session';
import { registerCommandHandlers } from './handlers';
import { findOrCreateUser } from '../../database';
import { logger } from '../../utils/logger';
import { showMainMenu } from './handlers';
import { MAIN_MENU_CALLBACKS } from './keyboards';

/**
 * Registers all core handlers with the bot
 */
export function registerCoreHandlers(bot: Bot<JournalBotContext>): void {
    registerCommandHandlers(bot);

    // Register callback query handler for the main menu button
    bot.callbackQuery(MAIN_MENU_CALLBACKS.MAIN_MENU, async (ctx: JournalBotContext) => {
        await ctx.answerCallbackQuery();
        if (!ctx.from) return;

        const user = await findOrCreateUser(
            ctx.from.id,
            ctx.from.first_name,
            ctx.from.last_name,
            ctx.from.username
        );

        // Need to delete the inline message before showing the main menu keyboard
        try {
            await ctx.deleteMessage();
        } catch (e) {
            logger.warn("Could not delete message before showing main menu, maybe already deleted?", e);
        }
        await showMainMenu(ctx, user);
    });

    // New entry callback
    bot.callbackQuery(MAIN_MENU_CALLBACKS.NEW_ENTRY, async (ctx: JournalBotContext) => {
        await ctx.answerCallbackQuery();
        if (!ctx.from) return;

        const user = await findOrCreateUser(
            ctx.from.id,
            ctx.from.first_name,
            ctx.from.last_name,
            ctx.from.username
        );

        // Import and call the newEntryHandler from journal-entry feature
        const { newEntryHandler } = await import('../journal-entry/handlers.js');
        await newEntryHandler(ctx, user);
    });

    // Journal history callback
    bot.callbackQuery(MAIN_MENU_CALLBACKS.JOURNAL_HISTORY, async (ctx: JournalBotContext) => {
        await ctx.answerCallbackQuery();
        if (!ctx.from) return;

        const user = await findOrCreateUser(
            ctx.from.id,
            ctx.from.first_name,
            ctx.from.last_name,
            ctx.from.username
        );

        // Import and call the showJournalHistoryHandler from journal-history feature
        const { showJournalHistoryHandler } = await import('../journal-history/handlers.js');
        await showJournalHistoryHandler(ctx, user);
    });

    // Journal chat callback
    bot.callbackQuery(MAIN_MENU_CALLBACKS.JOURNAL_CHAT, async (ctx: JournalBotContext) => {
        await ctx.answerCallbackQuery();
        if (!ctx.from) return;

        const user = await findOrCreateUser(
            ctx.from.id,
            ctx.from.first_name,
            ctx.from.last_name,
            ctx.from.username
        );

        // Import and call the startJournalChatHandler from journal-chat feature
        const { startJournalChatHandler } = await import('../journal-chat/handlers.js');
        await startJournalChatHandler(ctx, user);
    });

    // Settings callback
    bot.callbackQuery(MAIN_MENU_CALLBACKS.SETTINGS, async (ctx: JournalBotContext) => {
        await ctx.answerCallbackQuery();
        if (!ctx.from) return;

        const user = await findOrCreateUser(
            ctx.from.id,
            ctx.from.first_name,
            ctx.from.last_name,
            ctx.from.username
        );

        // Import and call the showSettingsHandler from settings feature
        const { showSettingsHandler } = await import('../settings/handlers.js');
        await showSettingsHandler(ctx, user);
    });
}
