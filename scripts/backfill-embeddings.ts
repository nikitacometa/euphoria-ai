import { embedText } from '../src/ai/embeddings';
import { Types } from 'mongoose';
import { LOG_LEVEL } from '../src/config';
import {
    connectToDatabase,
    disconnectFromDatabase,
    JournalEntry,
    JournalEntryStatus,
    updateJournalEntryEmbedding
} from '../src/database';
import { extractFullText } from '../src/utils/entry-text';
import { createLogger } from '../src/utils/logger';

const backfillLogger = createLogger('BackfillEmbeddings', LOG_LEVEL);
const EMBEDDING_DELAY_MS = 100;

function delay(milliseconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function backfillEmbeddings(): Promise<void> {
    await connectToDatabase();

    try {
        const entries = await JournalEntry.find({
            status: JournalEntryStatus.COMPLETED,
            embedding: { $exists: false }
        }).select('+embedding').populate('messages');

        for (let index = 0; index < entries.length; index += 1) {
            const entry = entries[index];

            try {
                const fullText = entry.fullText || extractFullText(entry);
                const embedding = await embedText(fullText);
                await updateJournalEntryEmbedding(entry._id as unknown as Types.ObjectId, embedding);
                backfillLogger.info(`Embedded journal entry ${index + 1}/${entries.length}`);
            } catch (error) {
                backfillLogger.error(`Failed to embed journal entry ${index + 1}/${entries.length}:`, error);
            }

            if (index < entries.length - 1) {
                await delay(EMBEDDING_DELAY_MS);
            }
        }
    } finally {
        await disconnectFromDatabase();
    }
}

backfillEmbeddings()
    .then(() => process.exit(0))
    .catch(error => {
        backfillLogger.error('Embedding backfill failed:', error);
        process.exit(1);
    });
