import { InlineKeyboard } from 'grammy';
import { IUser } from '../../types/models';
import { MAIN_MENU_CALLBACKS } from '../core/keyboards';

/**
 * Creates the inline keyboard for the settings menu.
 * Dynamically changes button text based on user settings.
 */
export function createSettingsKeyboard(user: IUser): InlineKeyboard {
	const reminderButtonText = user.notificationsEnabled ? "❌ Disable 🔔" : "✅ Enable 🔔";
	const transcriptionButtonText = user.showTranscriptions === true ? "🔇 Hide Transcribed" : "🔊 Show Transcribed";
	const languageButtonText = user.aiLanguage === 'en' ? "🇷🇺 Use Russian" : "🇬🇧 Use English";

	return new InlineKeyboard()
		.text(reminderButtonText, "toggle_notifications").text("⏰ Set Time", "set_notification_time")
		.row()
		.text("🌍 Set Timezone", "set_timezone").text(transcriptionButtonText, "toggle_transcriptions")
		.row()
		.text(languageButtonText, "toggle_language").text("↩️ Menu", MAIN_MENU_CALLBACKS.MAIN_MENU);
}
