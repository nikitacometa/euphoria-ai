import { InlineKeyboard, Keyboard, Context } from 'grammy';
import { JournalBotContext } from '../../types/session';
import { IUser } from '../../types/models';
import { createSettingsKeyboard } from './keyboards';
import { logger } from '../../utils/logger';
import { notificationService } from '../../services/notification.service'; // Service for updating settings
import { findOrCreateUser, updateUserProfile } from '../../database'; // Added import for findOrCreateUser
import { showMainMenu } from '../core/handlers';
import { convertFromUTC, formatTimeWithTimezone, isValidUtcOffset, generateUTCOffsetKeyboard } from '../../utils/timezone';
import { t } from '../../utils/localization'; // Ensure t is imported

/**
 * Formats the settings text based on user settings
 */
function formatSettingsText(user: IUser): string {
    const notificationStatus = user.notificationsEnabled ? t('settings:notificationsEnabledIcon', {user, defaultValue: "✅"}) : t('settings:notificationsDisabledIcon', {user, defaultValue: "❌"});
    let notificationTimeDisplay = t('settings:timeNotSet', {user});
    if (user.notificationTime && user.utcOffset) {
        const localTime = convertFromUTC(user.notificationTime, user.utcOffset);
        notificationTimeDisplay = formatTimeWithTimezone(localTime, user.utcOffset); // This util already formats like "HH:mm (UTC+X)"
    }
    const transcriptionStatus = user.showTranscriptions === true ? t('settings:transcriptionsShowIcon', {user, defaultValue: "✅"}) : t('settings:transcriptionsHideIcon', {user, defaultValue: "❌"});
    const languageStatus = user.aiLanguage === 'en' ? t('settings:languageEnglish', {user}) : t('settings:languageRussian', {user});
    
    return `<b>${t('settings:remindMeHeader', {user})}</b> ${notificationStatus}\n\n` +
           `<b>${t('settings:everyDayAtHeader', {user})}</b> ${notificationTimeDisplay}\n\n` +
           `<b>${t('settings:showTranscribedHeader', {user})}</b> ${transcriptionStatus}\n\n` +
           `<b>${t('settings:aiChatPreferHeader', {user})}</b> ${languageStatus}\n\n` +
           `${t('settings:playWithSettingsTip', {user})}`;
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
        
        if (!updatedUser) throw new Error(t('errors:userProfileUpdateFailed', {user}));

        const keyboard = createSettingsKeyboard(updatedUser);
        await ctx.editMessageText(formatSettingsText(updatedUser), {
            reply_markup: keyboard,
            parse_mode: 'HTML'
        });
     } catch (error) {
         logger.error(`Error toggling notifications for user ${user.telegramId}:`, error);
         await ctx.reply(t('errors:settingsUpdateError', {user}));
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
        .text(t('common:cancel', {user}))
        .resized();
    
    await ctx.reply(
        t('settings:setNotificationTimePrompt', { user, currentOffsetDisplay: offsetDisplay }),
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
            if (!updatedUser) throw new Error(t('errors:userProfileUpdateFailed', {user}));

            ctx.session.waitingForNotificationTime = false;
            
            // Get notification time info with correct timezone conversion
            const timeInfo = await notificationService.getUserNotificationTime(user.telegramId);
            
            // Format confirmation message showing the time in their local timezone
            let confirmationMessage = t('settings:notificationTimeSetConfirmationSimple', {user, time, currentUtcOffset: userUtcOffset});
            
            if (timeInfo) {
                // timeInfo will come from notificationService.getUserNotificationTime, which will also need to return utcOffset
                confirmationMessage = t('settings:notificationTimeSetConfirmationDetailed', {user, localTime: timeInfo.localTime, currentOffsetDisplay: `UTC${timeInfo.utcOffset}`, utcTime: timeInfo.utcTime });
                
                const currentOffsetDisplay = `UTC${timeInfo.utcOffset || userUtcOffset}`;
                confirmationMessage += `\n\nYour time will be saved as ${timeInfo.utcTime} UTC but displayed to you in your local timezone ${currentOffsetDisplay}.`;
            }
            
            await ctx.reply(confirmationMessage, {reply_markup: {remove_keyboard: true}});
            await showMainMenu(ctx, updatedUser); // Show main menu again
        } catch(error) {
             logger.error(`Error setting notification time for user ${user.telegramId}:`, error);
             await ctx.reply(t('errors:notificationTimeSaveError', {user}));
             ctx.session.waitingForNotificationTime = false; // Clear flag on error too
             await showMainMenu(ctx, user); 
        }
    } else if (time === t('common:cancel', {user})) {
        ctx.session.waitingForNotificationTime = false;
        await ctx.reply(t('settings:timeSettingCancelled', {user}), {reply_markup: {remove_keyboard: true}});
        await showMainMenu(ctx, user);
    } else {
        await ctx.reply(t('settings:invalidTimeFormat', {user}));
    }
}

