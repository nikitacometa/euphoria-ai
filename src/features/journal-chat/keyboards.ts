import { InlineKeyboard } from 'grammy';
import { MAIN_MENU_CALLBACKS } from '../core/keyboards';

// Callback data constants for chat keyboard
export const CHAT_CALLBACKS = {
  EXIT_CHAT: 'exit_chat_mode'
};

/**
 * Creates an inline keyboard for the journal chat mode
 */
export function createChatInlineKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("📝 Save This Chat", MAIN_MENU_CALLBACKS.NEW_ENTRY)
    .text("↩️ To Menu", MAIN_MENU_CALLBACKS.MAIN_MENU);
}
