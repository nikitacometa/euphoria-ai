import { Bot } from 'grammy';
import { JournalBotContext } from '../types';
import { User, IUser } from '../database/models/user.model';
import { InlineKeyboard } from 'grammy';
import { getTextForUser } from './localization';
import { createLogger } from './logger';
import { LOG_LEVEL } from '../config';
import schedule from 'node-schedule';

// Create a logger for the notification scheduler
const notificationLogger = createLogger('NotificationScheduler', LOG_LEVEL);

// Store scheduled jobs by user ID
const scheduledJobs: { [key: number]: schedule.Job } = {};

export async function scheduleNotificationForUser(bot: Bot<JournalBotContext>, user: IUser) {
    // Cancel existing job if any
    if (scheduledJobs[user.telegramId]) {
        scheduledJobs[user.telegramId].cancel();
        delete scheduledJobs[user.telegramId];
    }

    // If notifications are disabled, don't schedule new job
    if (!user.notificationsEnabled) {
        return;
    }

    // Parse notification time
    const [hours, minutes] = (user.notificationTime || "20:00").split(":").map(Number);

    // Schedule new job
    const job = schedule.scheduleJob(`${minutes} ${hours} * * *`, async () => {
        try {
            // Create inline keyboard
            const keyboard = new InlineKeyboard()
                .text(getTextForUser('createEntry', user), 'notification_create_entry')
                .row()
                .text(getTextForUser('skipToday', user), 'notification_skip')
                .row()
                .text(getTextForUser('turnOffNotifications', user), 'notification_turn_off');

            // Send notification message
            await bot.api.sendMessage(
                user.telegramId,
                getTextForUser('journalReminder', user),
                {
                    reply_markup: keyboard,
                    parse_mode: 'HTML'
                }
            );

            notificationLogger.info(`Sent notification to user ${user.telegramId}`);
        } catch (error) {
            notificationLogger.error(`Error sending notification to user ${user.telegramId}:`, error);
        }
    });

    // Store the job
    scheduledJobs[user.telegramId] = job;
    notificationLogger.info(`Scheduled notification for user ${user.telegramId} at ${hours}:${minutes}`);
}

export async function initializeNotifications(bot: Bot<JournalBotContext>) {
    try {
        // Get all users with notifications enabled
        const users = await User.find({ notificationsEnabled: true });

        // Schedule notifications for each user
        for (const user of users) {
            await scheduleNotificationForUser(bot, user);
        }

        notificationLogger.info(`Initialized notifications for ${users.length} users`);
    } catch (error) {
        notificationLogger.error('Error initializing notifications:', error);
    }
}

export async function updateUserNotificationSettings(
    bot: Bot<JournalBotContext>,
    telegramId: number,
    enabled: boolean,
    time?: string
) {
    try {
        // Update user settings
        const user = await User.findOneAndUpdate(
            { telegramId },
            { 
                $set: { 
                    notificationsEnabled: enabled,
                    ...(time && { notificationTime: time })
                } 
            },
            { new: true }
        );

        if (!user) {
            throw new Error(`User ${telegramId} not found`);
        }

        // Reschedule notification
        await scheduleNotificationForUser(bot, user);

        return user;
    } catch (error) {
        notificationLogger.error(`Error updating notification settings for user ${telegramId}:`, error);
        throw error;
    }
} 