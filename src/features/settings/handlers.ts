import { InlineKeyboard, Keyboard } from 'grammy';
import { JournalBotContext } from '../../types/session';
import { IUser } from '../../types/models';
import { createSettingsKeyboard } from './keyboards';
import { logger } from '../../utils/logger';
import { notificationService } from '../../services/notification.service'; // Service for updating settings
import { findOrCreateUser, updateUserProfile } from '../../database'; // Added import for findOrCreateUser
import { showMainMenu } from '../core/handlers';
import { convertFromUTC, formatTimeWithTimezone, guessUserTimezone, isValidTimezone, detectUserTimezone } from '../../utils/timezone';

/**
 * Formats the settings text based on user settings
 */
function formatSettingsText(user: IUser): string {
    const notificationStatus = user.notificationsEnabled ? "✅" : "❌";
    
    let notificationTimeDisplay = "⏱️ Not set";
    if (user.notificationTime) {
        const utcOffset = user.utcOffset || '+0';
        const localTime = convertFromUTC(user.notificationTime, utcOffset); 
        notificationTimeDisplay = formatTimeWithTimezone(localTime, utcOffset);
    }
    
    let utcOffsetDisplay = user.utcOffset ? `UTC${user.utcOffset}` : "UTC+0 (default)";
    
    const transcriptionStatus = user.showTranscriptions === true ? "✅" : "❌";
    const languageStatus = user.aiLanguage === 'en' ? "🇬🇧 English" : "🇷🇺 Russian";
    
    return `<b>Remind me to journal?</b> ${notificationStatus}\n\n` +
           `<b>Every day at:</b> ${notificationTimeDisplay}\n\n` +
           `<b>Show transcribed texts?</b> ${transcriptionStatus}\n\n` +
           `<b>For AI Chat prefer:</b> ${languageStatus}\n\n` +
           `<i>Try to play with settings to get x100 out of your journal — just facts.</i>`;
}

/**
 * Displays the settings menu to the user.
 */
