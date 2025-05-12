import { Keyboard, InlineKeyboard } from 'grammy';
import { MAIN_MENU_CALLBACKS } from '../core/keyboards';

// Legacy keyboard - keep for backward compatibility during transition
export const chatKeyboard = new Keyboard()
    .text("📋 Main Menu")
    .resized();

/**
 * Creates an inline keyboard for the journal chat mode
 */
export function createChatInlineKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("❌ Exit Chat Mode", "exit_chat_mode")
    .text("↩️ Main Menu", MAIN_MENU_CALLBACKS.MAIN_MENU);
}
