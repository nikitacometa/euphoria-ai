import { LogContext, LogLevel, LOG_LEVEL_MAP } from './types';

/**
 * Converts a string log level to the corresponding enum value
 * @param levelStr String log level from config or environment
 * @param defaultLevel Default log level to use if parsing fails
 * @returns LogLevel enum value
 */
export function parseLogLevel(levelStr: string | number | undefined, defaultLevel: LogLevel = LogLevel.INFO): LogLevel {
  // Handle numeric values
  if (typeof levelStr === 'number') {
    if (levelStr >= 0 && levelStr <= LogLevel.DEBUG) {
      return levelStr as LogLevel;
    }
    return defaultLevel;
  }
  
  // Handle string values
  if (typeof levelStr === 'string') {
    // Try to parse as integer first
    const parsedLevel = parseInt(levelStr, 10);
    if (!isNaN(parsedLevel) && parsedLevel >= 0 && parsedLevel <= LogLevel.DEBUG) {
      return parsedLevel as LogLevel;
    }
    
    // Try to parse as string name
    const normalizedLevel = levelStr.toLowerCase();
    if (normalizedLevel in LOG_LEVEL_MAP) {
      return LOG_LEVEL_MAP[normalizedLevel];
    }
  }
  
  // Return default if nothing worked
  return defaultLevel;
}

/**
 * Creates an error context object for logging errors
 * @param error Error to extract context from
 * @returns ErrorLogContext with error details
 */
export function createErrorContext(error: Error): LogContext {
  return {
    errorName: error.name,
    errorMessage: error.message,
    errorStack: error.stack,
    ...(error as any).context // Add any additional context the error might have
  };
}

/**
 * Creates a request context for logging request-related information
 * @param req Request object (can be any object with relevant properties)
 * @returns RequestLogContext with request details
 */
export function createRequestContext(req: any): LogContext {
  // Extract common properties from different request objects
  const requestId = req.id || req.requestId || generateRequestId();
  const method = req.method || 'UNKNOWN';
  const path = req.path || req.url || 'UNKNOWN';
  const ip = req.ip || (req.connection && req.connection.remoteAddress) || 'UNKNOWN';
  
  return {
    requestId,
    method,
    path,
    ip
  };
}

/**
 * Generates a simple request ID
 * @returns Random request ID string
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
} 