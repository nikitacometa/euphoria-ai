import { InlineKeyboard } from 'grammy';
import { IJournalEntry, IMessage, MessageType } from '../../types/models';

/**
 * Generates the inline keyboard for displaying journal history entries.
 */
export function createJournalHistoryKeyboard(entries: IJournalEntry[]): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    
    // Show max 10 entries like original code
    entries.slice(0, 10).forEach((entry) => {
        const date = new Date(entry.createdAt);
        // Consistent date formatting
        const formattedDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear().toString().slice(-2)}`;
        
        // Use entry name or fallback
        let entryName = entry.name || "Entry";
        
        // Add the entry button on its own row
        keyboard.text(`[${formattedDate}] ${entryName}`, `view_entry:${entry._id}`).row();
    });
    
    // Always add back button
    keyboard.text("↩️ Main Menu", "main_menu");
    
    return keyboard;
}

/**
 * Generates the inline keyboard for viewing a single journal entry.
 */
export function createViewEntryKeyboard(entryId: string): InlineKeyboard {
     return new InlineKeyboard()
        .text("🗑️ Remove", `delete_entry:${entryId}`)
        .row()
        .text("📚 Back", "journal_history")
        .text("↩️ Main Menu", "main_menu");
}
