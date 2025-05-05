import { str, num, bool, url, email, json, port, cleanEnv, makeValidator, CleanedEnvAccessors } from 'envalid';
import { LogLevel } from '../utils/logger';

// Custom validator for LogLevel enum
const logLevel = makeValidator<LogLevel>(value => {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed < 0 || parsed > 3) {
    throw new Error('Expected LOG_LEVEL to be a number between 0-3');
  }
  return parsed as LogLevel;
});

/**
 * Environment schema definition for validation
 */
export const envSchema = {
  // Telegram Bot
  TELEGRAM_API_TOKEN: str({
    desc: 'Telegram Bot API token from BotFather',
    example: '1234567890:ABCDefGhIJKlmNoPQRsTUVwxyZ'
  }),
  
  // OpenAI
  OPENAI_API_KEY: str({
    desc: 'OpenAI API key for AI services',
    example: 'sk-1234567890abcdef1234567890abcdef'
  }),
  GPT_VERSION: str({
    desc: 'OpenAI GPT model version to use',
    example: 'gpt-4-turbo',
    default: 'gpt-4-turbo'
  }),
  
  // Human Design API
  HUMAN_DESIGN_API_KEY: str({
    desc: 'Human Design API key',
    example: 'hd-api-key-123456',
    default: ''
  }),
  HUMAN_DESIGN_API_BASE_URL: str({
    desc: 'Human Design API base URL',
    example: 'https://api.humandesign.com/v1',
    default: ''
  }),
  
  // MongoDB
  MONGODB_HOST: str({
    desc: 'MongoDB host',
    default: 'localhost'
  }),
  MONGODB_PORT: port({
    desc: 'MongoDB port',
    default: 27017
  }),
  MONGODB_USER: str({
    desc: 'MongoDB username',
    default: ''
  }),
  MONGODB_PASSWORD: str({
    desc: 'MongoDB password',
    default: ''
  }),
  MONGODB_DATABASE: str({
    desc: 'MongoDB database name',
    default: 'euphoria'
  }),
  MONGO_EXPRESS_PORT: port({
    desc: 'Mongo Express admin interface port',
    default: 8081
  }),
  
  // Logging
  LOG_LEVEL: logLevel({
    desc: 'Log level (0=ERROR, 1=WARN, 2=INFO, 3=DEBUG)',
    default: LogLevel.INFO
  }),
  
  // Message settings
  MAX_VOICE_MESSAGE_LENGTH_SECONDS: num({
    desc: 'Maximum length of voice messages in seconds',
    default: 300
  }),
  
  // Support and monitoring
  SUPPORT_CHAT_ID: str({
    desc: 'Telegram chat ID for admin notifications',
    default: ''
  }),
  ADMIN_CHAT_ID: str({
    desc: 'Telegram chat ID exclusively for critical error alerts', 
    default: '' // Optional, but recommended for production
  }),
  ADMIN_IDS: str({
    desc: 'Comma-separated list of Telegram admin user IDs',
    default: ''
  }),
  NOTIFICATION_ALERT_THRESHOLD: num({
    desc: 'Number of failures before alerting',
    default: 3
  }),
  MAX_NOTIFICATION_RETRIES: num({
    desc: 'Max retries for failed notifications',
    default: 3
  })
};

/**
 * Type definition for the cleaned environment variables
 */
export type CleanEnv = CleanedEnvAccessors & {
  TELEGRAM_API_TOKEN: string;
  OPENAI_API_KEY: string;
  GPT_VERSION: string;
  HUMAN_DESIGN_API_KEY: string;
  HUMAN_DESIGN_API_BASE_URL: string;
  MONGODB_HOST: string;
  MONGODB_PORT: number;
  MONGODB_USER: string;
  MONGODB_PASSWORD: string;
  MONGODB_DATABASE: string;
  MONGO_EXPRESS_PORT: number;
  LOG_LEVEL: LogLevel;
  MAX_VOICE_MESSAGE_LENGTH_SECONDS: number;
  SUPPORT_CHAT_ID: string;
  ADMIN_CHAT_ID: string;
  ADMIN_IDS: string;
  NOTIFICATION_ALERT_THRESHOLD: number;
  MAX_NOTIFICATION_RETRIES: number;
};

/**
 * Validates all environment variables and returns a clean, typed environment object
 * @returns Clean, validated environment variables with defaults applied
 * @throws Error if required variables are missing or invalid
 */
export function validateEnv(): CleanEnv {
  // Check for test environment to handle special cases
  const isTest = process.env.NODE_ENV === 'test';
  
  // In test environment, allow a reporter that doesn't exit process
  const options = isTest ? { reporter: ({ errors }: { errors: Record<string, Error> }) => {
    if (Object.keys(errors).length > 0) {
      throw new Error(`Invalid environment variables: ${Object.keys(errors).join(', ')}`);
    }
  }} : {};
  
  return cleanEnv(process.env, envSchema, options);
} 