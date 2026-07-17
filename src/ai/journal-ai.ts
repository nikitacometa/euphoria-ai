import { IJournalEntry, IUser } from '../database';
import { z } from 'zod';
import { createLogger } from '../utils/logger';
import { GPT_VERSION, LOG_LEVEL } from '../config';
import { extractFullText } from '../utils/entry-text';
import { openai } from './client';
import { callStructured } from './structured';
import {
    ANALYZE_ENTRY_PROMPT,
    ENTRY_SUMMARY_PROMPT,
    GENERATE_QUESTIONS_PROMPT,
    JOURNAL_INSIGHTS_PROMPT,
    PARSE_BIO_PROMPT,
    buildUserInfo
} from './prompts';

const journalAiLogger = createLogger('JournalAI', LOG_LEVEL);

/** Analyzes a journal entry and returns 3 short insights. */
export async function analyzeJournalEntry(entry: IJournalEntry, user: IUser): Promise<string> {
    try {
        const entryContent = extractFullText(entry);
        if (!entryContent) {
            return 'Not enough content to analyze.';
        }

        const response = await openai.chat.completions.create({
            model: GPT_VERSION,
            messages: [
                { role: 'system', content: ANALYZE_ENTRY_PROMPT },
                {
                    role: 'user',
                    content: `${buildUserInfo(user)}\n\nJournal Entry:\n${entryContent}\n\nPlease analyze this journal entry and provide the 3 most important insights as short bullet points.`
                }
            ],
            temperature: 0.7,
            max_tokens: 300
        });

        return response.choices[0]?.message?.content || 'Unable to generate analysis.';
    } catch (error) {
        journalAiLogger.error('Error analyzing journal entry:', error);
        return 'Sorry, I encountered an error while analyzing your journal entry.';
    }
}

const DEFAULT_QUESTIONS = [
    'What emotions came up for you while writing this?',
    'How does this connect to other parts of your life?',
    'What insights can you take from this experience?'
];

const questionsSchema = z.object({
    questions: z.array(z.string()).min(1)
});

/** Generates 2-3 follow-up questions for a journal entry. */
export async function generateJournalQuestions(entry: IJournalEntry, user: IUser): Promise<string[]> {
    try {
        const entryContent = extractFullText(entry);
        if (!entryContent) {
            return ['What would you like to write about today?'];
        }

        const response = await callStructured({
            schema: questionsSchema,
            schemaName: 'journal_questions',
            systemPrompt: GENERATE_QUESTIONS_PROMPT,
            userPrompt: `${buildUserInfo(user)}\n\nJournal Entry:\n${entryContent}\n\nPlease generate 2-3 thoughtful follow-up questions.`,
            temperature: 0.7,
            maxTokens: 500
        });
        return response.questions;
    } catch (error) {
        journalAiLogger.error('Error generating journal questions:', error);
        return DEFAULT_QUESTIONS;
    }
}

/** Answers a question (or summarizes patterns) over a set of journal entries. */
export async function generateJournalInsights(
    entries: IJournalEntry[],
    user: IUser,
    question?: string
): Promise<string> {
    try {
        if (entries.length === 0) {
            return `${user.name || user.firstName}, you don't have any journal entries yet. Let's start journaling so I can provide you with insights!`;
        }

        const entriesSummary = entries
            .map((entry, index) => {
                const entryContent = entry.fullText || extractFullText(entry);
                const date = new Date(entry.createdAt).toLocaleDateString();
                return `Entry ${index + 1} (${date}):\n${entryContent}`;
            })
            .join('\n\n---\n\n');

        let userPrompt = `${buildUserInfo(user)}\n\nJournal Entries:\n${entriesSummary}\n\n`;
        if (question) {
            userPrompt += `Based on these entries, please answer the following question as concisely as possible: ${question}`;
        } else {
            userPrompt += 'Please provide a very brief analysis (1-3 sentences) of the most significant patterns or insights from these journal entries.';
        }

        const response = await openai.chat.completions.create({
            model: GPT_VERSION,
            messages: [
                { role: 'system', content: JOURNAL_INSIGHTS_PROMPT },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.7,
            max_tokens: 300
        });

        return response.choices[0]?.message?.content || 'Unable to generate insights.';
    } catch (error) {
        journalAiLogger.error('Error generating journal insights:', error);
        return `Sorry ${user.name || user.firstName}, I encountered an error while generating insights from your journal entries.`;
    }
}

export interface EntrySummary {
    summary: string;
    question: string;
}

const entrySummarySchema = z.object({
    summary: z.string(),
    question: z.string()
});

/** Produces a one-sentence summary and one reflection question for a finished entry. */
export async function generateEntrySummary(entry: IJournalEntry, user: IUser): Promise<EntrySummary> {
    const entryContent = extractFullText(entry);

    return callStructured({
        schema: entrySummarySchema,
        schemaName: 'entry_summary',
        systemPrompt: ENTRY_SUMMARY_PROMPT,
        userPrompt: `${buildUserInfo(user)}\n\nJournal Entry:\n${entryContent}\n\nPlease provide a one-sentence summary and one thoughtful question.`,
        temperature: 0.7,
        maxTokens: 300
    });
}

export interface ParsedBio {
    parsedBio: string;
    structuredInfo: Record<string, unknown>;
}

const bioSchema = z.object({
    age: z.number().nullable(),
    gender: z.string().nullable(),
    location: z.string().nullable(),
    occupation: z.string().nullable(),
    relationship_status: z.string().nullable(),
    hobbies: z.array(z.string()),
    goals: z.array(z.string()),
    other_details: z.array(z.string())
});

/** Extracts structured profile details from a free-form bio. */
export async function parseBioInformation(text: string): Promise<ParsedBio> {
    try {
        const structuredInfo = await callStructured({
            schema: bioSchema,
            schemaName: 'bio_information',
            systemPrompt: PARSE_BIO_PROMPT,
            userPrompt: `Bio text (between <bio> tags):\n<bio>\n${text}\n</bio>`
        });
        return { parsedBio: JSON.stringify(structuredInfo), structuredInfo };
    } catch (error) {
        journalAiLogger.error('Error parsing bio information:', error);
        return { parsedBio: '{}', structuredInfo: {} };
    }
}
