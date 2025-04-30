import { LogLevel } from '../utils/logger';

/**
 * Environment types for type safety
 */
export type Environment = 'development' | 'test' | 'production';

/**
 * Telegram configuration
 */
export interface TelegramConfig {
  /**
   * Telegram Bot API token
   */
  apiToken: string;
  
  /**
   * Maximum voice message length in seconds
   */
  maxVoiceMessageLengthSeconds: number;
}

/**
 * OpenAI configuration
 */
export interface OpenAIConfig {
  /**
   * OpenAI API key
   */
  apiKey: string;
  
  /**
   * GPT model version to use
   */
  gptVersion: string;
}

/**
 * Database configuration
 */
export interface DatabaseConfig {
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
   * MongoDB connection URI
   */
  uri: string;
  
  /**
   * Mongo Express port (for development)
   */
  expressPort: string;
}

/**
 * Logging configuration
 */
export interface LoggingConfig {
  /**
   * Log level
   */
  level: LogLevel;
}

/**
 * Support and monitoring configuration
 */
export interface SupportConfig {
  /**
   * Telegram chat ID for admin notifications
   */
  supportChatId: string;
  
  /**
   * List of admin user IDs
   */
  adminIds: number[];
  
  /**
   * Number of failures before alerting
   */
  notificationAlertThreshold: number;
  
  /**
   * Max retries for failed notifications
   */
  maxNotificationRetries: number;
}

/**
 * Application configuration
 */
export interface AppConfig {
  /**
   * Application environment 
   */
  env: Environment;
  
  /**
   * Telegram configuration
   */
  telegram: TelegramConfig;
  
  /**
   * OpenAI configuration
   */
  openai: OpenAIConfig;
  
  /**
   * Database configuration
   */
  database: DatabaseConfig;
  
  /**
   * Logging configuration
   */
  logging: LoggingConfig;
  
  /**
   * Support and monitoring configuration
   */
  support: SupportConfig;
} 