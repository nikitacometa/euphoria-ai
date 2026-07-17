import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config', () => ({
    EMBEDDING_MODEL: 'test-embedding-model'
}));

vi.mock('./client', () => ({
    openai: {
        embeddings: {
            create: vi.fn()
        }
    }
}));

import { openai } from './client';
import { cosineSimilarity, embedText } from './embeddings';

describe('cosineSimilarity', () => {
    it.each([
        ['identical', [1, 2], [1, 2], 1],
        ['orthogonal', [1, 0], [0, 1], 0],
        ['opposite', [1, 0], [-1, 0], -1],
        ['zero vector', [0, 0], [1, 2], 0]
    ])('returns the expected score for %s vectors', (_case, a, b, expected) => {
        expect(cosineSimilarity(a, b)).toBeCloseTo(expected, 9);
    });

    it('throws for vectors with different lengths', () => {
        expect(() => cosineSimilarity([1], [1, 2])).toThrow(
            'Cannot compare embeddings with different lengths'
        );
    });
});

describe('embedText', () => {
    beforeEach(() => {
        vi.mocked(openai.embeddings.create).mockReset();
    });

    it('truncates input longer than 8000 characters', async () => {
        vi.mocked(openai.embeddings.create).mockResolvedValue({
            data: [{ embedding: [0.25, 0.75], index: 0, object: 'embedding' }],
            model: 'test-embedding-model',
            object: 'list',
            usage: { prompt_tokens: 1, total_tokens: 1 }
        });

        await expect(embedText('x'.repeat(9000))).resolves.toEqual([0.25, 0.75]);

        const request = vi.mocked(openai.embeddings.create).mock.calls[0]?.[0];
        expect(request?.input).toHaveLength(8000);
    });

    it('propagates API failures', async () => {
        vi.mocked(openai.embeddings.create).mockRejectedValue(new Error('API unavailable'));

        await expect(embedText('journal text')).rejects.toThrow('API unavailable');
    });

    it('throws before calling the API for empty input', async () => {
        await expect(embedText('   ')).rejects.toThrow('Cannot embed empty text');
        expect(openai.embeddings.create).not.toHaveBeenCalled();
    });
});
