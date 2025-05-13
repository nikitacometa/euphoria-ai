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

    // Handler for messages when main menu is active (should be registered before other generic message handlers if any)
    bot.on([
        'message:text', 
        'message:voice', 
        'message:video_note', 
        'message:photo', // Added photo as per user request implication
        'message:document' // Added document as per user request implication
    ], async (ctx: JournalBotContext, next) => {
        if (ctx.session.isMainMenuActive) {
            if (!ctx.from || !ctx.message) return next(); // Should not happen if message filter is specific but good check

            // If the message is a slash command, let other handlers (bot.command) deal with it.
            if (ctx.message.text && ctx.message.text.startsWith('/')) {
                logger.info(`Main menu active: Detected slash command "${ctx.message.text}" from user ${ctx.from.id}. Passing to command handlers.`);
                return next(); 
            }

            logger.info(`Main menu active: Intercepted message (type: ${ctx.message?.hasOwnProperty('text') ? 'text' : Object.keys(ctx.message || {}).find(key => key !== 'message_id' && key !== 'date' && key !== 'chat')}) from user ${ctx.from.id}. Treating as new entry.`);
            
            ctx.session.isMainMenuActive = false; // Consume the flag

            try {
                const user = await findOrCreateUser(
                    ctx.from.id,
                    ctx.from.first_name,
                    ctx.from.last_name,
                    ctx.from.username
                );
    
                // Import and call the newEntryHandler from journal-entry feature
                // Make sure this import path is correct and newEntryHandler accepts the message context directly
                // or can derive necessary info from ctx.message
                const { newEntryHandler } = await import('../journal-entry/handlers.js'); 
                await newEntryHandler(ctx, user); // newEntryHandler needs to be adapted if it expects specific command/callback flow
                return; // Stop further processing if handled
            } catch (error) {
                logger.error('Error in main menu active message handler (new entry redirection):', error);
                // Fallback or error message?
                await ctx.reply("Sorry, something went wrong while trying to start a new entry. Please try using the 'New Entry' button.");
                // Fall through to other handlers by calling next() or just stop?
                // For now, we stop to prevent unintended double processing.
                return;
            }
        }
        return next(); // Continue to other handlers if main menu is not active
    });

    // Register callback query handler for the main menu button
    bot.callbackQuery(MAIN_MENU_CALLBACKS.MAIN_MENU, async (ctx: JournalBotContext) => {
        await ctx.answerCallbackQuery();
        if (!ctx.from) return;
        ctx.session.isMainMenuActive = false;

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
        ctx.session.isMainMenuActive = false;

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
        ctx.session.isMainMenuActive = false;

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
        ctx.session.isMainMenuActive = false;

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
        ctx.session.isMainMenuActive = false;

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
