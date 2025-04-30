import { User } from '../database/models/user.model';
import { bot } from '../app';
import { createLogger } from '../utils/logger';
import { LOG_LEVEL, SUPPORT_CHAT_ID, NOTIFICATION_ALERT_THRESHOLD, MAX_NOTIFICATION_RETRIES } from '../config';
import { Keyboard } from 'grammy';
import { convertFromUTC, convertToUTC, formatTimeWithTimezone } from '../utils/timezone';
import { IUser } from '../types/models';

const notificationLogger = createLogger('NotificationService', LOG_LEVEL);

// Interface for tracking notification failures
interface NotificationFailureStats {
    failures: Map<number, { count: number, lastError: string }>;
    lastAlertTime: Map<number, Date>;
}

class NotificationService {
    private static instance: NotificationService;
    private checkInterval: NodeJS.Timeout | null = null;
    private failureStats: NotificationFailureStats = {
        failures: new Map(),
        lastAlertTime: new Map()
    };

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
        
        // Send a startup notification to the support chat if configured
        this.sendMonitoringAlert('ℹ️ Notification service started');
    }

    public stop(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            notificationLogger.info('Notification service stopped');
            
            // Send a shutdown notification to the support chat if configured
            this.sendMonitoringAlert('⚠️ Notification service stopped');
        }
    }

    /**
     * Sends a monitoring alert to the support chat
     */
    private async sendMonitoringAlert(message: string, isError: boolean = false): Promise<void> {
        if (!SUPPORT_CHAT_ID || SUPPORT_CHAT_ID.trim() === '') {
            notificationLogger.warn('Support chat ID not configured, monitoring alerts disabled');
            return;
        }

        try {
            const timestamp = new Date().toISOString();
            const alertMessage = `🤖 *Bot Monitoring Alert*\n\n${isError ? '🚨 ' : ''}${message}\n\n_${timestamp}_`;
            
            await bot.api.sendMessage(SUPPORT_CHAT_ID, alertMessage, {
                parse_mode: 'Markdown'
            });
            
            notificationLogger.info(`Sent monitoring alert: ${message}`);
        } catch (error) {
            notificationLogger.error('Failed to send monitoring alert:', error);
        }
    }

    /**
     * Records a notification failure and sends an alert if threshold is reached
     */
    private async recordFailure(user: IUser, error: any): Promise<void> {
        const telegramId = user.telegramId;
        const errorMessage = error?.message || String(error);
        
        // Get existing failures or initialize
        const userFailures = this.failureStats.failures.get(telegramId) || { count: 0, lastError: '' };
        
        // Update failure count and error message
        userFailures.count += 1;
        userFailures.lastError = errorMessage;
        
        this.failureStats.failures.set(telegramId, userFailures);
        
        // Check if we need to send an alert
        if (userFailures.count >= NOTIFICATION_ALERT_THRESHOLD) {
            // Only send alert if we haven't sent one in the last 24 hours for this user
            const lastAlertTime = this.failureStats.lastAlertTime.get(telegramId);
            const now = new Date();
            
            if (!lastAlertTime || (now.getTime() - lastAlertTime.getTime() > 24 * 60 * 60 * 1000)) {
                const alertMessage = `Failed to send notification to user ${telegramId} (${user.firstName}) ${userFailures.count} times.\nLast error: ${userFailures.lastError}`;
                await this.sendMonitoringAlert(alertMessage, true);
                
                // Update last alert time
                this.failureStats.lastAlertTime.set(telegramId, now);
            }
        }
    }

    /**
     * Resets failure count for a user after successful notification
     */
    private resetFailureCount(telegramId: number): void {
        this.failureStats.failures.delete(telegramId);
    }

    private async checkAndSendNotifications(): Promise<void> {
        try {
            const now = new Date();
            const currentUTCTime = `${now.getUTCHours().toString().padStart(2, '0')}:${now.getUTCMinutes().toString().padStart(2, '0')}`;
            
            // Calculate one day ago properly without mutating the now variable
            const oneDayAgo = new Date();
            oneDayAgo.setDate(oneDayAgo.getDate() - 1);

            // Find users who should receive notifications
            const users = await User.find({
                notificationsEnabled: true,
                notificationTime: currentUTCTime,
                $or: [
                    { lastNotificationSent: { $exists: false } },
                    { lastNotificationSent: { $lt: oneDayAgo } }
                ]
            });

            if (users.length > 0) {
                notificationLogger.info(`Found ${users.length} users to notify at ${currentUTCTime} UTC`);
                
                // Log each user's notification (at debug level to avoid log flooding)
                users.forEach(user => {
                    notificationLogger.debug(
                        `Scheduling notification for user ${user.telegramId} (${user.firstName}) at ${currentUTCTime} UTC` +
                        (user.lastNotificationSent ? ` (last sent: ${user.lastNotificationSent.toISOString().split('T')[0]})` : ' (first notification)')
                    );
                });
                
                // Process notifications in parallel with error handling
                await Promise.all(
                    users.map(user => 
                        this.sendNotificationWithRetries(user)
                        .catch(error => {
                            notificationLogger.error(`Final failure sending notification to user ${user.telegramId}:`, error);
                            return this.recordFailure(user, error);
                        })
                    )
                );
            }
        } catch (error) {
            notificationLogger.error('Error checking notifications:', error);
            // Send alert for critical errors that affect the whole notification process
            await this.sendMonitoringAlert(`Error in notification check process: ${error instanceof Error ? error.message : String(error)}`, true);
        }
    }

    /**
     * Attempts to send a notification with retries
     */
    private async sendNotificationWithRetries(user: IUser, attempt: number = 1): Promise<void> {
        try {
            // Mark that we're attempting to send notification before actually sending
            // This prevents duplicate notifications if the send fails but the DB update succeeds
            await User.findByIdAndUpdate(user._id, {
                lastNotificationAttempt: new Date()
            });
            
            await this.sendNotification(user);
            
            // Mark as successfully sent after the notification is sent
            await User.findByIdAndUpdate(user._id, {
                lastNotificationSent: new Date(),
                lastNotificationError: null
            });
            
            // Reset failure count on success
            this.resetFailureCount(user.telegramId);
            
            const userTimezone = user.timezone || 'UTC';
            const localTime = user.notificationTime ? convertFromUTC(user.notificationTime, userTimezone) : 'unknown';
            notificationLogger.info(
                `✅ Notification successfully sent to user ${user.telegramId} (${user.firstName}) at ` +
                `${new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC (${localTime} local time)`
            );
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            // Record the error in the database
            await User.findByIdAndUpdate(user._id, {
                lastNotificationError: errorMessage
            }).catch(err => {
                notificationLogger.error(`Failed to update error status for user ${user.telegramId}:`, err);
            });
            
            // Retry if we haven't exceeded max retries
            if (attempt < MAX_NOTIFICATION_RETRIES) {
                notificationLogger.warn(`Retrying notification for user ${user.telegramId} (attempt ${attempt + 1}/${MAX_NOTIFICATION_RETRIES})`);
                
                // Exponential backoff: wait longer between each retry
                const backoffMs = Math.min(100 * Math.pow(2, attempt), 10000); // Max 10 seconds
                await new Promise(resolve => setTimeout(resolve, backoffMs));
                
                return this.sendNotificationWithRetries(user, attempt + 1);
            }
            
            // If we've exhausted retries, propagate the error
            throw error;
        }
    }

    private async sendNotification(user: IUser): Promise<void> {
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

            // Calculate next notification time to provide more context in logs
            const scheduledUser = await User.findOne({ telegramId });
            if (scheduledUser?.notificationsEnabled && scheduledUser?.notificationTime) {
                const now = new Date();
                const [hours, minutes] = scheduledUser.notificationTime.split(':').map(Number);
                
                // Create a date object for today at the notification time
                const notificationDate = new Date(now);
                notificationDate.setUTCHours(hours, minutes, 0, 0);
                
                // If the time has already passed today, schedule for tomorrow
                if (notificationDate < now) {
                    notificationDate.setDate(notificationDate.getDate() + 1);
                }
                
                // Format date for logging
                const formattedNextNotification = notificationDate.toISOString().replace('T', ' ').substring(0, 16);
                
                notificationLogger.info(`Scheduled next notification for user ${telegramId} at ${formattedNextNotification} UTC (${scheduledUser.notificationTime})`);
            } else {
                notificationLogger.info(`Updated notification settings for user ${telegramId} - notifications ${scheduledUser?.notificationsEnabled ? 'enabled' : 'disabled'}`);
            }
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
     * Checks the connectivity status of the notification system
     * @returns boolean indicating if the system is healthy
     */
    public async checkHealth(): Promise<boolean> {
        try {
            // Check database connectivity
            const dbStatus = await User.findOne().select('telegramId').lean().exec();
            
            // Check Telegram API connectivity (no actual message sent)
            // Just verify we have a token and can initialize the API
            const hasToken = !!bot.token;
            
            const isHealthy = !!dbStatus && hasToken;
            
            if (!isHealthy) {
                await this.sendMonitoringAlert(
                    `⚠️ Notification system health check failed:\n` +
                    `- Database status: ${dbStatus ? 'OK' : 'FAILED'}\n` +
                    `- Telegram API status: ${hasToken ? 'OK' : 'FAILED'}`,
                    true
                );
            }
            
            return isHealthy;
        } catch (error) {
            notificationLogger.error('Health check failed:', error);
            await this.sendMonitoringAlert(`⚠️ Notification system health check threw an exception: ${error instanceof Error ? error.message : String(error)}`, true);
            return false;
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