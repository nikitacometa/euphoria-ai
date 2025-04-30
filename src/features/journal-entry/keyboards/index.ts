import { Keyboard, InlineKeyboard } from 'grammy';

// Button text constants
export const ButtonText = {
    NEW_ENTRY: "📝 New Entry",
    SHARE: "✅ Share", // From notification
    SAVE: "✅ Save",
    FINISH_REFLECTION: "✅ Finish Reflection",
    ANALYZE: "🔍 Analyze & Suggest Questions",
    CANCEL: "❌ Cancel",
    GO_DEEPER: "🤔 Go Deeper",
    CONFIRM_CANCEL: "Yes, discard entry",
    KEEP_WRITING: "No, keep writing"
} as const;

// Keyboard layouts
export const journalActionKeyboard = new Keyboard()
    .text(ButtonText.SAVE)
    .row()
    .text(ButtonText.ANALYZE)
    .row()
    .text(ButtonText.CANCEL)
    .resized();

export const confirmCancelKeyboard = new InlineKeyboard()
    .text(ButtonText.CONFIRM_CANCEL, "confirm_cancel_entry")
    .text(ButtonText.KEEP_WRITING, "keep_writing");

// Helper to create reply markup options
export function createReplyMarkup(keyboard: Keyboard | InlineKeyboard) {
    return {
        reply_markup: keyboard,
        parse_mode: 'HTML'
    } as const;
}

// Common keyboard options
export const KeyboardOptions = {
    journalAction: createReplyMarkup(journalActionKeyboard),
    confirmCancel: createReplyMarkup(confirmCancelKeyboard)
} as const; 