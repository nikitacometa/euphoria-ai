import { ZodType } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import { GPT_VERSION } from '../config';
import { openai } from './client';

export interface StructuredCallOptions<T> {
    schema: ZodType<T>;
    schemaName: string;
    systemPrompt: string;
    userPrompt: string;
    temperature?: number;
    maxTokens?: number;
}

export async function callStructured<T>(options: StructuredCallOptions<T>): Promise<T> {
    const response = await openai.beta.chat.completions.parse({
        model: GPT_VERSION,
        messages: [
            { role: 'system', content: options.systemPrompt },
            { role: 'user', content: options.userPrompt }
        ],
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
