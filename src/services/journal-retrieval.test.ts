import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { warn } = vi.hoisted(() => ({
    warn: vi.fn()
}));

vi.mock('../config', () => ({
    LOG_LEVEL: 4
}));

vi.mock('../database', () => ({
    getUserJournalEntriesWithEmbeddings: vi.fn()
}));

vi.mock('../ai/embeddings', () => ({
    cosineSimilarity: vi.fn(),
    embedText: vi.fn()
}));

vi.mock('../utils/logger', () => ({
    createLogger: () => ({
        debug: vi.fn(),
        warn
    })
}));

import { cosineSimilarity, embedText } from '../ai/embeddings';
import {
    getUserJournalEntriesWithEmbeddings,
    IJournalEntry
} from '../database';
import { retrieveRelevantEntries } from './journal-retrieval';

const userId = new Types.ObjectId();

function entry(id: string, createdAt: string, embedding?: number[]): IJournalEntry {
    return {
        _id: id,
        createdAt: new Date(createdAt),
        embedding
    } as unknown as IJournalEntry;
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(embedText).mockResolvedValue([1]);
    vi.mocked(cosineSimilarity).mockImplementation((_query, candidate) => candidate[0] ?? 0);
});

describe('retrieveRelevantEntries', () => {
    it('returns the top-scoring entries in chronological order', async () => {
        const oldest = entry('oldest', '2026-01-01', [0.8]);
        const middle = entry('middle', '2026-01-02', [-0.5]);
        const newest = entry('newest', '2026-01-03', [1]);
        vi.mocked(getUserJournalEntriesWithEmbeddings).mockResolvedValue([
            newest,
            middle,
            oldest
        ]);

        const result = await retrieveRelevantEntries(userId, 'query', 2);

        expect(result).toEqual([oldest, newest]);
    });

    it('fills remaining slots with the most recent entries without embeddings', async () => {
        const newestUnembedded = entry('newest-unembedded', '2026-01-03');
        const olderUnembedded = entry('older-unembedded', '2026-01-02');
        const scored = entry('scored', '2026-01-01', [1]);
        vi.mocked(getUserJournalEntriesWithEmbeddings).mockResolvedValue([
            newestUnembedded,
            olderUnembedded,
            scored
        ]);

        const result = await retrieveRelevantEntries(userId, 'query', 2);

        expect(result).toEqual([scored, newestUnembedded]);
    });

    it('falls back to the most recent entries when query embedding fails and logs it', async () => {
        const newest = entry('newest', '2026-01-03');
        const middle = entry('middle', '2026-01-02');
        const oldest = entry('oldest', '2026-01-01');
        vi.mocked(getUserJournalEntriesWithEmbeddings).mockResolvedValue([
            newest,
            middle,
            oldest
        ]);
        vi.mocked(embedText).mockRejectedValue(new Error('embedding unavailable'));

        const result = await retrieveRelevantEntries(userId, 'query', 2);

        expect(result).toEqual([middle, newest]);
        expect(warn).toHaveBeenCalledWith(
            'Failed to embed journal query; falling back to recent entries:',
            expect.objectContaining({ message: 'embedding unavailable' })
        );
    });

    it('returns an empty list when there are no journal entries', async () => {
        vi.mocked(getUserJournalEntriesWithEmbeddings).mockResolvedValue([]);

        await expect(retrieveRelevantEntries(userId, 'query')).resolves.toEqual([]);
    });

    it('propagates database failures', async () => {
        vi.mocked(getUserJournalEntriesWithEmbeddings)
            .mockRejectedValue(new Error('database unavailable'));

        await expect(retrieveRelevantEntries(userId, 'query'))
            .rejects.toThrow('database unavailable');
    });
});
