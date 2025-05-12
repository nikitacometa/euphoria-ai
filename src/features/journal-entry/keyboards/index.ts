import { InlineKeyboard } from 'grammy';

// Button text constants
export const ButtonText = {
    NEW_ENTRY: "📝 New Entry",
    SHARE: "✅ Share", // From notification
    SAVE: "✅ Save",
    FINISH_REFLECTION: "✅ Finish Reflection",
    ANALYZE: "👁️ AI Thoughts",
    CANCEL: "❌ Cancel",
    GO_DEEPER: "🤔 Go Deeper",
    CONFIRM_CANCEL: "❌ Yes, Discard",
    KEEP_WRITING: "✍️ No, Continue"
} as const;

// Callback data constants
export const CALLBACKS = {
    SAVE: "journal_save",
    ANALYZE: "journal_analyze",
    CANCEL: "journal_cancel",
    CONFIRM_CANCEL: "confirm_cancel_entry",
    KEEP_WRITING: "keep_writing"
};

// Keyboard layouts - using inline keyboards for consistency
export const journalActionKeyboard = new InlineKeyboard()
    .text(ButtonText.SAVE, CALLBACKS.SAVE)
    .text(ButtonText.ANALYZE, CALLBACKS.ANALYZE)
    .text(ButtonText.CANCEL, CALLBACKS.CANCEL);

export const confirmCancelKeyboard = new InlineKeyboard()
    .text(ButtonText.CONFIRM_CANCEL, CALLBACKS.CONFIRM_CANCEL)
    .text(ButtonText.KEEP_WRITING, CALLBACKS.KEEP_WRITING);

// Helper to create reply markup options
export function createReplyMarkup(keyboard: InlineKeyboard) {
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