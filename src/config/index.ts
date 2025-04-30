import * as dotenv from 'dotenv';
import path from 'path';
import { LogLevel } from '../utils/logger';
import { validateEnv } from './validation';
import { 
  Environment, 
  TelegramConfig,
  OpenAIConfig,
  DatabaseConfig,
  LoggingConfig,
  SupportConfig,
  AppConfig
} from './types';

// Load environment variables from .env file
dotenv.config({
    path: process.env.NODE_ENV === 'test' 
        ? path.resolve(process.cwd(), '.env.test')
        : path.resolve(process.cwd(), '.env')
});

/**
 * Get environment
 */
export const NODE_ENV: Environment = (process.env.NODE_ENV as Environment) || 'development';

/**
 * Application configuration with validated environment variables
 */
const env = validateEnv();

/**
 * Telegram Bot configuration
 */
export const telegramConfig: TelegramConfig = {
  /**
   * Telegram Bot API token
   */
  apiToken: env.TELEGRAM_API_TOKEN,
  
  /**
   * Maximum length of voice messages in seconds
   */
  maxVoiceMessageLengthSeconds: env.MAX_VOICE_MESSAGE_LENGTH_SECONDS
};

/**
 * OpenAI configuration
 */
export const openAIConfig: OpenAIConfig = {
  /**
   * OpenAI API key
   */
  apiKey: env.OPENAI_API_KEY,
  
  /**
   * OpenAI GPT model version
   */
  gptVersion: env.GPT_VERSION,
};

/**
 * MongoDB configuration
 */
export const databaseConfig: DatabaseConfig = {
  /**
   * MongoDB host
   */
  host: env.MONGODB_HOST,
  
  /**
   * MongoDB port
   */
  port: env.MONGODB_PORT.toString(),
  
  /**
   * MongoDB user
   */
  user: env.MONGODB_USER,
  
  /**
   * MongoDB password
   */
  password: env.MONGODB_PASSWORD,
  
  /**
   * MongoDB database name
   */
  name: env.MONGODB_DATABASE,
  
  /**
   * MongoDB Express admin interface port
   */
  expressPort: env.MONGO_EXPRESS_PORT.toString(),
  
  /**
   * MongoDB connection URI
   */
  uri: env.MONGODB_PASSWORD ? 
    `mongodb://${env.MONGODB_USER}:${env.MONGODB_PASSWORD}@${env.MONGODB_HOST}:${env.MONGODB_PORT}/${env.MONGODB_DATABASE}?authSource=admin` 
    : `mongodb://${env.MONGODB_HOST}:${env.MONGODB_PORT}/${env.MONGODB_DATABASE}`,
};

/**
 * Logging configuration
 */
export const loggingConfig: LoggingConfig = {
  /**
   * Application log level
   */
  level: env.LOG_LEVEL,
};

/**
 * Support and monitoring configuration
 */
export const supportConfig: SupportConfig = {
  /**
   * Telegram chat ID for admin notifications
   */
  supportChatId: env.SUPPORT_CHAT_ID,
  
  /**
   * List of admin user IDs
   */
  adminIds: env.ADMIN_IDS.length > 0 ? 
    env.ADMIN_IDS.split(',').map(id => parseInt(id.trim())) : [],
  
  /**
   * Number of failures before alerting
   */
  notificationAlertThreshold: env.NOTIFICATION_ALERT_THRESHOLD,
  
  /**
   * Max retries for failed notifications
   */
  maxNotificationRetries: env.MAX_NOTIFICATION_RETRIES,
};

/**
 * Consolidated application configuration
 */
const config: AppConfig = {
  env: NODE_ENV,
  telegram: telegramConfig,
  openai: openAIConfig,
  database: databaseConfig,
  logging: loggingConfig,
  support: supportConfig
};

export default config;

/**
 * Re-export all environment variables individually for convenience
 * @deprecated Use the typed config objects above instead
 */
export {
  env
};

/**
 * Backward compatibility exports for legacy usage
 * These will be gradually phased out as code is updated to use the config object
 * @deprecated Use the config object instead
 */
export const TELEGRAM_API_TOKEN = config.telegram.apiToken;
export const MAX_VOICE_MESSAGE_LENGTH_SECONDS = config.telegram.maxVoiceMessageLengthSeconds;
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
export const SUPPORT_CHAT_ID = config.support.supportChatId;
export const ADMIN_IDS = config.support.adminIds;
export const NOTIFICATION_ALERT_THRESHOLD = config.support.notificationAlertThreshold;
export const MAX_NOTIFICATION_RETRIES = config.support.maxNotificationRetries; 