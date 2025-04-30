import { LOG_LEVEL } from '../../config';
import { ConsoleLogger } from './console-logger';
import { NullLogger } from './null-logger';
import { PinoLogger } from './pino-logger';
import { ILogger, LogContext, LogLevel } from './types';
import { createErrorContext, createRequestContext, parseLogLevel } from './utils';

// Re-export everything for convenience
export * from './types';
export * from './utils';
export * from './console-logger';
export * from './pino-logger';
export * from './null-logger';

// The default logger instance for the application
let rootLogger: ILogger;

/**
 * Initialize the logger based on configuration
 */
function initializeLogger(): ILogger {
  const logLevel = parseLogLevel(LOG_LEVEL);
  const isProduction = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';
  
  // In test mode, use a null logger by default unless DEBUG is enabled
  if (isTest && !process.env.DEBUG) {
    return new NullLogger();
  }
  
  // In production, use Pino for better performance and structured logs
  if (isProduction) {
    return new PinoLogger({
      name: 'app',
      level: LogLevel[logLevel].toLowerCase(), 
      prettyPrint: false,
      baseContext: { app: 'euphoria', env: process.env.NODE_ENV }
    });
  }
  
  // In development, use Pino with pretty printing
  return new PinoLogger({
    name: 'app',
    level: LogLevel[logLevel].toLowerCase(),
    prettyPrint: true,
    baseContext: { app: 'euphoria', env: process.env.NODE_ENV }
  });
}

// Initialize the root logger
rootLogger = initializeLogger();

/**
 * Get the application logger
 * @returns The root logger instance
 */
export function getLogger(): ILogger {
  return rootLogger;
}

/**
 * Create a child logger with the given context
 * @param context Additional context for the logger
 * @returns A new logger with the combined context
 */
export function createLogger(context: LogContext): ILogger {
  return rootLogger.child(context);
}

/**
 * Create a component-specific logger
 * @param componentName Name of the component
 * @returns A logger for the component
 */
export function createComponentLogger(componentName: string): ILogger {
  return rootLogger.child({ component: componentName });
}

/**
 * Create a logger specifically for a user
 * @param userId User identifier
 * @param username Optional username
 * @returns A logger with user context
 */
export function createUserLogger(userId: string | number, username?: string): ILogger {
  return rootLogger.child({ userId, ...(username && { username }) });
}

/**
 * Create a logger specifically for a request
 * @param req Request object or identifier
 * @returns A logger with request context
 */
export function createRequestLogger(req: any): ILogger {
  const context = typeof req === 'string' 
    ? { requestId: req }
    : createRequestContext(req);
  
  return rootLogger.child(context);
}

/**
 * Change the log level at runtime
 * @param level New log level to set
 */
export function setLogLevel(level: LogLevel | string): void {
  const parsedLevel = typeof level === 'string' 
    ? parseLogLevel(level) 
    : level;
  
  if ('setLevel' in rootLogger && typeof (rootLogger as any).setLevel === 'function') {
    (rootLogger as any).setLevel(parsedLevel);
  }
}

// Default export is the root logger for convenience
export default rootLogger; 