import { Keyboard } from 'grammy';

export const MAIN_MENU_KEYBOARD = new Keyboard()
    .text("📝 New Entry")
    .row()
    .text("📚 Journal History")
    .row()
    .text("🤔 Ask My Journal")
    .row()
    .text("⚙️ Settings")
    .resized();
