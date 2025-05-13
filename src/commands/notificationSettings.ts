import { Bot } from 'grammy';
import { JournalBotContext } from '../types/session';
import { findOrCreateUser, User } from '../database'; // Assuming User model might be needed for direct timezone access if not on ctx
import { notificationService } from '../services/notification.service';
import { createLogger } from '../utils/logger';
import { LOG_LEVEL } from '../config';

const logger = createLogger('NotificationCommands', LOG_LEVEL);

export function registerNotificationSettingsCommands(bot: Bot<JournalBotContext>) {
    // Command: /setnotificationtime HH:MM [timezone_iana_format]
    bot.command('setnotificationtime', async (ctx) => {
        if (!ctx.from) return;
        const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
        const parts = ctx.match.trim().split(' ');
        const time = parts[0];
        const newUtcOffset = parts[1]; // Optional, e.g. "+2" or "-5"

        if (!time || !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
            return ctx.reply('Invalid time format. Please use HH:MM (e.g., /setnotificationtime 21:00 +2).');
        }

        try {
            // Ensure notifications are enabled when time is set, or prompt user?
            // For now, just sets the time. Assumes notificationsEnabled is managed separately or defaults to true.
            await notificationService.updateUserNotificationSettings(user.telegramId, user.notificationsEnabled !== undefined ? user.notificationsEnabled : true, time, newUtcOffset);
            const updatedSettings = await notificationService.getUserNotificationTime(user.telegramId);
            if (updatedSettings) {
                await ctx.reply(`Notification time set to ${updatedSettings.localTime} (UTC${updatedSettings.utcOffset}). I'll schedule your next reminder!`);
            } else {
                await ctx.reply(`Notification time set to ${time}${newUtcOffset ? ' (UTC'+newUtcOffset+')' : ' (UTC+0)'}. I'll schedule your next reminder!`);
            }
        } catch (error) {
            logger.error(`Error setting notification time for ${user.telegramId}:`, error);
            await ctx.reply('Sorry, I couldn\'t set your notification time. Please try again later.');
        }
    });

    // Command: /togglenotifications
    bot.command('togglenotifications', async (ctx) => {
        if (!ctx.from) return;
        const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
        const currentStatus = user.notificationsEnabled === undefined ? true : user.notificationsEnabled; // Default to true if undefined
        const newStatus = !currentStatus;

        try {
            await notificationService.updateUserNotificationSettings(user.telegramId, newStatus, user.notificationTime, user.utcOffset);
            if (newStatus && !user.notificationTime) {
                 await ctx.reply(`Notifications ENABLED. Your default time is 21:00 UTC. Use /setnotificationtime HH:MM [utcOffset] to change it.`);
            } else {
                 await ctx.reply(`Notifications ${newStatus ? 'ENABLED' : 'DISABLED'}.`);
            }
        } catch (error) {
            logger.error(`Error toggling notifications for ${user.telegramId}:`, error);
            await ctx.reply('Sorry, I couldn\'t update your notification settings.');
        }
    });

    // Command: /mynotificationtime
    bot.command('mynotificationtime', async (ctx) => {
        if (!ctx.from) return;
        const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);

        if (!user.notificationsEnabled) {
            return ctx.reply('Notifications are currently DISABLED. Use /togglenotifications to enable them.');
        }

        const settings = await notificationService.getUserNotificationTime(user.telegramId);

        if (settings && settings.localTime) {
            await ctx.reply(`Your notifications are set for ${settings.localTime} (UTC${settings.utcOffset}).\nUTC time: ${settings.utcTime}.`);
        } else {
            await ctx.reply('You haven\'t set a specific notification time. Notifications are ENABLED with default settings (usually around 21:00 UTC). Use /setnotificationtime to pick your time.');
        }
    });
} 