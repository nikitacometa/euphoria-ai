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
    
    // Format notification time with user's timezone if available
    let notificationTimeDisplay = "⏱️ Not set";
    if (user.notificationTime) {
        const timezone = user.timezone || 'UTC';
        const localTime = convertFromUTC(user.notificationTime, timezone);
        notificationTimeDisplay = formatTimeWithTimezone(localTime, timezone);
    }
    
    // Format timezone information with UTC offset for clarity
    let timezoneDisplay = "UTC (default)";
    if (user.timezone) {
        const offsetDisplay = getUTCOffsetDisplay(user.timezone);
        timezoneDisplay = `${user.timezone} (${offsetDisplay})`;
    }
    
    const transcriptionStatus = user.showTranscriptions === true ? "✅" : "❌";
    const languageStatus = user.aiLanguage === 'en' ? "🇬🇧 English" : "🇷🇺 Russian";
    
    return `🔔 <b>Remind me to journal?</b> ${notificationStatus}\n\n` +
           `⏰ <b>Every day at:</b> ${notificationTimeDisplay}\n\n` +
           `🌍 <b>My timezone:</b> ${timezoneDisplay}\n\n` +
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
    const offsetDisplay = getUTCOffsetDisplay(timezone);
    
    // Custom keyboard for time input or cancel
    const cancelKeyboard = new Keyboard()
        .text('❌ Cancel')
        .resized();
    
    await ctx.reply(
        `Please enter a time for your daily journaling reminder using 24-hour format.\n\n` +
        `Example: '21:00' for 9 PM.\n\n` +
        `This time will be interpreted in YOUR LOCAL TIMEZONE: ${timezone} ${offsetDisplay}\n\n` +
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
            
            // The time provided by the user is in their local timezone
            // notificationService.updateUserNotificationSettings will handle the conversion to UTC
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
            
            // Get notification time info with correct timezone conversion
            const timeInfo = await notificationService.getUserNotificationTime(user.telegramId);
            
            // Format confirmation message showing the time in their local timezone
            let confirmationMessage = `Great! I'll send you notifications at ${time} in your timezone (${timezone}) 🌟`;
            
            if (timeInfo) {
                // Display the time with timezone information for clarity
                confirmationMessage = `Great! I'll send you notifications at ${formatTimeWithTimezone(timeInfo.localTime, timeInfo.timezone)} 🌟`;
                
                // Add explanation about how timezone conversion works
                const offsetDisplay = getUTCOffsetDisplay(timezone);
                confirmationMessage += `\n\nYour time will be saved as ${timeInfo.utcTime} UTC but displayed to you in your local timezone ${offsetDisplay}.`;
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
    
    // Add this flag so we know user is setting timezone
    if (ctx.session) {
        ctx.session.waitingForTimezone = true;
    }
    
    // Try to automatically detect user's timezone
    const detectedTimezone = await guessUserTimezone(ctx);
    
    // Create a keyboard with UTC offset options
    const timezoneKeyboard = new Keyboard();
    
    // Add detected timezone at the top if available
    if (detectedTimezone) {
        timezoneKeyboard.text(`Detected: ${detectedTimezone}`).row();
    }
    
    // Add UTC-7 to UTC-1
    timezoneKeyboard
        .text("UTC-7").text("UTC-6").text("UTC-5").row()
        .text("UTC-4").text("UTC-3").text("UTC-2").row()
        .text("UTC-1").text("UTC").text("UTC+1").row()
        .text("UTC+2").text("UTC+3").text("UTC+4").row()
        .text("UTC+5").text("UTC+6").text("UTC+7").row()
        .text("UTC+8").text("UTC+9").text("UTC+10").row()
        .text("🔍 Custom UTC offset").row()
        .text("❌ Cancel");
    
    await ctx.reply(
        `Please select your timezone offset from UTC.\n\n` +
        `Your timezone is used to correctly schedule notifications at your preferred local time.\n\n` +
        `${detectedTimezone ? `Your detected timezone is: ${detectedTimezone}` : 'We could not detect your timezone automatically.'}`,
        { reply_markup: timezoneKeyboard.resized() }
    );
}

/**
 * Handles user input for timezone setting
 */
export async function handleTimezoneInput(ctx: JournalBotContext, user: IUser) {
    if (!ctx.message || !('text' in ctx.message) || !ctx.session?.waitingForTimezone) {
        return; 
    }

    // Get the text input, ensuring it's not undefined
    const input = ctx.message.text || '';
    
    if (input === '❌ Cancel') {
        ctx.session.waitingForTimezone = false;
        await ctx.reply("Timezone setting cancelled.", {reply_markup: {remove_keyboard: true}});
        await showMainMenu(ctx, user);
        return;
    }
    
    if (input === '🔍 Custom UTC offset') {
        await ctx.reply(
            "Please enter your timezone offset in format UTC+X or UTC-X (e.g., 'UTC+5.5', 'UTC-3').\n\n" +
            "Use decimal numbers for half-hour offsets (like UTC+5.5 for India).",
            { reply_markup: new Keyboard().text('❌ Cancel').resized() }
        );
        return;
    }
    
    if (input.startsWith("Detected: ")) {
        const detectedTz = input.replace("Detected: ", "");
        if (detectedTz && isValidTimezone(detectedTz)) {
            await saveTimezone(ctx, user, detectedTz);
            return;
        } else {
            await ctx.reply(
                "Sorry, the detected timezone appears to be invalid. Please select a different option.",
                { reply_markup: new Keyboard().text('❌ Cancel').resized() }
            );
            return;
        }
    }
    
    // Handle UTC offset format (UTC+X or UTC-X)
    const utcRegex = /^UTC([+-]\d+(\.\d+)?)$/;
    if (utcRegex.test(input)) {
        const offset = input.replace("UTC", "");
        const offsetNum = parseFloat(offset);
        
        // Validate offset range (-12 to +14 is standard range)
        if (offsetNum >= -12 && offsetNum <= 14) {
            // Convert UTC offset to IANA format for storage
            // We'll use a mapping to the most common zone for each offset
            const timezone = getTimezoneFromUTCOffset(offsetNum);
            await saveTimezone(ctx, user, timezone);
            return;
        } else {
            await ctx.reply(
                "Sorry, that doesn't appear to be a valid UTC offset. Please use a value between UTC-12 and UTC+14.",
                { reply_markup: new Keyboard().text('❌ Cancel').resized() }
            );
            return;
        }
    }
    
    // Last resort: try as direct IANA timezone
    if (input && isValidTimezone(input)) {
        await saveTimezone(ctx, user, input);
    } else {
        await ctx.reply(
            "Sorry, that doesn't appear to be a valid timezone format. Please select from the options or use the UTC+X format.",
            { reply_markup: new Keyboard().text('❌ Cancel').resized() }
        );
    }
}

/**
 * Helper function to save timezone and show confirmation
 */
async function saveTimezone(ctx: JournalBotContext, user: IUser, timezone: string) {
    try {
        // Update the user's timezone using notification service
        await notificationService.updateUserNotificationSettings(
            user.telegramId,
            user.notificationsEnabled === true,
            undefined, // Keep existing notification time
            timezone
        );
        
        // Refresh user data
        const updatedUser = await findOrCreateUser(user.telegramId, user.firstName, user.lastName, user.username);
        
        // Reset the waiting flag
        ctx.session.waitingForTimezone = false;
        
        // Show confirmation with current time in their timezone
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZoneName: 'short'
        });
        
        const currentTime = formatter.format(now);
        const offsetDisplay = getUTCOffsetDisplay(timezone);
        
        await ctx.reply(
            `Your timezone has been set to ${timezone} (${offsetDisplay}).\n` +
            `Your current local time should be around ${currentTime}.`,
            { reply_markup: { remove_keyboard: true } }
        );
        
        await showMainMenu(ctx, updatedUser);
    } catch (error) {
        logger.error(`Error setting timezone for user ${user.telegramId}:`, error);
        await ctx.reply(
            "Sorry, something went wrong saving your timezone. Please try again.",
            { reply_markup: { remove_keyboard: true } }
        );
        ctx.session.waitingForTimezone = false;
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
