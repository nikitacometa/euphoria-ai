import { Bot, InlineKeyboard, Keyboard } from 'grammy';
import { JournalBotContext } from '../../types/session';
import {
    showSettingsHandler,
    toggleNotificationsHandler,
    setNotificationTimeHandler,
    handleNotificationTimeInput,
    toggleTranscriptionsHandler,
    toggleLanguageHandler
} from './handlers';
import { findOrCreateUser } from '../../database';

const SETTINGS_TEXT = "⚙️ Settings";
const TOGGLE_NOTIFICATIONS_CALLBACK = 'toggle_notifications';
const SET_NOTIFICATION_TIME_CALLBACK = 'set_notification_time';
const TOGGLE_TRANSCRIPTIONS_CALLBACK = 'toggle_transcriptions';
const TOGGLE_LANGUAGE_CALLBACK = 'toggle_language';

export function registerSettingsHandlers(bot: Bot<JournalBotContext>) {

    // Middleware to handle messages when waiting for notification time input
    bot.on('message', async (ctx, next) => {
        if (ctx.session?.waitingForNotificationTime) {
            // User is setting notification time, handle their input
            if (!ctx.from) return; 
            const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
            await handleNotificationTimeInput(ctx, user);
        } else {
            // Not waiting for this input, pass to next handler
            await next();
        }
    });

    // Handler for the main settings button
    bot.hears(SETTINGS_TEXT, async (ctx) => {
        if (!ctx.from) return;
        const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
        await showSettingsHandler(ctx, user);
    });

    // Handle specific callback queries for this feature
    bot.callbackQuery(TOGGLE_NOTIFICATIONS_CALLBACK, async (ctx) => {
         if (!ctx.from) return;
         const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
         await toggleNotificationsHandler(ctx, user);
    });

    bot.callbackQuery(SET_NOTIFICATION_TIME_CALLBACK, async (ctx) => {
         // No need to find user here, handler just prompts
         await setNotificationTimeHandler(ctx);
    });
    
    bot.callbackQuery(TOGGLE_TRANSCRIPTIONS_CALLBACK, async (ctx) => {
         if (!ctx.from) return;
         const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
         await toggleTranscriptionsHandler(ctx, user);
    });
    
    bot.callbackQuery(TOGGLE_LANGUAGE_CALLBACK, async (ctx) => {
         if (!ctx.from) return;
         const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
         await toggleLanguageHandler(ctx, user);
    });

    // Note: The '❌ Cancel' button when setting time is handled by 
    // handleNotificationTimeInput checking the message text.
}
