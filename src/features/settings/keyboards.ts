import { InlineKeyboard } from 'grammy';
import { IUser } from '../../types/models';

/**
 * Creates the inline keyboard for the settings menu.
 * Dynamically changes button text based on user settings.
 */
export function createSettingsKeyboard(user: IUser): InlineKeyboard {
    return new InlineKeyboard()
        .text(user.notificationsEnabled ? "🔔 Disable Notifications" : "🔔 Enable Notifications", "toggle_notifications")
        .row()
        .text("⏰ Set Notification Time", "set_notification_time")
        .row()
        .text(user.showTranscriptions ? "🔇 Hide Transcriptions" : "🔊 Show Transcriptions", "toggle_transcriptions")
        .row()
        .text(user.aiLanguage === 'en' ? "🇬🇧 Switch to Russian" : "🇷🇺 Switch to English", "toggle_language")
        .row()
        .text("↩️ Back to Main Menu", "main_menu");
}
