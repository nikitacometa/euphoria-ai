import { User } from '../database/models/user.model';
import { bot } from '../app';
import { createLogger } from '../utils/logger';
import { LOG_LEVEL, SUPPORT_CHAT_ID, NOTIFICATION_ALERT_THRESHOLD, MAX_NOTIFICATION_RETRIES } from '../config/index';
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
        notificationLogger.info('Attempting to start NotificationService...');
        if (this.checkInterval) {
            notificationLogger.warn('Notification service is already running');
            return;
        }

        // Check every minute
        this.checkInterval = setInterval(() => this.checkAndSendNotifications(), 60000);
        notificationLogger.info('Notification service started successfully');
        
        // Send a startup notification to the support chat if configured
        this.sendMonitoringAlert('ℹ️ Notification service started');
    }

    public stop(): void {
        notificationLogger.info('Attempting to stop NotificationService...');
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            notificationLogger.info('Notification service stopped successfully');
            
            // Send a shutdown notification to the support chat if configured
            this.sendMonitoringAlert('⚠️ Notification service stopped');
        } else {
            notificationLogger.warn('Notification service was not running.');
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
        notificationLogger.info('Checking for notifications to send...');
        const checkStartTime = Date.now();
        try {
            const now = new Date();
            const currentUTCTime = `${now.getUTCHours().toString().padStart(2, '0')}:${now.getUTCMinutes().toString().padStart(2, '0')}`;
            notificationLogger.debug(`Current UTC time for check: ${currentUTCTime}`);
            
            // Get all users with notifications enabled
            const users = await User.find({
                notificationsEnabled: true
            });
                        
            // Filter users who should receive notifications based on time conditions
            const usersToNotify: IUser[] = []; // Ensure IUser type for clarity
            let usersChecked = 0;
            
            for (const user of users) {
                usersChecked++;
                notificationLogger.debug(`Checking user ${usersChecked}/${users.length}: ${user.telegramId} (${user.firstName || 'Unknown'})`);
                
                // Skip users without a next notification time set or if it's not a Date
                if (!user.nextNotificationScheduledAt || !(user.nextNotificationScheduledAt instanceof Date)) {
                    notificationLogger.debug(`User ${user.telegramId} has no valid nextNotificationScheduledAt set, skipping`);
                    // Optionally, we could schedule one here if notificationTime is set,
                    // but it's better handled in updateUserNotificationSettings for consistency.
                    continue;
                }
                
                const now = new Date(); // current time for comparison

                // Check if the next scheduled time has passed
                const isTimeToSend = now.getTime() >= user.nextNotificationScheduledAt.getTime();
                
                if (!isTimeToSend) {
                    notificationLogger.debug(
                        `Not time to send for user ${user.telegramId}: next scheduled at ${user.nextNotificationScheduledAt.toISOString()}`
                    );
                    continue;
                }
                
                // Check if this specific scheduled notification has already been sent
                // This handles scenarios where lastNotificationSent might be slightly different due to processing time
                // but was intended for this user.nextNotificationScheduledAt slot.
                // A small buffer (e.g., 5 minutes) could be added if exact timestamp match is too strict.
                const wasAlreadySentForThisSchedule = user.lastNotificationSent && 
                                                     user.lastNotificationSent.getTime() === user.nextNotificationScheduledAt.getTime();

                if (wasAlreadySentForThisSchedule) {
                    notificationLogger.debug(
                        `Notification for ${user.nextNotificationScheduledAt.toISOString()} was already sent to user ${user.telegramId} at ${user.lastNotificationSent?.toISOString()}. Skipping.`
                    );
                    // This case might also indicate a need to schedule the *next* one if it's stuck.
                    // However, the successful send path should handle rescheduling.
                    continue;
                }
                
                // If we reach here, the user should receive a notification for this schedule
                usersToNotify.push(user);
                notificationLogger.debug(
                    `Scheduling notification for user ${user.telegramId} (${user.firstName}): ` +
                    `nextNotificationScheduledAt=${user.nextNotificationScheduledAt.toISOString()}` +
                    (user.lastNotificationSent ? 
                        `, last actual sent=${user.lastNotificationSent.toISOString()}` :
                        ', first scheduled notification')
                );
            }
            
            if (usersToNotify.length > 0) {
                // Process notifications in parallel with error handling
                await Promise.all(
                    usersToNotify.map(user => 
                        this.sendNotificationWithRetries(user)
                        .catch(error => {
                            notificationLogger.error(`Final failure sending notification to user ${user.telegramId}:`, error);
                            return this.recordFailure(user, error);
                        })
                    )
                );
            }
            notificationLogger.debug(`Finished checking notifications. Checked ${usersChecked} users, sending ${usersToNotify.length} notifications. Duration: ${Date.now() - checkStartTime}ms`);
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
        notificationLogger.info(`Attempting to send notification to user ${user.telegramId} (Attempt ${attempt}/${MAX_NOTIFICATION_RETRIES})...`);
        const retryStartTime = Date.now();
        try {
            // Mark that we're attempting to send notification before actually sending
            // This prevents duplicate notifications if the send fails but the DB update succeeds
            await User.findByIdAndUpdate(user._id, {
                lastNotificationAttempt: new Date()
            });
            
            await this.sendNotification(user);
            
            // Mark as successfully sent after the notification is sent
            // Use the timestamp of the schedule that was just processed for lastNotificationSent
            const processedScheduleTime = user.nextNotificationScheduledAt; // Capture before it's updated

            await User.findByIdAndUpdate(user._id, {
                lastNotificationSent: processedScheduleTime, // Use the specific scheduled time
                lastNotificationError: null
            });

            // Schedule the next notification
            try {
                const nextScheduled = await this.calculateAndSetNextNotification(user);
                notificationLogger.info(
                    `✅ Notification successfully sent to user ${user.telegramId} (${user.firstName}) for schedule ${processedScheduleTime?.toISOString()}. ` +
                    `Next notification scheduled for ${nextScheduled?.toISOString()}`
                );
            } catch (scheduleError) {
                notificationLogger.error(`Error scheduling next notification for user ${user.telegramId} after successful send:`, scheduleError);
                // Optionally send a monitoring alert here if scheduling fails consistently
            }
            
            // Reset failure count on success
            this.resetFailureCount(user.telegramId);
            
            const userTimezone = user.timezone || 'UTC';
            const localTime = user.notificationTime ? convertFromUTC(user.notificationTime, userTimezone) : 'unknown';
            notificationLogger.info(
                `✅ Notification successfully sent to user ${user.telegramId} (${user.firstName}) at ` +
                `${new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC (${localTime} local time)`
            );
            notificationLogger.info(`sendNotificationWithRetries for user ${user.telegramId} succeeded. Duration: ${Date.now() - retryStartTime}ms`);
        } catch (error) {
            notificationLogger.error(`Error sending notification to user ${user.telegramId} on attempt ${attempt}:`, error);
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
            notificationLogger.error(`Final failure sending notification to user ${user.telegramId} after ${attempt} attempts. Duration: ${Date.now() - retryStartTime}ms`);
            throw error;
        }
    }

    /**
     * Calculates and sets the next notification time for a user.
     * This should be called after a notification is successfully sent or when settings are updated.
     * @param user The user for whom to schedule the next notification.
     * @returns The Date object of the next scheduled notification, or null if scheduling failed or not applicable.
     */
    private async calculateAndSetNextNotification(user: IUser): Promise<Date | null> {
        if (!user.notificationsEnabled || !user.notificationTime) {
            notificationLogger.info(`User ${user.telegramId} has notifications disabled or no time set. Clearing nextNotificationScheduledAt.`);
            await User.findByIdAndUpdate(user._id, { $unset: { nextNotificationScheduledAt: "" } });
            return null;
        }

        try {
            const userTimezone = user.timezone || 'UTC';
            const [hours, minutes] = user.notificationTime.split(':').map(Number); // HH:MM in UTC

            // Get current date in user's local timezone
            let nowInUserTimezone = new Date(); 
            if (userTimezone !== 'UTC') {
                // If we need to be super precise about "now" in user's timezone for date component
                // A full timezone library might be needed here for complex date math across timezones.
                // For simplicity, using server's current date component and applying user's HH:MM locally.
                // A robust solution uses a library to get "now" in the target timezone.
                // For now, we assume server's date is close enough for calculating next day.
            }

            // Create a date object for today in user's local timezone at their preferred HH:MM
            let nextNotificationLocal = new Date(nowInUserTimezone);
            nextNotificationLocal.setHours(hours, minutes, 0, 0); // This sets HH:MM in server's local time initially

            // Convert this local HH:MM intention to a UTC Date object for storage
            // This requires knowing what 'hours' and 'minutes' mean in the user's timezone
            // The current `user.notificationTime` is already UTC. So we work from that.
            
            let nextNotificationUtc = new Date(); // Start with now in UTC
            nextNotificationUtc.setUTCHours(hours, minutes, 0, 0);

            // If this UTC time has already passed *today* (or is very close to now), schedule for the next day (UTC)
            if (nextNotificationUtc.getTime() <= Date.now() + 60000) { // Add a small buffer (1 min)
                nextNotificationUtc.setUTCDate(nextNotificationUtc.getUTCDate() + 1);
            }

            await User.findByIdAndUpdate(user._id, {
                nextNotificationScheduledAt: nextNotificationUtc
            });
            notificationLogger.info(`Next notification for user ${user.telegramId} scheduled to: ${nextNotificationUtc.toISOString()}`);
            return nextNotificationUtc;
        } catch (error) {
            notificationLogger.error(`Failed to calculate and set next notification for user ${user.telegramId}:`, error);
            // Potentially set nextNotificationScheduledAt to null or a future retry time if this fails?
            // For now, we let it be, it will be caught in the main loop if invalid.
            return null;
        }
    }

    /**
     * Gets a flirty notification message template based on user's language
     * @param user User object containing name/firstName and language preference
     * @param timeDisplay Formatted notification time
     * @returns Formatted HTML message string
     */
    private getNotificationMessageTemplate(user: IUser, timeDisplay: string): string {
        const userName = user.name || user.firstName;
        const aiLanguage = user.aiLanguage || 'en';
        
        if (aiLanguage === 'ru') {
            return `<b>Привет, ${userName}!</b> 😏\n\n` +
                  `Как твой день? Поделись любыми мыслями, своим состоянием, <b>хотя бы коротенький войс 🥹</b>\n\n` +
                  `<i>Записывал(-а) войсы/видео другим людям? Наверняка интересные, давай запомним, пересылай сюда 😉</i>`;
        }
        
        // Default to English
        return `<b>Hey ${userName}!</b> 😏\n\n` +
              `How is your day? Share any thoughts, your mood, what you done today?\n\n` +
              `<i>At least a quick voice 🥹</i>\n\n` +
              `Also, if you did voices/video to other people today, let's save those!\n\n`;
    }

    private async sendNotification(user: IUser): Promise<void> {
        notificationLogger.info(`Sending actual notification message to user ${user.telegramId}...`);
        const sendStartTime = Date.now();

        // Display time in user's timezone if available
        const userTimezone = user.timezone || 'UTC';
        let timeDisplay = user.notificationTime || '21:00';
        
        // Convert UTC time to user's local timezone for display
        if (user.timezone && user.notificationTime) {
            // Convert from UTC (stored in DB) to local time based on user's timezone
            const localTime = convertFromUTC(user.notificationTime, user.timezone);
            // Format with timezone info for clarity
            timeDisplay = formatTimeWithTimezone(localTime, user.timezone);
        }

        // Get the appropriate message template based on user's language
        const messageText = this.getNotificationMessageTemplate(user, timeDisplay);

        await bot.api.sendMessage(
            user.telegramId,
            messageText,
            {
                parse_mode: 'HTML'
            }
        );
        notificationLogger.info(`Successfully sent notification message to user ${user.telegramId}. Duration: ${Date.now() - sendStartTime}ms`);
    }

    /**
     * Sends a notification to a specific user without time checks
     * @param user User to send notification to
     * @returns Promise<void>
     */
    public async sendBroadcastNotification(user: IUser): Promise<void> {
        return this.sendNotification(user);
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
            // Get the current user to check if notifications were previously enabled
            const user = await User.findOne({ telegramId });
            const update: Partial<IUser> = { notificationsEnabled: enabled };
            
            // If timezone is provided, update it first
            if (timezone !== undefined) {
                update.timezone = timezone;
                notificationLogger.info(`User ${telegramId} changed timezone to ${timezone}`);
            }

            // If time is provided, convert it to UTC before storing
            if (time !== undefined) {
                // Use the user we already fetched to access their timezone
                const userTimezone = timezone || user?.timezone || 'UTC';
                
                // IMPORTANT: Convert the time from user's LOCAL timezone to UTC for database storage
                const utcTime = convertToUTC(time, userTimezone);
                
                update.notificationTime = utcTime;
                notificationLogger.info(`User ${telegramId} changed notification time to ${utcTime} UTC (local: ${time} in ${userTimezone})`);
            }

            // Log notification status change
            if (user?.notificationsEnabled !== enabled) {
                if (enabled) {
                    notificationLogger.info(`User ${telegramId} enabled notifications`);
                } else {
                    notificationLogger.info(`User ${telegramId} disabled notifications`);
                }
            }

            await User.findOneAndUpdate(
                { telegramId },
                { $set: update }
            );

            // Fetch the updated user to pass to calculateAndSetNextNotification
            const updatedUser = await User.findOne({ telegramId });
            if (updatedUser) {
                const nextNotification = await this.calculateAndSetNextNotification(updatedUser);
                if (nextNotification) {
                    notificationLogger.info(`Created new notification for user ${telegramId} scheduled at ${nextNotification.toISOString()}`);
                } else if (enabled === false) {
                    notificationLogger.info(`Removed scheduled notifications for user ${telegramId}`);
                }
            } else {
                notificationLogger.warn(`User ${telegramId} not found after update for scheduling next notification.`);
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
            const utcTime = user.notificationTime; // This is stored in UTC in the database
            
            // IMPORTANT: Convert the UTC time to the user's local timezone for display
            const localTime = convertFromUTC(utcTime, userTimezone);
            
            notificationLogger.debug(`Retrieved notification time for user ${telegramId}: ${utcTime} UTC -> ${localTime} ${userTimezone}`);
            
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