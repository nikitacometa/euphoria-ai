import { InlineKeyboard } from 'grammy';
import { IJournalEntry, IMessage, MessageType } from '../../types/models';
import { MAIN_MENU_CALLBACKS } from '../core/keyboards';

/**
 * Generates the inline keyboard for displaying journal history entries.
 */
export function createJournalHistoryKeyboard(entries: IJournalEntry[]): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    
    // Show max 10 entries like original code
    let rowCount = 0;
    let rowButtons: { text: string, callback_data: string }[] = [];
    
    entries.slice(0, 10).forEach((entry, index) => {
        const date = new Date(entry.createdAt);
        // Consistent date formatting
        const formattedDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        
        // Use entry name or fallback
        let entryName = entry.name || "Entry";
        
        // Add the entry button to current row
        rowButtons.push({text: `[${formattedDate}] ${entryName}`, callback_data: `view_entry:${entry._id}`});
        
        // Create a row when we have 2 buttons or it's the last entry
        if (rowButtons.length === 2 || index === entries.length - 1) {
            keyboard.add(...rowButtons);
            keyboard.row();
            rowButtons = [];
        }
    });
    
    // Always add back button
    keyboard.text("🍌 Menu", MAIN_MENU_CALLBACKS.MAIN_MENU);
    
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
        .text("🍌 Menu", MAIN_MENU_CALLBACKS.MAIN_MENU);
}
