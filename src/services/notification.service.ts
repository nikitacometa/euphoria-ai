import { User } from '../database/models/user.model';
import { bot } from '../app';
import { createLogger } from '../utils/logger';
import { LOG_LEVEL } from '../config';
import { Keyboard } from 'grammy';

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
            const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

            // Find users who should receive notifications
            const users = await User.find({
                notificationsEnabled: true,
                notificationTime: currentTime,
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

    private async sendNotification(user: any): Promise<void> {
        try {
            const keyboard = new Keyboard()
                .text("✅ Share")
                .row()
                .text("❌ Ignore")
                .resized();

            await bot.api.sendMessage(
                user.telegramId,
                `Hey ${user.name || user.firstName} 😏\n\nShare any thoughts about today. E.g. how is it going? Have any plans? \n\nRecord voice, resend your video messages from other chats or just text one word.`,
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

    public async updateUserNotificationSettings(
        telegramId: number,
        enabled: boolean,
        time?: string
    ): Promise<void> {
        try {
            const update: any = { notificationsEnabled: enabled };
            if (time !== undefined) {
                update.notificationTime = time;
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
}

export const notificationService = NotificationService.getInstance(); 