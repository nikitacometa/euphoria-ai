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

/**
 * Load environment variables from .env file
 * Determine the environment and load the appropriate .env file
 */
function loadEnvironmentVariables(): void {
  const envPath = process.env.NODE_ENV === 'production' ? '.env.prod' : '.env';
  dotenv.config({ path: path.resolve(process.cwd(), envPath) });
}

/**
 * Check required environment variables
 */
function checkRequiredEnvVars(): void {
  const requiredEnvVars = [
    'TELEGRAM_API_TOKEN',
    'OPENAI_API_KEY'
  ];

  requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
      throw new Error(`Missing required environment variable: ${varName}`);
    }
  });
}

/**
 * Create the application configuration
 */
function createConfig(): AppConfig {
  // Load environment variables
  loadEnvironmentVariables();
  
  // Check required environment variables
  checkRequiredEnvVars();
  
  // Get environment
  const NODE_ENV: Environment = (process.env.NODE_ENV as Environment) || 'development';
  
  // Validate environment variables
  const env = validateEnv();
  
  /**
   * Telegram Bot configuration
   */
  const telegram: TelegramConfig = {
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
  const openai: OpenAIConfig = {
    /**
     * OpenAI API key
     */
    apiKey: env.OPENAI_API_KEY,
    
    /**
     * GPT model version to use
     */
    gptVersion: env.GPT_VERSION
  };
  
  /**
   * MongoDB configuration
   */
  const database: DatabaseConfig = {
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
  const logging: LoggingConfig = {
    /**
     * Application log level
     */
    level: env.LOG_LEVEL,
  };
  
  /**
   * Support and monitoring configuration
   */
  const support: SupportConfig = {
    /**
     * Telegram chat ID for admin notifications
     */
    supportChatId: env.SUPPORT_CHAT_ID,
    
    /**
     * Admin chat ID for critical error alerts
     */
    adminChatId: env.ADMIN_CHAT_ID,
    
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
   * Reanalysis configuration
   */
  const reanalysis = {
    /**
     * Batch size for reanalysis
     */
    batchSize: parseInt(process.env.REANALYSIS_BATCH_SIZE || '5'),
    
    /**
     * Progress interval for reanalysis
     */
    progressInterval: parseInt(process.env.REANALYSIS_PROGRESS_INTERVAL || '10'),
  };
  
  /**
   * Consolidated application configuration
   */
  return {
    env: NODE_ENV,
    telegram,
    openai,
    database,
    logging,
    support,
    reanalysis
  };
}

/**
 * The application configuration
 */
export const config = createConfig();

/**
 * Export the validated environment variables
 */
export const env = validateEnv();
