import * as dotenv from 'dotenv';
import { z } from 'zod';
import { LogLevel } from './utils/logger';

dotenv.config();

const environmentSchema = z.object({
    MONGODB_URI: z.string().min(1).optional(),
    MONGODB_HOST: z.string().default('mongodb'),
    MONGODB_PORT: z.string().default('27017'),
    MONGODB_USER: z.string().default('admin'),
    MONGODB_PASSWORD: z.string().default('password'),
    MONGODB_DATABASE: z.string().default('euphoria'),
    TELEGRAM_API_TOKEN: z.string().min(1),
    OPENAI_API_KEY: z.string().min(1),
    GPT_VERSION: z.string().default('gpt-4o'),
    LOG_LEVEL: z.coerce.number().int().min(0).max(5).default(LogLevel.INFO),
    ADMIN_TELEGRAM_IDS: z.string().default('').transform(value => value
        .split(',')
        .map(id => parseInt(id.trim(), 10))
        .filter(id => !isNaN(id))),
    ENABLE_ADMIN_INTERFACE: z.string().default('false').transform(value => value === 'true'),
    ADMIN_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    ADMIN_HOST: z.string().default('127.0.0.1'),
    ADMIN_PASSWORD: z.string().optional(),
    EMBEDDING_MODEL: z.string().default('text-embedding-3-small')
});

function parseEnvironment(): z.infer<typeof environmentSchema> {
    const result = environmentSchema.safeParse(process.env);
    if (!result.success) {
        const details = result.error.issues
            .map(issue => `- ${issue.path.join('.') || 'environment'}: ${issue.message}`)
            .join('\n');
        console.error(`Invalid environment configuration:\n${details}`);
        process.exit(1);
    }

    return result.data;
}

const environment = parseEnvironment();

export const MONGODB_URI: string = environment.MONGODB_URI ||
    `mongodb://${environment.MONGODB_USER}:${environment.MONGODB_PASSWORD}@${environment.MONGODB_HOST}:${environment.MONGODB_PORT}/${environment.MONGODB_DATABASE}?authSource=admin`;
export const TELEGRAM_API_TOKEN: string = environment.TELEGRAM_API_TOKEN;
export const OPENAI_API_KEY: string = environment.OPENAI_API_KEY;
export const GPT_VERSION: string = environment.GPT_VERSION;
export const LOG_LEVEL: LogLevel = environment.LOG_LEVEL as LogLevel;
/** Telegram user ids allowed to run admin commands (comma-separated env var). */
export const ADMIN_TELEGRAM_IDS: number[] = environment.ADMIN_TELEGRAM_IDS;
export const ENABLE_ADMIN_INTERFACE: boolean = environment.ENABLE_ADMIN_INTERFACE;
export const ADMIN_PORT: number = environment.ADMIN_PORT;
export const ADMIN_HOST: string = environment.ADMIN_HOST;
export const ADMIN_PASSWORD: string | undefined = environment.ADMIN_PASSWORD;
export const EMBEDDING_MODEL: string = environment.EMBEDDING_MODEL;
