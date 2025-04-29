import * as dotenv from 'dotenv';
import path from 'path';
import { LogLevel } from '../utils/logger';

// Load environment variables from .env file
dotenv.config({
    path: process.env.NODE_ENV === 'test' 
        ? path.resolve(process.cwd(), '.env.test')
        : path.resolve(process.cwd(), '.env')
});

/**
 * Environment types for type safety
 */
export type Environment = 'development' | 'test' | 'production';

/**
 * Configuration interface for strong typing
 */
export interface AppConfig {
    /**
     * Application environment 
     */
    env: Environment;

    /**
     * Telegram API settings
     */
    telegram: {
        /**
         * Telegram Bot API token
         */
        apiToken: string;
        /**
         * Maximum voice message length in seconds
         */
        maxVoiceMessageLengthSeconds: number;
    };

    /**
     * OpenAI API settings
     */
    openai: {
        /**
         * OpenAI API key
         */
        apiKey: string;
        /**
         * GPT model version to use
         */
        gptVersion: string;
    };

    /**
     * Database settings
     */
    database: {
        /**
         * MongoDB connection URI
         */
        uri: string;
        /**
         * MongoDB host
         */
        host: string;
        /**
         * MongoDB port
         */
        port: string;
        /**
         * MongoDB user
         */
        user: string;
        /**
         * MongoDB password
         */
        password: string;
        /**
         * MongoDB database name
         */
        name: string;
        /**
         * Mongo Express port (for development)
         */
        expressPort?: string;
    };

    /**
     * Logging settings
     */
    logging: {
        /**
         * Log level
         */
        level: LogLevel;
    };
}

/**
 * Get environment variable with validation
 * @param key Environment variable name
 * @param defaultValue Optional default value
 * @param required Whether the variable is required
 * @returns Environment variable value or default
 * @throws Error if required variable is missing
 */
function getEnv(key: string, defaultValue?: string, required = true): string {
    const value = process.env[key] || defaultValue;

    if (required && !value) {
        throw new Error(`Environment variable ${key} is required`);
    }

    return value || '';
}

/**
 * Get environment
 */
export const NODE_ENV: Environment = (process.env.NODE_ENV as Environment) || 'development';

/**
 * Configuration object
 */
export const config: AppConfig = {
    env: NODE_ENV,

    telegram: {
        apiToken: getEnv('TELEGRAM_API_TOKEN'),
        maxVoiceMessageLengthSeconds: parseInt(getEnv('MAX_VOICE_MESSAGE_LENGTH_SECONDS', '300', false))
    },

    openai: {
        apiKey: getEnv('OPENAI_API_KEY'),
        gptVersion: getEnv('GPT_VERSION', 'gpt-4-turbo')
    },

    database: {
        host: getEnv('MONGODB_HOST', 'localhost'),
        port: getEnv('MONGODB_PORT', '27017'),
        user: getEnv('MONGODB_USER', ''),
        password: getEnv('MONGODB_PASSWORD', ''),
        name: getEnv('MONGODB_DATABASE', 'journal_bot'),
        expressPort: getEnv('MONGO_EXPRESS_PORT', '8081', false),
        // Build URI based on credentials
        get uri() {
            return this.password ? 
                `mongodb://${this.user}:${this.password}@${this.host}:${this.port}/${this.name}?authSource=admin` 
                : `mongodb://${this.host}:${this.port}/${this.name}`;
        }
    },

    logging: {
        level: process.env.LOG_LEVEL ? 
            parseInt(process.env.LOG_LEVEL) as LogLevel : 
            LogLevel.INFO
    }
};

/**
 * Backward compatibility exports for legacy usage
 * These will be gradually phased out as code is updated to use the config object
 */
export const TELEGRAM_API_TOKEN = config.telegram.apiToken;
export const MAX_VOICE_MESSAGE_LENGTH_SECONDS = config.telegram.maxVoiceMessageLengthSeconds || 300;
export const OPENAI_API_KEY = config.openai.apiKey;
export const GPT_VERSION = config.openai.gptVersion;
export const MONGODB_HOST = config.database.host;
export const MONGODB_PORT = config.database.port;
export const MONGODB_USER = config.database.user;
export const MONGODB_PASSWORD = config.database.password;
export const MONGODB_DATABASE = config.database.name;
export const MONGO_EXPRESS_PORT = config.database.expressPort;
export const MONGODB_URI = config.database.uri;
export const LOG_LEVEL = config.logging.level; 