import { Types } from 'mongoose';
import {
    addMessageToJournalEntry,
    getJournalEntryById,
    updateJournalEntryFullText
} from '../database';
import { extractFullText } from '../utils/entry-text';

/**
 * Links a saved message to its journal entry and refreshes the entry's
 * denormalized full text used for search and AI context.
 */
export async function appendMessageToEntry(
    entryId: Types.ObjectId,
    messageId: Types.ObjectId
): Promise<void> {
    await addMessageToJournalEntry(entryId, messageId);
    const updatedEntry = await getJournalEntryById(entryId);
    if (updatedEntry) {
        await updateJournalEntryFullText(entryId, extractFullText(updatedEntry));
    }
}