/**
 * Handles the `set_timezone` callback query.
 */
export async function setTimezoneHandler(ctx: JournalBotContext) {
    await ctx.answerCallbackQuery();
    
    if (ctx.session) {
        ctx.session.waitingForUtcOffset = true; 
    }
    
    // IANA based guessing is removed. Simple offset selection is preferred.
    const detectedUtcOffset: string | null = null; 

    const utcOffsetKeyboard = generateUTCOffsetKeyboard(); // Use the new keyboard generator

    await ctx.reply(
        t('settings:setUtcOffsetPrompt', {user: ctx.from as any as IUser}),
        { reply_markup: utcOffsetKeyboard.resized() } // Use resized() if it's a regular Keyboard
    );
}

/**
 * Handles user input for timezone setting
 */
export async function handleTimezoneInput(ctx: JournalBotContext, user: IUser) {
    if (!ctx.message || !('text' in ctx.message) || !ctx.session?.waitingForUtcOffset) { 
        return; 
    }
    const input = ctx.message.text || '';
    
    if (input === t('common:cancel', {user})) {
        ctx.session.waitingForUtcOffset = false;
        await ctx.reply(t('settings:timezoneSettingCancelled', {user}), {reply_markup: {remove_keyboard: true}});
        await showMainMenu(ctx, user);
        return;
    }
    
    // Input from keyboard will be like "UTC+5", "UTC0", "UTC-10"
    // Direct user typed input might be "+5", "0", "-10", "+5:30"
    let offsetToValidate = input;
    if (input.toUpperCase().startsWith('UTC')) {
        offsetToValidate = input.substring(3).trim();
    }

    if (isValidUtcOffset(offsetToValidate)) {
        await saveTimezone(ctx, user, offsetToValidate); 
    } else {
        await ctx.reply(
            t('settings:invalidUtcOffsetFormat', {user}),
            // Regenerate keyboard with cancel for retry
            { reply_markup: generateUTCOffsetKeyboard().text(t('common:cancel', {user})) } 
        );
    }
}

/**
 * Helper function to save timezone and show confirmation
 */
async function saveTimezone(ctx: JournalBotContext, user: IUser, utcOffsetToSave: string) { 
    try {
        await notificationService.updateUserNotificationSettings(
            user.telegramId,
            user.notificationsEnabled === true,
            user.notificationTime, // Keep existing notification time if set
            utcOffsetToSave 
        );
        
        const updatedUser = await findOrCreateUser(user.telegramId, user.firstName, user.lastName, user.username);
        
        ctx.session.waitingForUtcOffset = false;
        
        const displayOffset = (utcOffsetToSave.startsWith('+') || utcOffsetToSave.startsWith('-') || utcOffsetToSave === "0") 
                            ? utcOffsetToSave 
                            : `+${utcOffsetToSave}`;

        await ctx.reply(
            t('settings:utcOffsetSetConfirmation', {user, newOffset: displayOffset}),
            { reply_markup: { remove_keyboard: true } }
        );
        
        await showMainMenu(ctx, updatedUser);
    } catch (error) {
        logger.error(`Error setting timezone for user ${user.telegramId}:`, error);
        await ctx.reply(t('errors:utcOffsetSaveError', {user}));
        ctx.session.waitingForUtcOffset = false;
        await showMainMenu(ctx, user);
    }
}

// Helper replyWithHTML needs to be defined in this file or imported
async function replyWithHTML(ctx: JournalBotContext, message: string, options: Partial<Parameters<Context['reply']>[1]> = {}) {
    return ctx.reply(message, {
        parse_mode: 'HTML',
        ...options
    });
}
