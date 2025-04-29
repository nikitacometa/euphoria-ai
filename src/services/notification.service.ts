import { User } from '../database/models/user.model';
import { bot } from '../app';
import { createLogger } from '../utils/logger';
import { LOG_LEVEL } from '../config';
import { Keyboard } from 'grammy';
import { convertFromUTC, convertToUTC, formatTimeWithTimezone } from '../utils/timezone';
import { IUser } from '../types/models';

const notificationLogger = createLogger('NotificationService', LOG_LEVEL);

class NotificationService {
    private static instance: NotificationService;
    private checkInterval: NodeJS.Timeout | null = null;

    private constructor() {}

    public static getInstance(): NotificationService {
        if (!NotificationService.instance) {
            NotificationService.instance = new NotificationService();
        }
        return NotificationService.instance;
    }

    public start(): void {
        if (this.checkInterval) {
            notificationLogger.warn('Notification service is already running');
            return;
        }

        // Check every minute
        this.checkInterval = setInterval(() => this.checkAndSendNotifications(), 60000);
        notificationLogger.info('Notification service started');
    }

    public stop(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            notificationLogger.info('Notification service stopped');
        }
    }

    private async checkAndSendNotifications(): Promise<void> {
        try {
            const now = new Date();
            const currentUTCTime = `${now.getUTCHours().toString().padStart(2, '0')}:${now.getUTCMinutes().toString().padStart(2, '0')}`;

            // Find users who should receive notifications
            const users = await User.find({
                notificationsEnabled: true,
                notificationTime: currentUTCTime,
                $or: [
                    { lastNotificationSent: { $exists: false } },
                    { lastNotificationSent: { $lt: new Date(now.setDate(now.getDate() - 1)) } }
                ]
            });

            for (const user of users) {
                await this.sendNotification(user);
            }
        } catch (error) {
            notificationLogger.error('Error checking notifications:', error);
        }
    }

    private async sendNotification(user: IUser): Promise<void> {
        try {
            const keyboard = new Keyboard()
                .text("✅ Share")
                .row()
                .text("❌ Ignore")
                .resized();

            // Display time in user's timezone if available
            const userTimezone = user.timezone || 'UTC';
            let timeDisplay = user.notificationTime || '21:00';
            
            if (user.timezone && user.notificationTime) {
                const localTime = convertFromUTC(user.notificationTime, user.timezone);
                timeDisplay = formatTimeWithTimezone(localTime, user.timezone);
            }

            await bot.api.sendMessage(
                user.telegramId,
                `Hey ${user.name || user.firstName} 😏\n\nShare any thoughts about today. E.g. how is it going? Have any plans? \n\nRecord voice, resend your video messages from other chats or just text one word.\n\nYour notification time is set to ${timeDisplay}.`,
                {
                    reply_markup: keyboard,
                    parse_mode: 'HTML'
                }
            );

            // Update last notification sent time
            await User.findByIdAndUpdate(user._id, {
                lastNotificationSent: new Date()
            });

            notificationLogger.info(`Notification sent to user ${user.telegramId}`);
        } catch (error) {
            notificationLogger.error(`Error sending notification to user ${user.telegramId}:`, error);
        }
    }

    /**
     * Updates the user's notification settings including timezone handling
     * 
     * @param telegramId User's Telegram ID
     * @param enabled Whether notifications should be enabled
     * @param time Time in user's local timezone (format: "HH:mm")
     * @param timezone User's IANA timezone (e.g., "America/New_York")
     */
    public async updateUserNotificationSettings(
        telegramId: number,
        enabled: boolean,
        time?: string,
        timezone?: string
    ): Promise<void> {
        try {
            const update: Partial<IUser> = { notificationsEnabled: enabled };
            
            // If timezone is provided, update it first
            if (timezone !== undefined) {
                update.timezone = timezone;
                notificationLogger.info(`Setting timezone for user ${telegramId} to ${timezone}`);
            }

            // If time is provided, convert it to UTC before storing
            if (time !== undefined) {
                // Get the current user record to access their timezone
                const user = await User.findOne({ telegramId });
                const userTimezone = timezone || user?.timezone || 'UTC';
                
                // Convert the time from user's timezone to UTC
                const utcTime = convertToUTC(time, userTimezone);
                
                update.notificationTime = utcTime;
                notificationLogger.info(`Setting notification time for user ${telegramId} to ${utcTime} UTC (original: ${time} in ${userTimezone})`);
            }

            await User.findOneAndUpdate(
                { telegramId },
                { $set: update }
            );

            notificationLogger.info(`Updated notification settings for user ${telegramId}`);
        } catch (error) {
            notificationLogger.error(`Error updating notification settings for user ${telegramId}:`, error);
            throw error;
        }
    }

    /**
     * Gets the user's current notification time in their local timezone
     * 
     * @param telegramId User's Telegram ID
     * @returns Object containing the notification time in local timezone, UTC time, and timezone
     */
    public async getUserNotificationTime(telegramId: number): Promise<{ localTime: string; utcTime: string; timezone: string } | null> {
        try {
            const user = await User.findOne({ telegramId });
            
            if (!user || !user.notificationTime) {
                return null;
            }
            
            const userTimezone = user.timezone || 'UTC';
            const utcTime = user.notificationTime;
            const localTime = convertFromUTC(utcTime, userTimezone);
            
            return {
                localTime,
                utcTime,
                timezone: userTimezone
            };
        } catch (error) {
            notificationLogger.error(`Error getting notification time for user ${telegramId}:`, error);
            return null;
        }
    }

    /**
     * Updates the user's display settings
     * @param telegramId User's Telegram ID
     * @param showTranscriptions Whether to show transcriptions to the user
     */
    public async updateUserDisplaySettings(
        telegramId: number,
        showTranscriptions: boolean
    ): Promise<void> {
        try {
            await User.findOneAndUpdate(
                { telegramId },
                { $set: { showTranscriptions } }
            );

            notificationLogger.info(`Updated display settings for user ${telegramId}`);
        } catch (error) {
            notificationLogger.error(`Error updating display settings for user ${telegramId}:`, error);
            throw error;
        }
    }

    /**
     * Updates the user's language settings
     * @param telegramId User's Telegram ID
     * @param aiLanguage Language for AI interactions ('en' or 'ru')
     */
    public async updateUserLanguageSettings(
        telegramId: number,
        aiLanguage: string
    ): Promise<void> {
        try {
            await User.findOneAndUpdate(
                { telegramId },
                { $set: { aiLanguage } }
            );

            notificationLogger.info(`Updated language settings for user ${telegramId}`);
        } catch (error) {
            notificationLogger.error(`Error updating language settings for user ${telegramId}:`, error);
            throw error;
        }
    }
}

export const notificationService = NotificationService.getInstance(); 