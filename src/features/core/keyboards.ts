import { InlineKeyboard } from 'grammy';
import { IUser } from '../../types/models';
import { t } from '../../utils/localization';

// Callback data constants for inline keyboard
export const MAIN_MENU_CALLBACKS = {
  NEW_ENTRY: 'main_new_entry',
  JOURNAL_HISTORY: 'main_journal_history',
  JOURNAL_CHAT: 'main_journal_chat',
  SETTINGS: 'main_settings',
  MAIN_MENU: 'main_menu'
};

/**
 * Creates the main menu inline keyboard with command buttons
 */
export function createMainMenuInlineKeyboard(user?: IUser): InlineKeyboard {
    return new InlineKeyboard()
        .text(t('common:mainMenu.newEntry', {user, defaultValue: "📝 New Entry"}), MAIN_MENU_CALLBACKS.NEW_ENTRY)
        .text(t('common:mainMenu.reportMood', {user, defaultValue: "📊 Report Mood"}), 'start_mood_report')
        .text(t('common:mainMenu.journalChat', {user, defaultValue: "💬 Ask Journal AI"}), MAIN_MENU_CALLBACKS.JOURNAL_CHAT)
        .row()
        .text(t('common:mainMenu.journalHistory', {user, defaultValue: "📚 Manage Entries"}), MAIN_MENU_CALLBACKS.JOURNAL_HISTORY)
        .text(t('common:mainMenu.settings', {user, defaultValue: "⚙️ Settings"}), MAIN_MENU_CALLBACKS.SETTINGS);
}

/**
 * Helper to add a "Back to Main Menu" button to any inline keyboard
 */
export function addMainMenuButton(keyboard: InlineKeyboard, user?: IUser): InlineKeyboard {
  return keyboard.row().text(t('common.backToMainMenu', {user, defaultValue: 'Back to Main Menu'}), MAIN_MENU_CALLBACKS.MAIN_MENU);
}

/**
 * Creates a simple "Back to Main Menu" inline keyboard
 */
export function createBackToMenuKeyboard(user?: IUser): InlineKeyboard {
  return new InlineKeyboard().text(t('common.backToMainMenu', {user, defaultValue: 'Back to Main Menu'}), MAIN_MENU_CALLBACKS.MAIN_MENU);
}
