import { Bot } from 'grammy';
import { JournalBotContext } from '../../types/session';
import { registerCommandHandlers } from './handlers';
import { findOrCreateUser } from '../../database';
import { logger } from '../../utils/logger';
import { showMainMenu } from './handlers';
import { MAIN_MENU_CALLBACKS } from './keyboards';
import { removeInlineKeyboard } from '../../utils/inline-keyboard';

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

        // This handler specifically deletes the message, so no need to remove the keyboard
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

        try {
            // Remove the keyboard first to prevent multiple clicks
            await removeInlineKeyboard(ctx);
            
            const user = await findOrCreateUser(
                ctx.from.id,
                ctx.from.first_name,
                ctx.from.last_name,
                ctx.from.username
            );

            // Import and call the newEntryHandler from journal-entry feature
            const { newEntryHandler } = await import('../journal-entry/handlers.js');
            await newEntryHandler(ctx, user);
        } catch (error) {
            logger.error('Error in NEW_ENTRY callback handler', error);
        }
    });

    // Journal history callback
    bot.callbackQuery(MAIN_MENU_CALLBACKS.JOURNAL_HISTORY, async (ctx: JournalBotContext) => {
        await ctx.answerCallbackQuery();
        if (!ctx.from) return;

        try {
            // Remove the keyboard first to prevent multiple clicks
            await removeInlineKeyboard(ctx);
            
            const user = await findOrCreateUser(
                ctx.from.id,
                ctx.from.first_name,
                ctx.from.last_name,
                ctx.from.username
            );

            // Import and call the showJournalHistoryHandler from journal-history feature
            const { showJournalHistoryHandler } = await import('../journal-history/handlers.js');
            await showJournalHistoryHandler(ctx, user);
        } catch (error) {
            logger.error('Error in JOURNAL_HISTORY callback handler', error);
        }
    });

    // Journal chat callback
    bot.callbackQuery(MAIN_MENU_CALLBACKS.JOURNAL_CHAT, async (ctx: JournalBotContext) => {
        await ctx.answerCallbackQuery();
        if (!ctx.from) return;

        try {
            // Remove the keyboard first to prevent multiple clicks
            await removeInlineKeyboard(ctx);
            
            const user = await findOrCreateUser(
                ctx.from.id,
                ctx.from.first_name,
                ctx.from.last_name,
                ctx.from.username
            );

            // Import and call the startJournalChatHandler from journal-chat feature
            const { startJournalChatHandler } = await import('../journal-chat/handlers.js');
            await startJournalChatHandler(ctx, user);
        } catch (error) {
            logger.error('Error in JOURNAL_CHAT callback handler', error);
        }
    });

    // Settings callback
    bot.callbackQuery(MAIN_MENU_CALLBACKS.SETTINGS, async (ctx: JournalBotContext) => {
        await ctx.answerCallbackQuery();
        if (!ctx.from) return;

        try {
            // Remove the keyboard first to prevent multiple clicks
            await removeInlineKeyboard(ctx);
            
            const user = await findOrCreateUser(
                ctx.from.id,
                ctx.from.first_name,
                ctx.from.last_name,
                ctx.from.username
            );

            // Import and call the showSettingsHandler from settings feature
            const { showSettingsHandler } = await import('../settings/handlers.js');
            await showSettingsHandler(ctx, user);
        } catch (error) {
            logger.error('Error in SETTINGS callback handler', error);
        }
    });
}
