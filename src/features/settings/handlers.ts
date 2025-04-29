import { InlineKeyboard, Keyboard } from 'grammy';
import { JournalBotContext } from '../../types/session';
import { IUser } from '../../types/models';
import { createSettingsKeyboard } from './keyboards';
import { logger } from '../../utils/logger';
import { notificationService } from '../../services/notification.service'; // Service for updating settings
import { updateUserProfile } from '../../database'; // Direct user profile update
import { showMainMenu } from '../core/handlers';

/**
 * Displays the settings menu to the user.
 */
export async function showSettingsHandler(ctx: JournalBotContext, user: IUser) {
    const keyboard = createSettingsKeyboard(user); // Use the keyboard generator
    const status = user.notificationsEnabled ? "enabled" : "disabled";
    const time = user.notificationTime || "not set";
    const transcriptions = user.showTranscriptions === true ? "enabled" : "disabled";
    const language = user.aiLanguage === 'en' ? "English" : "Russian";
    
    await ctx.reply(
        `<b>Settings</b> ⚙️\n\n` +
        `Notifications: ${status}\n` +
        `Time: ${time}\n` +
        `Show Transcriptions: ${transcriptions}\n` +
        `AI Language: ${language}\n\n` +
        `What would you like to change?`,
        {
            reply_markup: keyboard,
            parse_mode: 'HTML'
        }
    );
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

        // Update the message with the new state
        const keyboard = createSettingsKeyboard(updatedUser);
        const statusText = updatedUser.notificationsEnabled ? "enabled" : "disabled";
        const timeText = updatedUser.notificationTime || "not set";
        const transcriptions = updatedUser.showTranscriptions ? "enabled" : "disabled";
        const language = updatedUser.aiLanguage === 'en' ? "English" : "Russian";

        await ctx.editMessageText(
            `<b>Settings</b> ⚙️\n\n` +
            `Notifications: ${statusText}\n` +
            `Time: ${timeText}\n` +
            `Show Transcriptions: ${transcriptions}\n` +
            `AI Language: ${language}\n\n` +
            `What would you like to change?`,
            {
                reply_markup: keyboard,
                parse_mode: 'HTML'
            }
        );
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

        // Update the message with the new state
        const keyboard = createSettingsKeyboard(updatedUser);
        const notificationStatus = updatedUser.notificationsEnabled ? "enabled" : "disabled";
        const timeText = updatedUser.notificationTime || "not set";
        const transcriptions = updatedUser.showTranscriptions === true ? "enabled" : "disabled";
        const language = updatedUser.aiLanguage === 'en' ? "English" : "Russian";

        await ctx.editMessageText(
            `<b>Settings</b> ⚙️\n\n` +
            `Notifications: ${notificationStatus}\n` +
            `Time: ${timeText}\n` +
            `Show Transcriptions: ${transcriptions}\n` +
            `AI Language: ${language}\n\n` +
            `What would you like to change?`,
            {
                reply_markup: keyboard,
                parse_mode: 'HTML'
            }
        );
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

        // Update the message with the new state
        const keyboard = createSettingsKeyboard(updatedUser);
        const notificationStatus = updatedUser.notificationsEnabled ? "enabled" : "disabled";
        const timeText = updatedUser.notificationTime || "not set";
        const transcriptions = updatedUser.showTranscriptions ? "enabled" : "disabled";
        const language = updatedUser.aiLanguage === 'en' ? "English" : "Russian";

        await ctx.editMessageText(
            `<b>Settings</b> ⚙️\n\n` +
            `Notifications: ${notificationStatus}\n` +
            `Time: ${timeText}\n` +
            `Show Transcriptions: ${transcriptions}\n` +
            `AI Language: ${language}\n\n` +
            `What would you like to change?`,
            {
                reply_markup: keyboard,
                parse_mode: 'HTML'
            }
        );
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
    
    // Custom keyboard for time input or cancel
    const cancelKeyboard = new Keyboard()
        .text('❌ Cancel')
        .resized();
    
    await ctx.reply(
        `Please enter a time for your daily journaling reminder in 24-hour format (e.g., '21:00' for 9 PM).`,
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
            // Update via notification service OR direct DB
            // Using direct DB for immediate feedback
            const updatedUser = await updateUserProfile(user.telegramId, { notificationTime: time, notificationsEnabled: true }); // Also enable notifications when setting time?
             if (!updatedUser) throw new Error("Failed to update user profile with time");

            ctx.session.waitingForNotificationTime = false;
            await ctx.reply(`Great! I'll send you notifications at ${time} 🌟`, {reply_markup: {remove_keyboard: true}});
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
