import { EMBEDDING_MODEL } from '../config';
import { openai } from './client';

const MAX_EMBEDDING_INPUT_LENGTH = 8000;

export async function embedText(text: string): Promise<number[]> {
    if (text.trim().length === 0) {
        throw new Error('Cannot embed empty text');
    }

    const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: text.slice(0, MAX_EMBEDDING_INPUT_LENGTH)
    });
    const embedding = response.data[0]?.embedding;

    if (!embedding) {
        throw new Error('Embedding response did not contain an embedding');
    }

    return embedding;
}

export function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
        throw new Error(`Cannot compare embeddings with different lengths: ${a.length} and ${b.length}`);
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let index = 0; index < a.length; index += 1) {
        const aValue = a[index];
        const bValue = b[index];
        dotProduct += aValue * bValue;
        normA += aValue * aValue;
        normB += bValue * bValue;
    }

    if (normA === 0 || normB === 0) {
        return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
