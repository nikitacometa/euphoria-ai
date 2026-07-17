import { ZodType } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { GPT_VERSION } from '../config';
import { openai } from './client';

// Note: openai@4 only supports zod v3 (peer dependency ^3.23.8). With zod v4 this
// helper silently emits a malformed schema instead of failing; upgrading zod
// requires openai >= 6.7.0 first.

interface StructuredCallBase<T> {
    schema: ZodType<T>;
    schemaName: string;
    temperature?: number;
    maxTokens?: number;
}

interface StructuredPromptCallOptions<T> extends StructuredCallBase<T> {
    systemPrompt: string;
    userPrompt: string;
    messages?: never;
}

interface StructuredMessagesCallOptions<T> extends StructuredCallBase<T> {
    messages: ChatCompletionMessageParam[];
    systemPrompt?: never;
    userPrompt?: never;
}

export type StructuredCallOptions<T> =
    | StructuredPromptCallOptions<T>
    | StructuredMessagesCallOptions<T>;

export async function callStructured<T>(options: StructuredCallOptions<T>): Promise<T> {
    const messages = options.messages ?? [
        { role: 'system' as const, content: options.systemPrompt },
        { role: 'user' as const, content: options.userPrompt }
    ];
    const response = await openai.beta.chat.completions.parse({
        model: GPT_VERSION,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 500,
        response_format: zodResponseFormat(options.schema, options.schemaName)
    });

    const message = response.choices[0]?.message;
    if (!message) {
        throw new Error(`Structured response '${options.schemaName}' contained no message`);
    }
    if (message.refusal) {
        throw new Error(`Structured response '${options.schemaName}' was refused: ${message.refusal}`);
    }
    if (message.parsed == null) {
        throw new Error(`Structured response '${options.schemaName}' contained no parsed result`);
    }

    return message.parsed;
}
