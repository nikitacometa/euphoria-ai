import { InlineKeyboard, Keyboard } from 'grammy';
import { JournalBotContext } from '../../types/session';
import { IUser } from '../../types/models';
import { createSettingsKeyboard } from './keyboards';
import { logger } from '../../utils/logger';
import { notificationService } from '../../services/notification.service'; // Service for updating settings
import { updateUserProfile } from '../../database'; // Direct user profile update
import { showMainMenu } from '../core/handlers';
import { convertFromUTC, formatTimeWithTimezone, guessUserTimezone } from '../../utils/timezone';

/**
 * Formats the settings text based on user settings
 */
function formatSettingsText(user: IUser): string {
    const notificationStatus = user.notificationsEnabled ? "✅" : "❌";
    
    // Format notification time with user's timezone if available
    let notificationTimeDisplay = "⏱️ Not set";
    if (user.notificationTime) {
        const timezone = user.timezone || 'UTC';
        const localTime = convertFromUTC(user.notificationTime, timezone);
        notificationTimeDisplay = formatTimeWithTimezone(localTime, timezone);
    }
    
    const transcriptionStatus = user.showTranscriptions === true ? "✅" : "❌";
    const languageStatus = user.aiLanguage === 'en' ? "🇬🇧 English" : "🇷🇺 Russian";
    
    return `🔔 <b>Remind me to journal?</b> ${notificationStatus}\n\n` +
           `⏰ <b>Every day at:</b> ${notificationTimeDisplay}\n\n` +
           `📝 <b>Show Voices/Videos transcriptions?</b> ${transcriptionStatus}\n\n` +
           `🌐 <b>For AI Chat prefer:</b> ${languageStatus}\n\n` +
           `<i>Customize to get x100 more out of your journal 😎</i>`;
}

/**
 * Displays the settings menu to the user.
 */
export async function showSettingsHandler(ctx: JournalBotContext, user: IUser) {
    // Automatically guess and update user's timezone if not set
    if (!user.timezone) {
        const guessedTimezone = await guessUserTimezone(ctx);
        if (guessedTimezone && guessedTimezone !== user.timezone) {
            await notificationService.updateUserNotificationSettings(
                user.telegramId,
                user.notificationsEnabled === true,
                undefined,
                guessedTimezone
            );
            // Refresh user data with updated timezone
            user = await findOrCreateUser(user.telegramId, user.firstName, user.lastName, user.username);
            logger.info(`Auto-detected timezone for user ${user.telegramId}: ${guessedTimezone}`);
        }
    }
    
    const keyboard = createSettingsKeyboard(user);
    await ctx.reply(formatSettingsText(user), {
        reply_markup: keyboard,
        parse_mode: 'HTML'
    });
}

/**
 * Handles the `toggle_notifications` callback query.
 */
export async function toggleNotificationsHandler(ctx: JournalBotContext, user: IUser) {
     await ctx.answerCallbackQuery();
     try {
        const newStatus = !user.notificationsEnabled;
        // Update via notification service (if it handles DB update)
        // await notificationService.updateUserNotificationSettings(user.telegramId, newStatus);
        // Or update directly via DB function (more direct)
        const updatedUser = await updateUserProfile(user.telegramId, { notificationsEnabled: newStatus });
        
        if (!updatedUser) throw new Error("Failed to update user profile");

        const keyboard = createSettingsKeyboard(updatedUser);
        await ctx.editMessageText(formatSettingsText(updatedUser), {
            reply_markup: keyboard,
            parse_mode: 'HTML'
        });
     } catch (error) {
         logger.error(`Error toggling notifications for user ${user.telegramId}:`, error);
         await ctx.reply("Sorry, something went wrong updating your notification settings.");
     }
}

/**
 * Handles the `toggle_transcriptions` callback query.
 */
export async function toggleTranscriptionsHandler(ctx: JournalBotContext, user: IUser) {
    await ctx.answerCallbackQuery();
    try {
        // Explicitly determine the current and new status
        const currentStatus = user.showTranscriptions !== false;
        const newStatus = !currentStatus;
        
        // Log the status change
        logger.info(`Toggling transcriptions for user ${user.telegramId}: ${currentStatus} -> ${newStatus}`);
        
        // Update directly via DB function with explicit boolean value
        const updatedUser = await updateUserProfile(user.telegramId, { 
            showTranscriptions: newStatus 
        });
        
        if (!updatedUser) throw new Error("Failed to update user profile");

        const keyboard = createSettingsKeyboard(updatedUser);
        await ctx.editMessageText(formatSettingsText(updatedUser), {
            reply_markup: keyboard,
            parse_mode: 'HTML'
        });
    } catch (error) {
        logger.error(`Error toggling transcriptions for user ${user.telegramId}:`, error);
        await ctx.reply("Sorry, something went wrong updating your display settings.");
    }
}

/**
 * Handles the `toggle_language` callback query.
 */
