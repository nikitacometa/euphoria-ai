import { z } from 'zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config', () => ({
    GPT_VERSION: 'test-gpt-model'
}));

vi.mock('./client', () => ({
    openai: {
        beta: {
            chat: {
                completions: {
                    parse: vi.fn()
                }
            }
        }
    }
}));

import { openai } from './client';
import { callStructured } from './structured';

const schema = z.object({ a: z.number() });

beforeEach(() => {
    vi.mocked(openai.beta.chat.completions.parse).mockReset();
});

describe('callStructured', () => {
    it('returns the parsed result', async () => {
        vi.mocked(openai.beta.chat.completions.parse).mockResolvedValue({
            id: 'completion-id',
            choices: [{
                finish_reason: 'stop',
                index: 0,
                logprobs: null,
                message: {
                    content: null,
                    parsed: { a: 1 },
                    refusal: null,
                    role: 'assistant'
                }
            }],
            created: 0,
            model: 'test-gpt-model',
            object: 'chat.completion'
        });

        await expect(callStructured({
            schema,
            schemaName: 'test_schema',
            systemPrompt: 'System instructions',
            userPrompt: 'User data'
        })).resolves.toEqual({ a: 1 });
    });

    it('throws an error containing the schema name and refusal', async () => {
        vi.mocked(openai.beta.chat.completions.parse).mockResolvedValue({
            id: 'completion-id',
            choices: [{
                finish_reason: 'stop',
                index: 0,
                logprobs: null,
                message: {
                    content: null,
                    parsed: null,
                    refusal: 'I cannot',
                    role: 'assistant'
                }
            }],
            created: 0,
            model: 'test-gpt-model',
            object: 'chat.completion'
        });

        await expect(callStructured({
            schema,
            schemaName: 'test_schema',
            systemPrompt: 'System instructions',
            userPrompt: 'User data'
        })).rejects.toThrow(/test_schema.*I cannot/u);
    });

    it.each([
        ['a null parsed result', {
            id: 'completion-id',
            choices: [{
                finish_reason: 'stop' as const,
                index: 0,
                logprobs: null,
                message: {
                    content: null,
                    parsed: null,
                    refusal: null,
                    role: 'assistant' as const
                }
            }],
            created: 0,
            model: 'test-gpt-model',
            object: 'chat.completion' as const
        }],
        ['no choices', {
            id: 'completion-id',
            choices: [],
            created: 0,
            model: 'test-gpt-model',
            object: 'chat.completion' as const
        }]
    ])('throws an error containing the schema name for %s', async (_case, response) => {
        vi.mocked(openai.beta.chat.completions.parse).mockResolvedValue(response);

        await expect(callStructured({
            schema,
            schemaName: 'test_schema',
            systemPrompt: 'System instructions',
            userPrompt: 'User data'
        })).rejects.toThrow('test_schema');
    });

    it.each([
        ['defaults', undefined, undefined, 0.7, 500],
        ['overrides', 0.2, 900, 0.2, 900]
    ])('composes the request with %s', async (
        _case,
        temperature,
        maxTokens,
        expectedTemperature,
        expectedMaxTokens
    ) => {
        vi.mocked(openai.beta.chat.completions.parse).mockResolvedValue({
            id: 'completion-id',
            choices: [{
                finish_reason: 'stop',
                index: 0,
                logprobs: null,
                message: {
                    content: null,
                    parsed: { a: 1 },
                    refusal: null,
                    role: 'assistant'
                }
            }],
            created: 0,
            model: 'test-gpt-model',
            object: 'chat.completion'
        });

        await callStructured({
            schema,
            schemaName: 'test_schema',
            systemPrompt: 'System instructions',
            userPrompt: 'User data',
            temperature,
            maxTokens
        });

        const request = vi.mocked(openai.beta.chat.completions.parse).mock.calls[0]?.[0];
        expect(request).toMatchObject({
            model: 'test-gpt-model',
            messages: [
                { role: 'system', content: 'System instructions' },
                { role: 'user', content: 'User data' }
            ],
            temperature: expectedTemperature,
            max_tokens: expectedMaxTokens
        });
    });
});
