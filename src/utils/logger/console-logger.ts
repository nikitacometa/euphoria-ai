import { ILogger, LogContext, LogLevel } from './types';

/**
 * Configuration for Console logger
 */
export interface ConsoleLoggerOptions {
  name?: string;
  level?: LogLevel;
  includeTimestamps?: boolean;
  baseContext?: LogContext;
}

/**
 * Basic console logger implementation
 * Useful for testing and development
 */
export class ConsoleLogger implements ILogger {
  private readonly name: string;
  private level: LogLevel;
  private readonly includeTimestamps: boolean;
  private readonly baseContext: LogContext;
  
  constructor(options: ConsoleLoggerOptions = {}) {
    const {
      name = 'app',
      level = LogLevel.INFO,
      includeTimestamps = true,
      baseContext = {}
    } = options;
    
    this.name = name;
    this.level = level;
    this.includeTimestamps = includeTimestamps;
    this.baseContext = { ...baseContext };
  }
  
  /**
   * Format a log message with optional timestamp and context
   */
  private formatMessage(level: string, message: string, context: LogContext = {}): string {
    const timestamp = this.includeTimestamps ? `[${new Date().toISOString()}]` : '';
    const contextStr = Object.keys(context).length > 0 
      ? ` ${JSON.stringify({ ...this.baseContext, ...context })}`
      : Object.keys(this.baseContext).length > 0 
        ? ` ${JSON.stringify(this.baseContext)}`
        : '';
    
    return `${timestamp}[${level}][${this.name}] ${message}${contextStr}`;
  }
  
  /**
   * Log an error message
   */
  error(message: string, context: LogContext = {}): void {
    if (this.level >= LogLevel.ERROR) {
      console.error(this.formatMessage('ERROR', message, context));
    }
  }
  
  /**
   * Log a warning message
   */
  warn(message: string, context: LogContext = {}): void {
    if (this.level >= LogLevel.WARN) {
      console.warn(this.formatMessage('WARN', message, context));
    }
  }
  
  /**
   * Log an info message
   */
  info(message: string, context: LogContext = {}): void {
    if (this.level >= LogLevel.INFO) {
      console.info(this.formatMessage('INFO', message, context));
    }
  }
  
  /**
   * Log a debug message
   */
  debug(message: string, context: LogContext = {}): void {
    if (this.level >= LogLevel.DEBUG) {
      console.debug(this.formatMessage('DEBUG', message, context));
    }
  }
  
  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): ILogger {
    return new ConsoleLogger({
      name: this.name,
      level: this.level,
      includeTimestamps: this.includeTimestamps,
      baseContext: { ...this.baseContext, ...context }
    });
  }
  
  /**
   * Change the log level dynamically
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }
} 