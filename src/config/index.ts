/**
 * Configuration system for the application
 *
 * This file exports the configuration for the application.
 * It uses a centralized, type-safe configuration system.
 *
 * @module config
 */

import { config, env } from './config';
import {
  Environment,
  TelegramConfig,
  OpenAIConfig,
  DatabaseConfig,
  LoggingConfig,
  SupportConfig,
  AppConfig,
  ReanalysisConfig
} from './types';

// Export the config object as the default export
export default config;

// Export the environment variables
export { env };

// Export the config object and its components
export const {
  telegram: telegramConfig,
  openai: openAIConfig,
  database: databaseConfig,
  logging: loggingConfig,
  support: supportConfig,
  reanalysis: reanalysisConfig
} = config;

// Export the environment
export const NODE_ENV: Environment = config.env;

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
export const ADMIN_CHAT_ID = config.support.adminChatId;

// Added for re-analysis commands
export const REANALYSIS_BATCH_SIZE = config.reanalysis.batchSize;
export const REANALYSIS_PROGRESS_INTERVAL = config.reanalysis.progressInterval;