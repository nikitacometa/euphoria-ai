import { Types } from 'mongoose';
import { z } from 'zod';
import type {
    ChatCompletionMessageParam,
    ChatCompletionMessageToolCall,
    ChatCompletionTool
} from 'openai/resources/chat/completions';
import { IUser } from '../database';
import { GPT_VERSION, LOG_LEVEL } from '../config';
import { retrieveRelevantEntries } from '../services/journal-retrieval';
import { extractFullText } from '../utils/entry-text';
import { createLogger } from '../utils/logger';
import { openai } from './client';
import {
    JOURNAL_AGENT_PROMPT,
    asData,
    buildUserInfo,
    languageInstruction
} from './prompts';
import { callStructured } from './structured';

const agentLogger = createLogger('JournalAgent', LOG_LEVEL);
const MAX_ITERATIONS = 4;
const DEFAULT_SEARCH_LIMIT = 6;
const MAX_ENTRY_TEXT_LENGTH = 1500;

const searchArgumentsSchema = z.object({
    query: z.string(),
    limit: z.number().int().positive().nullish()
});

const journalAgentResultSchema = z.object({
    answer: z.string(),
    followUpQuestions: z.array(z.string())
});

const tools: ChatCompletionTool[] = [{
    type: 'function',
    function: {
        name: 'search_journal',
        description: 'Search the user journal for entries relevant to a focused query.',
        strict: true,
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'A focused semantic search query.'
                },
                // Strict mode requires every property to be listed in `required`,
                // so an optional argument is expressed as a nullable one instead.
                limit: {
                    type: ['integer', 'null'],
                    description: 'Maximum number of journal entries to return, or null for the default.',
                    minimum: 1
                }
            },
            required: ['query', 'limit'],
            additionalProperties: false
        }
    }
}];

export interface JournalAgentResult {
    answer: string;
    followUpQuestions: string[];
    toolCallCount: number;
}

interface ToolExecutionResult {
    message: ChatCompletionMessageParam;
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown journal search error';
}

async function executeToolCall(
    userId: Types.ObjectId,
    toolCall: ChatCompletionMessageToolCall
): Promise<ToolExecutionResult> {
    let content: string;
    let entryCount = 0;
    let query: string | undefined;

    try {
        if (toolCall.function.name !== 'search_journal') {
            throw new Error(`Unknown tool: ${toolCall.function.name}`);
        }

        const parsedArguments: unknown = JSON.parse(toolCall.function.arguments);
        const argumentsResult = searchArgumentsSchema.safeParse(parsedArguments);
        if (!argumentsResult.success) {
            throw new Error(`Invalid search_journal arguments: ${argumentsResult.error.message}`);
        }

        query = argumentsResult.data.query;
        const entries = await retrieveRelevantEntries(
            userId,
            query,
            argumentsResult.data.limit ?? DEFAULT_SEARCH_LIMIT
        );
        entryCount = entries.length;
        content = JSON.stringify(entries.map(entry => ({
            date: new Date(entry.createdAt).toISOString(),
            text: (entry.fullText || extractFullText(entry)).slice(0, MAX_ENTRY_TEXT_LENGTH)
        })));
    } catch (error) {
        content = JSON.stringify({ error: errorMessage(error) });
    }

    agentLogger.debug('Journal search tool call:', { query, entryCount });
    return {
        message: {
            role: 'tool',
            tool_call_id: toolCall.id,
            content
        }
    };
}

export async function runJournalAgent(user: IUser, question: string): Promise<JournalAgentResult> {
    const userId = user._id as unknown as Types.ObjectId;
    const messages: ChatCompletionMessageParam[] = [
        {
            role: 'system',
            content: `${JOURNAL_AGENT_PROMPT}\n\n${languageInstruction(user)}`
        },
        {
            role: 'user',
            content: `${buildUserInfo(user)}\n\nQuestion:\n${asData('question', question)}`
        }
    ];
    let toolCallCount = 0;

    for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration += 1) {
        const response = await openai.chat.completions.create({
            model: GPT_VERSION,
            messages,
            tools,
            temperature: 0.7
        });
        const assistantMessage = response.choices[0]?.message;
        if (!assistantMessage) {
            throw new Error('Journal agent response contained no message');
        }

        const toolCalls = assistantMessage.tool_calls;
        if (!toolCalls || toolCalls.length === 0) {
            const result = await callStructured({
                schema: journalAgentResultSchema,
                schemaName: 'journal_agent_result',
                messages,
                temperature: 0.7,
                maxTokens: 500
            });
            agentLogger.debug('Journal agent completed:', { iteration, toolCallCount });
            return { ...result, toolCallCount };
        }

        messages.push({
            role: 'assistant',
            content: assistantMessage.content,
            tool_calls: toolCalls
        });
        toolCallCount += toolCalls.length;
        const toolResults = await Promise.all(
            toolCalls.map(toolCall => executeToolCall(userId, toolCall))
        );
        messages.push(...toolResults.map(result => result.message));
    }

    throw new Error(`Journal agent exceeded the ${MAX_ITERATIONS}-iteration cap`);
}
