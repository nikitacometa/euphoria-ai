/**
 * Log levels supported by the application
 */
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

/**
 * Names of the log levels
 */
export const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.ERROR]: 'error',
  [LogLevel.WARN]: 'warn',
  [LogLevel.INFO]: 'info',
  [LogLevel.DEBUG]: 'debug',
  [LogLevel.TRACE]: 'trace'
};

/**
 * Mapping from string to LogLevel
 */
export const LOG_LEVEL_MAP: Record<string, LogLevel> = {
  'error': LogLevel.ERROR,
  'warn': LogLevel.WARN,
  'info': LogLevel.INFO,
  'debug': LogLevel.DEBUG,
  'trace': LogLevel.TRACE
};

/**
 * Base log context with fundamental metadata
 */
export interface LogContext {
  [key: string]: any;
}

/**
 * User-related log context
 */
export interface UserLogContext extends LogContext {
  userId: string | number;
  username?: string;
}

/**
 * Request-related log context
 */
export interface RequestLogContext extends LogContext {
  requestId: string;
  path?: string;
  method?: string;
}

/**
 * Error-related log context
 */
export interface ErrorLogContext extends LogContext {
  errorName?: string;
  errorMessage?: string;
  errorStack?: string;
  errorCode?: string | number;
}

/**
 * Logger interface to ensure consistency across implementations
 */
export interface ILogger {
  error(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  debug(message: string, context?: LogContext): void;
  trace(message: string, context?: LogContext): void;
  child(context: LogContext): ILogger;
} 