export async function showSettingsHandler(ctx: JournalBotContext, user: IUser) {
    if (!user.utcOffset) {
        // const guessedTimezone = await guessUserTimezone(ctx); // This returns IANA, will need to adapt
        // For now, we can't reliably guess a simple UTC offset easily without more logic.
        // This part will be addressed in Subtask 1.4 (UI update for UTC offsets)
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
    
    // Auto-guess part will be refactored with UTC offset logic in Subtask 1.4
    const userUtcOffset = user.utcOffset || '+0';
    const offsetDisplay = `UTC${userUtcOffset}`;
    
    // Custom keyboard for time input or cancel
    const cancelKeyboard = new Keyboard()
        .text('❌ Cancel')
        .resized();
    
    await ctx.reply(
        `Please enter a time for your daily journaling reminder using 24-hour format.\n\n` +
        `Example: '21:00' for 9 PM.\n\n` +
        `This time will be interpreted in YOUR LOCAL TIMEZONE: ${offsetDisplay}\n\n` +
        `(We'll convert it to UTC before saving)`,
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
            // Auto-guess part will be refactored in Subtask 1.4
            const userUtcOffset = user.utcOffset || '+0';
            
            await notificationService.updateUserNotificationSettings(
                user.telegramId, 
                true, // Enable notifications
                time, // This is local time
                userUtcOffset // User's UTC offset
            );
            
            // Fetch updated user for display
            const updatedUser = await findOrCreateUser(user.telegramId, user.firstName, user.lastName, user.username);
            if (!updatedUser) throw new Error("Failed to update user profile with time");

            ctx.session.waitingForNotificationTime = false;
            
            // Get notification time info with correct timezone conversion
            const timeInfo = await notificationService.getUserNotificationTime(user.telegramId);
            
            // Format confirmation message showing the time in their local timezone
            let confirmationMessage = `Great! I'll send you notifications at ${time} in your timezone (UTC${userUtcOffset}) 🌟`;
            
            if (timeInfo) {
                // timeInfo will come from notificationService.getUserNotificationTime, which will also need to return utcOffset
                confirmationMessage = `Great! I'll send you notifications at ${formatTimeWithTimezone(timeInfo.localTime, timeInfo.utcOffset || userUtcOffset)} 🌟`;
                
                const currentOffsetDisplay = `UTC${timeInfo.utcOffset || userUtcOffset}`;
                confirmationMessage += `\n\nYour time will be saved as ${timeInfo.utcTime} UTC but displayed to you in your local timezone ${currentOffsetDisplay}.`;
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
    
    if (ctx.session) {
        ctx.session.waitingForUtcOffset = true; // Changed from waitingForTimezone
    }
    
    // const detectedTimezone = await guessUserTimezone(ctx); // guessUserTimezone returns IANA, needs rework for simple offset
    const detectedUtcOffset: string | null = null; // Placeholder, this will be part of Subtask 1.4

    const timezoneKeyboard = new Keyboard(); // This keyboard will be rebuilt in Subtask 1.4
    // ... (keyboard generation logic will be replaced)
    timezoneKeyboard.text("❌ Cancel");

    await ctx.reply(
        `Please select or enter your UTC offset (e.g., +2, -5, 0).\n\n` +
        `Your UTC offset is used to correctly schedule notifications at your preferred local time.\n\n` +
        `${detectedUtcOffset ? `We think your offset might be: UTC${detectedUtcOffset}` : 'We could not detect your UTC offset automatically.'}`,
        { reply_markup: timezoneKeyboard.resized() }
    );
}

/**
 * Handles user input for timezone setting
 */
export async function handleTimezoneInput(ctx: JournalBotContext, user: IUser) {
    if (!ctx.message || !('text' in ctx.message) || !ctx.session?.waitingForUtcOffset) { // Changed from waitingForTimezone
        return; 
    }
    const input = ctx.message.text || '';
    
    if (input === '❌ Cancel') {
        ctx.session.waitingForUtcOffset = false;
        await ctx.reply("Timezone setting cancelled.", {reply_markup: {remove_keyboard: true}});
        await showMainMenu(ctx, user);
        return;
    }
    
    // UTC offset validation will be handled here based on a new regex or validation function (Subtask 1.2/1.4)
    // For now, assume a valid offset string like "+2" or "-5"
    const offsetRegex = /^([+-])([0-9]|1[0-4])$|^0$/; // Simple example regex
    if (offsetRegex.test(input)) {
        await saveTimezone(ctx, user, input); // saveTimezone will now save utcOffset
    } else {
        await ctx.reply(
            "Sorry, that doesn\'t appear to be a valid UTC offset. Please use formats like \"+2\", \"-5\", or \"0\".",
            { reply_markup: new Keyboard().text('❌ Cancel').resized() }
        );
    }
}

/**
 * Helper function to save timezone and show confirmation
 */
async function saveTimezone(ctx: JournalBotContext, user: IUser, utcOffsetToSave: string) { // Renamed timezone to utcOffsetToSave
    try {
        await notificationService.updateUserNotificationSettings(
            user.telegramId,
            user.notificationsEnabled === true,
            undefined, 
            utcOffsetToSave // Pass utcOffsetToSave here
        );
        
        const updatedUser = await findOrCreateUser(user.telegramId, user.firstName, user.lastName, user.username);
        
        ctx.session.waitingForUtcOffset = false;
        
        // Displaying current time in local offset - this needs formatTimeWithTimezone and utcToLocalTime from Subtask 1.2
        // For now, just display the saved offset
        await ctx.reply(
            `Your UTC offset has been set to UTC${utcOffsetToSave}.`,
            { reply_markup: { remove_keyboard: true } }
        );
        
        await showMainMenu(ctx, updatedUser);
    } catch (error) {
        logger.error(`Error setting timezone for user ${user.telegramId}:`, error);
        await ctx.reply(
            "Sorry, something went wrong saving your timezone. Please try again.",
            { reply_markup: { remove_keyboard: true } }
        );
        ctx.session.waitingForUtcOffset = false;
        await showMainMenu(ctx, user);
    }
}

/**
 * Convert UTC offset to a standard IANA timezone
 */
function getTimezoneFromUTCOffset(offset: number): string {
    // Map of UTC offsets to common IANA timezone IDs
    const offsetMap: Record<string, string> = {
        '-12': 'Etc/GMT+12', // Note: Etc/GMT+ is negative UTC offset (confusing but correct)
        '-11': 'Etc/GMT+11',
        '-10': 'Pacific/Honolulu', // Hawaii
        '-9': 'America/Anchorage', // Alaska
        '-8': 'America/Los_Angeles', // Pacific Time
        '-7': 'America/Denver', // Mountain Time
        '-6': 'America/Chicago', // Central Time
        '-5': 'America/New_York', // Eastern Time
        '-4': 'America/Halifax', // Atlantic Time
        '-3': 'America/Sao_Paulo',
        '-2': 'Atlantic/South_Georgia',
        '-1': 'Atlantic/Azores',
        '0': 'UTC',
        '1': 'Europe/London',
        '2': 'Europe/Paris',
        '3': 'Europe/Moscow',
        '4': 'Asia/Dubai',
        '5': 'Asia/Karachi',
        '5.5': 'Asia/Kolkata', // India
        '6': 'Asia/Dhaka',
        '7': 'Asia/Bangkok',
        '8': 'Asia/Shanghai',
        '9': 'Asia/Tokyo',
        '10': 'Australia/Sydney',
        '11': 'Pacific/Noumea',
        '12': 'Pacific/Auckland',
        '13': 'Pacific/Apia',
        '14': 'Pacific/Kiritimati',
    };
    
    // Handle fractional offsets by using closest match or fallback to Etc/GMT format
    const offsetStr = offset.toString();
    
    if (offsetMap[offsetStr]) {
        return offsetMap[offsetStr];
    }
    
    // Fallback to Etc/GMT+X or Etc/GMT-X format
    // Note the sign is inverted in Etc/GMT format
    const sign = offset < 0 ? '+' : '-';
    const absOffset = Math.abs(offset);
    return `Etc/GMT${sign}${absOffset}`;
}

/**
 * Get a display representation of the UTC offset for a timezone
 */
function getUTCOffsetDisplay(timezone: string): string {
    try {
        const date = new Date();
        // Format the timezone with its UTC offset
        const formatter = new Intl.DateTimeFormat('en-GB', {
            timeZone: timezone,
            timeZoneName: 'longOffset'
        });
        
        const formatted = formatter.format(date);
        
        // Extract just the UTC offset portion
        const match = formatted.match(/GMT([+-]\d{1,2}(?::\d{2})?)/);
        if (match) {
            return `UTC${match[1]}`;
        }
        
        return timezone;
    } catch (error) {
        return timezone;
    }
}
