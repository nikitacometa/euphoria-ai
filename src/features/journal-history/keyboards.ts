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
        const formattedDate = `[${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear().toString().slice(-2)} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}]`;
        
        let textSnippet = "Entry"; // Default snippet
        if (entry.fullText) {
            textSnippet = entry.fullText.substring(0, 15) + (entry.fullText.length > 15 ? "..." : "");
        } else if (Array.isArray(entry.messages) && typeof entry.messages[0] !== 'string') {
            // Attempt snippet generation only if messages are populated
            const messages = entry.messages as IMessage[]; 
            const firstTextMessage = messages.find(msg => msg.type === MessageType.TEXT && msg.text);
            if (firstTextMessage?.text) {
                textSnippet = firstTextMessage.text.substring(0, 15) + (firstTextMessage.text.length > 15 ? "..." : "");
            }
        }
        
        // Add view and delete buttons in the same row
        keyboard
          .text(`${formattedDate} ${textSnippet}`, `view_entry:${entry._id}`)
          .text("🗑️ Delete", `delete_entry:${entry._id}`)
          .row();
    });
    
    // Always add back button
    keyboard.text("↩️ Back to Main Menu", "main_menu");
    
    return keyboard;
}

/**
 * Generates the inline keyboard for viewing a single journal entry.
 */
export function createViewEntryKeyboard(entryId: string): InlineKeyboard {
     return new InlineKeyboard()
        // .text("🔍 Analyze", `analyze_journal:${entryId}`) // Potential future feature
        // .text("💭 Go Deeper", `go_deeper:${entryId}`)     // Potential future feature
        .text("📚 Back to History", "journal_history") // Go back to the history list
        .row()
        .text("↩️ Back to Main Menu", "main_menu");
}
