import * as dotenv from 'dotenv';
import { writeFile } from 'node:fs/promises';
import { z } from 'zod';
import type { IJournalEntry, IUser } from '../src/database';
import { createLogger } from '../src/utils/logger';
import { EVAL_CASES, EvalCase } from './cases';

dotenv.config();

const evalLogger = createLogger('PromptEvals');
const DEFAULT_QUESTIONS_FALLBACK = new Set([
    'What emotions came up for you while writing this?',
    'How does this connect to other parts of your life?',
    'What insights can you take from this experience?'
]);

const judgeSchema = z.object({
    score: z.number().int().min(1).max(5),
    reason: z.string().min(1)
});

type JudgeResult = z.infer<typeof judgeSchema>;

interface EvalStandIns {
    entry: IJournalEntry;
    user: IUser;
}

interface CaseResult {
    id: string;
    questionsPassed: boolean;
    analysisPassed: boolean;
    judge?: JudgeResult;
    judgeError?: string;
}

interface JournalAiModule {
    analyzeJournalEntry: (entry: IJournalEntry, user: IUser) => Promise<string>;
    generateJournalQuestions: (entry: IJournalEntry, user: IUser) => Promise<string[]>;
}

interface StructuredModule {
    callStructured: <T>(options: {
        schema: z.ZodType<T>;
        schemaName: string;
        systemPrompt: string;
        userPrompt: string;
        temperature?: number;
        maxTokens?: number;
    }) => Promise<T>;
}

function createEvalStandIns(evalCase: EvalCase): EvalStandIns {
    // Eval-only stand-ins intentionally provide just the fields consumed by journal-ai.
    const entry = {
        messages: [{ type: 'text', text: evalCase.entryText }]
    } as unknown as IJournalEntry;
    const user = {
        name: evalCase.user.name,
        firstName: evalCase.user.name,
        age: evalCase.user.age,
        occupation: evalCase.user.occupation,
        language: evalCase.user.language
    } as unknown as IUser;

    return { entry, user };
}

function questionsPass(questions: string[]): boolean {
    return questions.length >= 1 &&
        questions.length <= 3 &&
        questions.every(question => {
            const trimmed = question.trim();
            const wordCount = trimmed ? trimmed.split(/\s+/u).length : 0;
            return trimmed.length > 0 &&
                wordCount <= 12 &&
                !DEFAULT_QUESTIONS_FALLBACK.has(trimmed);
        });
}

function analysisPass(analysis: string): boolean {
    const bulletCount = analysis
        .split(/\r?\n/u)
        .filter(line => line.startsWith('• '))
        .length;

    return analysis.trim().length > 0 && bulletCount >= 2 && analysis.length <= 800;
}

function cell(value: string, width: number): string {
    return value.padEnd(width, ' ');
}

function renderConsoleTable(results: CaseResult[]): string {
    const headers = ['case id', 'questions', 'analysis', 'judge score'];
    const rows = results.map(result => [
        result.id,
        result.questionsPassed ? '✓' : '✗',
        result.analysisPassed ? '✓' : '✗',
        result.judge ? `${result.judge.score}/5` : result.judgeError ? 'error' : '—'
    ]);
    const widths = headers.map((header, index) => Math.max(
        header.length,
        ...rows.map(row => row[index]?.length ?? 0)
    ));
    const renderRow = (row: string[]): string => row
        .map((value, index) => cell(value, widths[index] ?? value.length))
        .join(' | ')
        .trimEnd();
    const separator = widths.map(width => '-'.repeat(width)).join('-|-');

    return [renderRow(headers), separator, ...rows.map(renderRow)].join('\n');
}

function renderMarkdown(results: CaseResult[], passed: number, failed: number): string {
    const rows = results.map(result => {
        const judgeScore = result.judge ? `${result.judge.score}/5` : result.judgeError ? 'error' : '—';
        return `| ${result.id} | ${result.questionsPassed ? '✓' : '✗'} | ${result.analysisPassed ? '✓' : '✗'} | ${judgeScore} |`;
    });

    return [
        '| case id | questions | analysis | judge score |',
        '| --- | --- | --- | --- |',
        ...rows,
        '',
        `${passed} passed, ${failed} failed`,
        ''
    ].join('\n');
}

async function judgeAnalysis(
    evalCase: EvalCase,
    analysis: string,
    structured: StructuredModule
): Promise<JudgeResult> {
    return structured.callStructured({
        schema: judgeSchema,
        schemaName: 'journal_analysis_judge',
        systemPrompt: 'You evaluate journal analyses. Score whether the analysis matches this persona: warm, concise, and insightful. Return a fair score from 1 to 5 and a brief reason.',
        userPrompt: `Journal entry:\n${evalCase.entryText}\n\nAnalysis:\n${analysis}`,
        temperature: 0,
        maxTokens: 120
    });
}

async function runCase(
    evalCase: EvalCase,
    journalAi: JournalAiModule,
    structured: StructuredModule,
    useJudge: boolean
): Promise<CaseResult> {
    const { entry, user } = createEvalStandIns(evalCase);
    let questions: string[] = [];
    let analysis = '';

    try {
        questions = await journalAi.generateJournalQuestions(entry, user);
    } catch (error) {
        evalLogger.error(`Question generation threw for '${evalCase.id}'`, error);
    }

    try {
        analysis = await journalAi.analyzeJournalEntry(entry, user);
    } catch (error) {
        evalLogger.error(`Analysis generation threw for '${evalCase.id}'`, error);
    }

    const result: CaseResult = {
        id: evalCase.id,
        questionsPassed: questionsPass(questions),
        analysisPassed: analysisPass(analysis)
    };

    if (useJudge) {
        try {
            result.judge = await judgeAnalysis(evalCase, analysis, structured);
        } catch (error) {
            result.judgeError = error instanceof Error ? error.message : String(error);
        }
    }

    return result;
}

async function main(): Promise<void> {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
        evalLogger.error('OPENAI_API_KEY is required. Add it to .env or export it before running npm run eval.');
        process.exitCode = 1;
        return;
    }

    // The shared app config validates this unrelated token during import; evals never use it.
    if (!process.env.TELEGRAM_API_TOKEN?.trim()) {
        process.env.TELEGRAM_API_TOKEN = 'eval-not-used';
    }

    const journalAi: JournalAiModule = await import('../src/ai/journal-ai.js');
    const structured: StructuredModule = await import('../src/ai/structured.js');
    const useJudge = process.argv.slice(2).includes('--judge');
    const results: CaseResult[] = [];

    for (const evalCase of EVAL_CASES) {
        results.push(await runCase(evalCase, journalAi, structured, useJudge));
    }

    const passed = results.filter(result => result.questionsPassed && result.analysisPassed).length;
    const failed = results.length - passed;
    const summary = `${passed} passed, ${failed} failed`;

    process.stdout.write(`${renderConsoleTable(results)}\n${summary}\n`);
    await writeFile('evals/last-run.md', renderMarkdown(results, passed, failed), 'utf8');

    for (const result of results) {
        if (result.judge && result.judge.score < 3) {
            evalLogger.warn(`Low judge score for '${result.id}': ${result.judge.score}/5 — ${result.judge.reason}`);
        }
        if (result.judgeError) {
            evalLogger.warn(`Judge failed for '${result.id}': ${result.judgeError}`);
        }
    }

    if (failed > 0) {
        process.exitCode = 1;
    }
}

main().catch(error => {
    evalLogger.error('Eval harness failed unexpectedly', error);
    process.exitCode = 1;
});
