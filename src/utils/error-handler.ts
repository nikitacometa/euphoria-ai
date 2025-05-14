import { JournalBotContext } from '../types/session';
import { IUser } from '../types/models';
import { errorService } from '../services/error.service';
import { logger } from './logger';
import { AIError } from '../errors/classes/ai-error';
import { DatabaseError } from '../errors/classes/database-error';
import { BusinessError } from '../errors/classes/business-error';
import { ValidationError } from '../errors/classes/validation-error';
import { t } from './localization';

/**
 * Options for the try-catch wrapper
 */
export interface TryCatchOptions {
  /**
   * Context for error logging
   */
  context?: Record<string, any>;

  /**
   * Error handler function
   */
  onError?: (error: Error) => Promise<void>;

  /**
   * Whether to rethrow the error after handling
   */
  rethrow?: boolean;
}

/**
 * Wraps a function with try-catch and standardized error handling
 *
 * @param fn The function to wrap
 * @param options Options for error handling
 * @returns The wrapped function
 */
export function withErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  options: TryCatchOptions = {}
): (...args: T) => Promise<R | undefined> {
  const { context = {}, onError, rethrow = false } = options;

  return async (...args: T): Promise<R | undefined> => {
    try {
      return await fn(...args);
    } catch (error) {
      // Log the error
      logger.error('Error in wrapped function:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        ...context
      });

      // Call the error handler if provided
      if (onError && error instanceof Error) {
        await onError(error);
      }

      // Rethrow if requested
      if (rethrow) {
        throw error;
      }

      // Return undefined if not rethrowing
      return undefined;
    }
  };
}

/**
 * Wraps a bot handler function with try-catch and standardized error handling
 *
 * @param fn The handler function to wrap
 * @param errorMessageKey The translation key for the error message
 * @returns The wrapped handler function
 */
export function withBotErrorHandling(
  fn: (ctx: JournalBotContext, user: IUser, ...args: any[]) => Promise<void>,
  errorMessageKey: string = 'errors:genericError'
): (ctx: JournalBotContext, user: IUser, ...args: any[]) => Promise<void> {
  return async (ctx: JournalBotContext, user: IUser, ...rest: any[]): Promise<void> => {
    try {
      await fn(ctx, user, ...rest);
    } catch (error) {
      // Determine the appropriate error type
      let typedError: Error;

      if (error instanceof Error) {
        if (error instanceof AIError ||
            error instanceof DatabaseError ||
            error instanceof BusinessError ||
            error instanceof ValidationError) {
          typedError = error;
        } else {
          // Generic error wrapper
          typedError = new BusinessError({
            message: error.message,
            cause: error
          });
        }
      } else {
        // Non-Error object
        typedError = new BusinessError({
          message: String(error)
        });
      }

      // Log the error using the error service
      errorService.logError(typedError, {
        telegramUserId: ctx.from?.id,
        chatId: ctx.chat?.id,
        handlerName: fn.name || 'unnamed_handler'
      });

      // Send a user-friendly error message
      try {
        await ctx.reply(t(errorMessageKey, { user }), { parse_mode: 'HTML' });
      } catch (replyError) {
        logger.error('Failed to send error message to user', {
          originalError: typedError.message,
          replyError: replyError instanceof Error ? replyError.message : String(replyError)
        });
      }
    }
  };
}

/**
 * Wraps a service function with try-catch and standardized error handling
 *
 * @param operationName Descriptive name of the operation
 * @param context Context for error logging
 * @param fn The function to execute
 * @returns The result of the function
 * @throws DatabaseError if an error occurs
 */
export async function withServiceErrorHandling<T>(
  operationName: string,
  context: Record<string, any>,
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    // Create a typed error with context
    const typedError = new DatabaseError({
      message: `Failed to ${operationName}`,
      context,
      cause: error instanceof Error ? error : undefined
    });

    // Log the error
    errorService.logError(typedError, {}, 'error');

    // Rethrow the typed error
    throw typedError;
  }
}
