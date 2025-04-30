import { Context, Middleware } from 'grammy';
import { BaseError } from '../classes/base-error';
import { getTelegramFriendlyMessage } from '../utils/error-map';
import { ErrorHelper } from '../utils/error-helper';
import { ILogger } from '../../utils/logger/types';

/**
 * Options for the error handler middleware
 */
export interface ErrorMiddlewareOptions {
  /**
   * Logger instance to use for error logging
   */
  logger: ILogger;
  
  /**
   * Whether to include message text in error logs
   */
  logMessageText?: boolean;
  
  /**
   * Whether to notify the user when an error occurs
   */
  notifyUser?: boolean;
  
  /**
   * Custom error formatter for user-facing messages
   */
  formatErrorForUser?: (error: unknown) => string;
  
  /**
   * Custom filter to determine whether to respond to the user
   */
  shouldRespondToUser?: (error: unknown) => boolean;
}

/**
 * Create an error handling middleware for Grammy
 * 
 * @param options Middleware options
 * @returns Grammy middleware for handling errors
 */
export function createErrorMiddleware(options: ErrorMiddlewareOptions): Middleware<Context> {
  const {
    logger,
    logMessageText = true,
    notifyUser = true,
    formatErrorForUser = getTelegramFriendlyMessage,
    shouldRespondToUser = () => true
  } = options;

  return async (ctx, next) => {
    try {
      // Proceed with request handling
      await next();
    } catch (error) {
      // Prepare context for error logging
      const logContext: Record<string, any> = {
        updateId: ctx.update?.update_id,
        chatId: ctx.chat?.id,
        userId: ctx.from?.id,
        username: ctx.from?.username
      };
      
      // Optionally include message text
      if (logMessageText && ctx.message?.text) {
        logContext.messageText = ctx.message.text;
      }
      
      // Log the error with context
      ErrorHelper.logError(logger, error, logContext);
      
      // Respond to the user if enabled and the filter passes
      if (notifyUser && shouldRespondToUser(error)) {
        try {
          const userMessage = formatErrorForUser(error);
          await ctx.reply(userMessage, { parse_mode: 'HTML' });
        } catch (replyError) {
          // Log if we couldn't send error message
          logger.error('Failed to send error message to user', {
            originalError: error instanceof Error ? error.message : String(error),
            replyError: replyError instanceof Error ? replyError.message : String(replyError)
          });
        }
      }
    }
  };
}

/**
 * Options for the API error handler
 */
export interface ApiErrorHandlerOptions {
  /**
   * Logger instance to use for error logging
   */
  logger: ILogger;
  
  /**
   * Whether to include stack traces in error responses (not recommended for production)
   */
  includeStack?: boolean;
  
  /**
   * Whether to include the original error message (not recommended for production)
   */
  includeErrorMessage?: boolean;
  
  /**
   * Custom error mapper function for API responses
   */
  mapErrorToResponse?: (error: unknown) => Record<string, any>;
}

/**
 * Create an error response for API endpoints
 * 
 * @param error The error that occurred
 * @param options Handler options
 * @returns Formatted error response
 */
export function createApiErrorResponse(
  error: unknown,
  options: ApiErrorHandlerOptions
): Record<string, any> {
  const {
    logger,
    includeStack = false,
    includeErrorMessage = false,
    mapErrorToResponse
  } = options;
  
  // Log the error
  ErrorHelper.logError(logger, error);
  
  // Use custom mapper if provided
  if (mapErrorToResponse) {
    return mapErrorToResponse(error);
  }
  
  // Default error response
  const normalizedError = ErrorHelper.normalizeError(error);
  
  const response: Record<string, any> = {
    success: false,
    error: {
      code: normalizedError.code,
      message: includeErrorMessage ? normalizedError.message : 'An error occurred'
    }
  };
  
  // Include status code if available
  if (normalizedError.statusCode) {
    response.statusCode = normalizedError.statusCode;
  }
  
  // Include stack trace if enabled (for development only)
  if (includeStack && normalizedError.stack) {
    response.error.stack = normalizedError.stack;
  }
  
  return response;
} 