import { InlineKeyboard } from 'grammy';

// Callback data constants for inline keyboard
export const MAIN_MENU_CALLBACKS = {
  NEW_ENTRY: 'main_new_entry',
  JOURNAL_HISTORY: 'main_journal_history',
  JOURNAL_CHAT: 'main_journal_chat',
  SETTINGS: 'main_settings',
  MAIN_MENU: 'main_menu'
};

/**
 * Creates an inline keyboard for the main menu
 */
export function createMainMenuInlineKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("📝 New Entry", MAIN_MENU_CALLBACKS.NEW_ENTRY)
    .text("📚 Journal History", MAIN_MENU_CALLBACKS.JOURNAL_HISTORY)
    .row()
    .text("🤔 Ask My Journal", MAIN_MENU_CALLBACKS.JOURNAL_CHAT)
    .text("⚙️ Settings", MAIN_MENU_CALLBACKS.SETTINGS);
}

/**
 * Helper to add a "Back to Main Menu" button to any inline keyboard
 */
export function addMainMenuButton(keyboard: InlineKeyboard): InlineKeyboard {
  return keyboard.row().text('Back to Main Menu', MAIN_MENU_CALLBACKS.MAIN_MENU);
}

/**
 * Creates a simple "Back to Main Menu" inline keyboard
 */
export function createBackToMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text('Back to Main Menu', MAIN_MENU_CALLBACKS.MAIN_MENU);
}
