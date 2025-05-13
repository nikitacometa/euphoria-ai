import { ILogger, LogContext } from './types';

/**
 * A null logger that doesn't output anything
 * Useful for testing or when you want to disable logging
 */
export class NullLogger implements ILogger {
  /**
   * No-op error logger
   */
  error(_message: string, _context?: LogContext): void {
    // Do nothing
  }
  
  /**
   * No-op warn logger
   */
  warn(_message: string, _context?: LogContext): void {
    // Do nothing
  }
  
  /**
   * No-op info logger
   */
  info(_message: string, _context?: LogContext): void {
    // Do nothing
  }
  
  /**
   * No-op debug logger
   */
  debug(_message: string, _context?: LogContext): void {
    // Do nothing
  }
  
  /**
   * No-op trace logger
   */
  trace(_message: string, _context?: LogContext): void {
    // Do nothing
  }
  
  /**
   * Return self as child logger
   */
  child(_context: LogContext): ILogger {
    return this;
  }
} 