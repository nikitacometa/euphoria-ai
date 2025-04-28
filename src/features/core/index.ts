import { Bot } from 'grammy';
import { JournalBotContext } from '../../types/session';
import { showMainMenu } from './handlers';
import { findOrCreateUser } from '../../database';
import { logger } from '../../utils/logger';

export function registerCoreHandlers(bot: Bot<JournalBotContext>) {
    // Register callback query handler for the main menu button
    bot.callbackQuery("main_menu", async (ctx: JournalBotContext) => {
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

    // Other core handlers (e.g., generic error handler, maybe /help) could go here
}
