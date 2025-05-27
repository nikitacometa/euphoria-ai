import { InlineKeyboard } from 'grammy';
import { IUser } from '../../../types/models';
import { t } from '../../../utils/localization';

// Button text constants are now for fallback or direct use if no localization needed
export const ButtonText = {
    NEW_ENTRY: "🦄 New Entry",
    SHARE: "✅ Share",
    SAVE: "✅ Save",
    FINISH_REFLECTION: "✅ Finish Reflection",
    ANALYZE: "✨ Ask AI Thoughts",
    CANCEL: "❌ Cancel",
    GO_DEEPER: "🤔 Go Deeper",
    // Confirm cancel buttons will be localized directly in the keyboard function
    // CONFIRM_CANCEL: "❌ Yes, Discard", 
    // KEEP_WRITING: "✍️ No, Continue"
} as const;

// Callback data constants
export const CALLBACKS = {
    SAVE: "journal_save",
    ANALYZE: "journal_analyze",
    CANCEL: "journal_cancel",
    CONFIRM_CANCEL: "confirm_cancel_entry",
    KEEP_WRITING: "keep_writing"
};

// Create keyboard function to support user context
export function createJournalActionKeyboard(user?: IUser): InlineKeyboard {
    return new InlineKeyboard()
        .text(t('journal:saveButton', { user, defaultValue: "✅ Save" }), CALLBACKS.SAVE)
        .text(t('journal:analyzeButton', { user, defaultValue: "✨ Analyze" }), CALLBACKS.ANALYZE)
        .text(t('common:cancel', { user, defaultValue: "❌ Cancel" }), CALLBACKS.CANCEL);
}

// For backward compatibility
export const journalActionKeyboard = createJournalActionKeyboard();

// Changed to a function to allow localization
export function createConfirmCancelKeyboard(user?: IUser): InlineKeyboard {
    return new InlineKeyboard()
        .text(t('journal:confirmCancelButton', { user, defaultValue: "❌ Yes, Discard" }), CALLBACKS.CONFIRM_CANCEL)
        .text(t('journal:keepWritingButton', { user, defaultValue: "✍️ No, Continue" }), CALLBACKS.KEEP_WRITING);
}
    

// Helper to create reply markup options
export function createReplyMarkup(keyboard: InlineKeyboard) {
    return {
        reply_markup: keyboard,
        parse_mode: 'HTML'
    } as const;
}

// KeyboardOptions might need adjustment if confirmCancelKeyboard is always dynamic
// For now, KeyboardOptions.confirmCancel would be an unlocalized version if used directly.
// It's better to call createConfirmCancelKeyboard(user) where needed.
export const KeyboardOptions = {
    journalAction: createReplyMarkup(journalActionKeyboard),
    // confirmCancel: createReplyMarkup(confirmCancelKeyboard) // This would be static
} as const; 