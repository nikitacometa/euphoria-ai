import { Types } from 'mongoose';
import { cosineSimilarity, embedText } from '../ai/embeddings';
import { LOG_LEVEL } from '../config';
import { getUserJournalEntriesWithEmbeddings, IJournalEntry } from '../database';
import { createLogger } from '../utils/logger';

const retrievalLogger = createLogger('JournalRetrieval', LOG_LEVEL);

export interface RetrievedEntry {
    entry: IJournalEntry;
    score: number;
}

export async function retrieveRelevantEntries(
    userId: Types.ObjectId,
    query: string,
    limit = 6
): Promise<IJournalEntry[]> {
    if (limit <= 0) {
        return [];
    }

    const entries = await getUserJournalEntriesWithEmbeddings(userId);
    let queryEmbedding: number[];

    try {
        queryEmbedding = await embedText(query);
    } catch (error) {
        retrievalLogger.warn('Failed to embed journal query; falling back to recent entries:', error);
        return entries.slice(0, limit).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    }

    const scoredEntries: RetrievedEntry[] = [];
    const unembeddedEntries: IJournalEntry[] = [];

    for (const entry of entries) {
        if (entry.embedding && entry.embedding.length === queryEmbedding.length) {
            scoredEntries.push({
                entry,
                score: cosineSimilarity(queryEmbedding, entry.embedding)
            });
        } else {
            unembeddedEntries.push(entry);
        }
    }

    scoredEntries.sort((a, b) => b.score - a.score);
    const selectedScoredEntries = scoredEntries.slice(0, limit);
    const remainingSlots = limit - selectedScoredEntries.length;
    const selectedEntries = [
        ...selectedScoredEntries.map(result => result.entry),
        ...unembeddedEntries.slice(0, remainingSlots)
    ];

    retrievalLogger.debug('Retrieved journal entries:', selectedScoredEntries.map(result => ({
        entryId: result.entry._id,
        score: result.score
    })));

    return selectedEntries.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}