export async function toggleLanguageHandler(ctx: JournalBotContext, user: IUser) {
    await ctx.answerCallbackQuery();
    try {
        const newLanguage = user.aiLanguage === 'en' ? 'ru' : 'en';
        // Update directly via DB function
        const updatedUser = await updateUserProfile(user.telegramId, { aiLanguage: newLanguage });
        
        if (!updatedUser) throw new Error("Failed to update user profile");

        const keyboard = createSettingsKeyboard(updatedUser);
        await ctx.editMessageText(formatSettingsText(updatedUser), {
            reply_markup: keyboard,
            parse_mode: 'HTML'
        });
    } catch (error) {
        logger.error(`Error toggling language for user ${user.telegramId}:`, error);
        await ctx.reply("Sorry, something went wrong updating your language settings.");
    }
}

/**
 * Handles the `set_notification_time` callback query.
 */
export async function setNotificationTimeHandler(ctx: JournalBotContext) {
    await ctx.answerCallbackQuery();
    
    // Add this flag so we know user is setting time
    if (ctx.session) {
        ctx.session.waitingForNotificationTime = true;
    }
    
    // Get the user to access their timezone
    if (!ctx.from) return;
    const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
    
    // Auto-guess timezone if not set
    if (!user.timezone) {
        const guessedTimezone = await guessUserTimezone(ctx);
        if (guessedTimezone) {
            await notificationService.updateUserNotificationSettings(
                user.telegramId,
                user.notificationsEnabled === true,
                undefined,
                guessedTimezone
            );
            logger.info(`Auto-detected timezone for user ${user.telegramId}: ${guessedTimezone}`);
        }
    }
    
    const timezone = user.timezone || 'UTC';
    
    // Custom keyboard for time input or cancel
    const cancelKeyboard = new Keyboard()
        .text('❌ Cancel')
        .resized();
    
    await ctx.reply(
        `Please enter a time for your daily journaling reminder using 24-hour format.\n\nExample: '21:00' for 9 PM.\n\nThis time will be interpreted in ${timezone} timezone.`,
        { reply_markup: cancelKeyboard }
    );
}

/**
 * Handles the user's message input when setting the notification time.
 */
export async function handleNotificationTimeInput(ctx: JournalBotContext, user: IUser) {
     if (!ctx.message || !('text' in ctx.message) || !ctx.session?.waitingForNotificationTime) {
         // Should not happen if middleware is set up correctly, but good practice
         return; 
     }

    const time = ctx.message.text;
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

    if (time && timeRegex.test(time)) {
        try {
            // Auto-guess timezone if not set
            if (!user.timezone) {
                const guessedTimezone = await guessUserTimezone(ctx);
                if (guessedTimezone) {
                    await notificationService.updateUserNotificationSettings(
                        user.telegramId,
                        user.notificationsEnabled === true,
                        undefined,
                        guessedTimezone
                    );
                    // Refresh user data with updated timezone
                    user = await findOrCreateUser(user.telegramId, user.firstName, user.lastName, user.username);
                    logger.info(`Auto-detected timezone for user ${user.telegramId}: ${guessedTimezone}`);
                }
            }
            
            // Get the user's timezone
            const timezone = user.timezone || 'UTC';
            
            // Update using notification service with timezone conversion
            await notificationService.updateUserNotificationSettings(
                user.telegramId, 
                true, // Enable notifications
                time, // This is local time
                timezone // User's timezone
            );
            
            // Fetch updated user for display
            const updatedUser = await findOrCreateUser(user.telegramId, user.firstName, user.lastName, user.username);
            if (!updatedUser) throw new Error("Failed to update user profile with time");

            ctx.session.waitingForNotificationTime = false;
            
            // Show the time in the user's timezone for confirmation
            const timeInfo = await notificationService.getUserNotificationTime(user.telegramId);
            let confirmationMessage = `Great! I'll send you notifications at ${time} in your timezone (${timezone}) 🌟`;
            
            if (timeInfo) {
                confirmationMessage = `Great! I'll send you notifications at ${formatTimeWithTimezone(timeInfo.localTime, timeInfo.timezone)} 🌟`;
            }
            
            await ctx.reply(confirmationMessage, {reply_markup: {remove_keyboard: true}});
            await showMainMenu(ctx, updatedUser); // Show main menu again
        } catch(error) {
             logger.error(`Error setting notification time for user ${user.telegramId}:`, error);
             await ctx.reply("Sorry, something went wrong saving your notification time.");
             ctx.session.waitingForNotificationTime = false; // Clear flag on error too
             await showMainMenu(ctx, user); 
        }
    } else if (time === '❌ Cancel') {
        ctx.session.waitingForNotificationTime = false;
        await ctx.reply("Time setting cancelled.", {reply_markup: {remove_keyboard: true}});
        await showMainMenu(ctx, user);
    } else {
        await ctx.reply("Please enter a valid time in 24-hour format (e.g., '21:00'). Or click '❌ Cancel' to exit.");
    }
}

/**
 * Handles the `set_timezone` callback query.
 */
export async function setTimezoneHandler(ctx: JournalBotContext) {
    await ctx.answerCallbackQuery();
    await ctx.reply("Timezone settings have been removed. We now automatically detect your timezone.");
}

// Import needed at the end to avoid circular dependencies
import { findOrCreateUser } from '../../database';
