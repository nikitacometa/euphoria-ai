import { InlineKeyboard } from 'grammy';
import { IUser } from '../../types/models';
import { MAIN_MENU_CALLBACKS } from '../core/keyboards';
import { t } from '../../utils/localization';

/**
 * Creates the inline keyboard for the settings menu.
 * Dynamically changes button text based on user settings and localization.
 */
export function createSettingsKeyboard(user: IUser): InlineKeyboard {
	const reminderButtonText = user.notificationsEnabled ? 
        t('settings:buttons.disableNotifications', {user, defaultValue: "❌ Disable 🔔"}) : 
        t('settings:buttons.enableNotifications', {user, defaultValue: "✅ Enable 🔔"});

	const transcriptionButtonText = user.showTranscriptions === true ? 
        t('settings:buttons.hideTranscriptions', {user, defaultValue: "🔇 Hide Transcribed"}) : 
        t('settings:buttons.showTranscriptions', {user, defaultValue: "🔊 Show Transcribed"});

	const languageButtonText = user.aiLanguage === 'en' ? 
        t('settings:buttons.useRussian', {user, defaultValue: "🇷🇺 Use Russian"}) : 
        t('settings:buttons.useEnglish', {user, defaultValue: "🇬🇧 Use English"});

	return new InlineKeyboard()
		.text(reminderButtonText, "toggle_notifications")
        .text(t('settings:buttons.setTime', {user, defaultValue: "⏰ Set Time"}), "set_notification_time")
		.row()
		.text(t('settings:buttons.setUtcOffset', {user, defaultValue: "🌍 Set UTC Offset"}), "set_timezone")
        .text(transcriptionButtonText, "toggle_transcriptions")
		.row()
		.text(languageButtonText, "toggle_language")
        .text(t('common.backToMainMenu', {user, defaultValue: "↩️ Menu"}), MAIN_MENU_CALLBACKS.MAIN_MENU);
}
