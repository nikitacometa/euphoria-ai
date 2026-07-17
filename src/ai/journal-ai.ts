import { IJournalEntry, IUser } from '../database';
import { createLogger } from '../utils/logger';
import { GPT_VERSION, LOG_LEVEL } from '../config';
import { extractFullText } from '../utils/entry-text';
import { openai } from './client';
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

/** Generates 2-3 follow-up questions for a journal entry. */
export async function generateJournalQuestions(entry: IJournalEntry, user: IUser): Promise<string[]> {
    try {
        const entryContent = extractFullText(entry);
        if (!entryContent) {
            return ['What would you like to write about today?'];
        }

        const response = await openai.chat.completions.create({
            model: GPT_VERSION,
            messages: [
                { role: 'system', content: GENERATE_QUESTIONS_PROMPT },
                {
                    role: 'user',
                    content: `${buildUserInfo(user)}\n\nJournal Entry:\n${entryContent}\n\nPlease generate 2-3 thoughtful follow-up questions.`
                }
            ],
            temperature: 0.7,
            max_tokens: 500,
            response_format: { type: 'json_object' }
        });

        const content = response.choices[0]?.message?.content || '{}';
        try {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
                return parsed.questions;
            }
            journalAiLogger.warn('No valid questions array in response:', content);
            return DEFAULT_QUESTIONS;
        } catch (parseError) {
            journalAiLogger.error('Error parsing questions JSON:', parseError, 'raw content:', content);
            return DEFAULT_QUESTIONS;
        }
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

const FALLBACK_SUMMARY: EntrySummary = {
    summary: 'Thank you for sharing your thoughts.',
    question: 'What else would you like to reflect on?'
};

/** Produces a one-sentence summary and one reflection question for a finished entry. */
export async function generateEntrySummary(entry: IJournalEntry, user: IUser): Promise<EntrySummary> {
    const entryContent = extractFullText(entry);

    const response = await openai.chat.completions.create({
        model: GPT_VERSION,
        messages: [
            { role: 'system', content: ENTRY_SUMMARY_PROMPT },
            {
                role: 'user',
                content: `${buildUserInfo(user)}\n\nJournal Entry:\n${entryContent}\n\nPlease provide a one-sentence summary and one thoughtful question.`
            }
        ],
        temperature: 0.7,
        max_tokens: 300,
        response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content || '{}';
    try {
        const parsed = JSON.parse(content);
        return {
            summary: parsed.summary || FALLBACK_SUMMARY.summary,
            question: parsed.question || FALLBACK_SUMMARY.question
        };
    } catch (parseError) {
        journalAiLogger.error('Error parsing entry summary JSON:', parseError);
        return FALLBACK_SUMMARY;
    }
}

export interface ParsedBio {
    parsedBio: string;
    structuredInfo: Record<string, unknown>;
}

/** Extracts structured profile details from a free-form bio. */
export async function parseBioInformation(text: string): Promise<ParsedBio> {
    try {
        const response = await openai.chat.completions.create({
            model: GPT_VERSION,
            messages: [
                { role: 'system', content: PARSE_BIO_PROMPT },
                { role: 'user', content: `Parse the following bio information into a structured JSON format: "${text}"` }
            ],
            response_format: { type: 'json_object' }
        });

        const parsedBio = response.choices[0]?.message?.content || '{}';
        return { parsedBio, structuredInfo: JSON.parse(parsedBio) };
    } catch (error) {
        journalAiLogger.error('Error parsing bio information:', error);
        return { parsedBio: '{}', structuredInfo: {} };
    }
}
