import { Bot, InlineKeyboard, Keyboard } from 'grammy';
import { JournalBotContext } from '../../types/session';
import {
    showSettingsHandler,
    toggleNotificationsHandler,
    setNotificationTimeHandler,
    handleNotificationTimeInput,
    toggleTranscriptionsHandler,
    toggleLanguageHandler,
    setTimezoneHandler,
    handleTimezoneInput
} from './handlers';
import { findOrCreateUser } from '../../database';
import { removeInlineKeyboard } from '../../utils/inline-keyboard';
import { logger } from '../../utils/logger';

const SETTINGS_TEXT = "⚙️ Settings";
const TOGGLE_NOTIFICATIONS_CALLBACK = 'toggle_notifications';
const SET_NOTIFICATION_TIME_CALLBACK = 'set_notification_time';
const SET_TIMEZONE_CALLBACK = 'set_timezone';
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
        } else if (ctx.session?.waitingForUtcOffset) {
            // User is setting timezone, handle their input
            if (!ctx.from) return;
            const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
            await handleTimezoneInput(ctx, user);
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
        
        try {
            await ctx.answerCallbackQuery(); // Acknowledge the callback
            await removeInlineKeyboard(ctx);
            
            const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
            await toggleNotificationsHandler(ctx, user);
        } catch (error) {
            logger.error('Error in TOGGLE_NOTIFICATIONS callback handler', error);
        }
    });

    bot.callbackQuery(SET_NOTIFICATION_TIME_CALLBACK, async (ctx) => {
        try {
            await ctx.answerCallbackQuery(); // Acknowledge the callback
            await removeInlineKeyboard(ctx);
            
            // No need to find user here, handler just prompts
            await setNotificationTimeHandler(ctx);
        } catch (error) {
            logger.error('Error in SET_NOTIFICATION_TIME callback handler', error);
        }
    });
    
    bot.callbackQuery(SET_TIMEZONE_CALLBACK, async (ctx) => {
        try {
            await ctx.answerCallbackQuery(); // Acknowledge the callback
            await removeInlineKeyboard(ctx);
            
            // Handler prompts for timezone selection
            await setTimezoneHandler(ctx);
        } catch (error) {
            logger.error('Error in SET_TIMEZONE callback handler', error);
        }
    });
    
    bot.callbackQuery(TOGGLE_TRANSCRIPTIONS_CALLBACK, async (ctx) => {
        if (!ctx.from) return;
        
        try {
            await ctx.answerCallbackQuery(); // Acknowledge the callback
            await removeInlineKeyboard(ctx);
            
            const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
            await toggleTranscriptionsHandler(ctx, user);
        } catch (error) {
            logger.error('Error in TOGGLE_TRANSCRIPTIONS callback handler', error);
        }
    });
    
    bot.callbackQuery(TOGGLE_LANGUAGE_CALLBACK, async (ctx) => {
        if (!ctx.from) return;
        
        try {
            await ctx.answerCallbackQuery(); // Acknowledge the callback
            await removeInlineKeyboard(ctx);
            
            const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
            await toggleLanguageHandler(ctx, user);
        } catch (error) {
            logger.error('Error in TOGGLE_LANGUAGE callback handler', error);
        }
    });

    // Note: The '❌ Cancel' button when setting time is handled by 
    // handleNotificationTimeInput checking the message text.
}
