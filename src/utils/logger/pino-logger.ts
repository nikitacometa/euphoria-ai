import pino from 'pino';
import { ILogger, LogContext, LogLevel, LOG_LEVEL_NAMES } from './types';

/**
 * Maps our application log levels to Pino log levels
 */
function mapLogLevel(level: LogLevel): string {
  return LOG_LEVEL_NAMES[level];
}

/**
 * Configuration for Pino logger
 */
export interface PinoLoggerOptions {
  name?: string;
  level?: string;
  prettyPrint?: boolean;
  baseContext?: LogContext;
}

/**
 * Implementation of the Logger interface using Pino
 */
export class PinoLogger implements ILogger {
  private logger: pino.Logger;
  
  /**
   * Creates a new Pino logger instance
   */
  constructor(options: PinoLoggerOptions = {}) {
    const {
      name = 'app',
      level = 'info',
      prettyPrint = process.env.NODE_ENV !== 'production',
      baseContext = {}
    } = options;
    
    this.logger = pino({
      name,
      level,
      transport: prettyPrint ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname'
        }
      } : undefined,
      base: baseContext
    });
  }
  
  /**
   * Log an error message
   */
  error(message: string, context: LogContext = {}): void {
    this.logger.error(context, message);
  }
  
  /**
   * Log a warning message
   */
  warn(message: string, context: LogContext = {}): void {
    this.logger.warn(context, message);
  }
  
  /**
   * Log an info message
   */
  info(message: string, context: LogContext = {}): void {
    this.logger.info(context, message);
  }
  
  /**
   * Log a debug message
   */
  debug(message: string, context: LogContext = {}): void {
    this.logger.debug(context, message);
  }
  
  /**
   * Log a trace message (most verbose level)
   */
  trace(message: string, context: LogContext = {}): void {
    this.logger.trace(context, message);
  }
  
  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): ILogger {
    const childLogger = this.logger.child(context);
    
    // We need to create a new PinoLogger that wraps the child logger
    const wrapper = Object.create(PinoLogger.prototype) as PinoLogger;
    wrapper.logger = childLogger;
    
    return wrapper;
  }
  
  /**
   * Change the log level dynamically
   */
  setLevel(level: LogLevel): void {
    this.logger.level = mapLogLevel(level);
  }
} 