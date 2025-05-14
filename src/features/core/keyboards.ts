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
 * Creates an inline keyboard for the main menu, now with localizable button texts.
 */
export function createMainMenuInlineKeyboard(user?: IUser): InlineKeyboard {
  return new InlineKeyboard()
    .text(t('mainMenu.buttons.newEntry', { user, defaultValue: "📝 New Entry" }), MAIN_MENU_CALLBACKS.NEW_ENTRY)
    .text(t('mainMenu.buttons.journalHistory', { user, defaultValue: "📚 Journal History" }), MAIN_MENU_CALLBACKS.JOURNAL_HISTORY)
    .row()
    .text(t('mainMenu.buttons.askJournal', { user, defaultValue: "🤔 Ask My Journal" }), MAIN_MENU_CALLBACKS.JOURNAL_CHAT)
    .text(t('mainMenu.buttons.settings', { user, defaultValue: "⚙️ Settings" }), MAIN_MENU_CALLBACKS.SETTINGS);
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
