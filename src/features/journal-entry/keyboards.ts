import { Keyboard } from 'grammy';

export const journalActionKeyboard = new Keyboard()
    .text("✅ Save")
    .row()
    .text("🔍 Analyze & Suggest Questions")
    .row()
    .text("❌ Cancel")
    .resized();
