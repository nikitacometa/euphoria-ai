import { JournalBotContext } from '../types/session';
import { AppError, ErrorCode, ErrorCodes } from '../types/errors';
import { logger } from '../utils/logger';

/**
 * Centralized error handling service for consistent error management
 * throughout the application.
 */
export class ErrorService {
  /**
   * Log an error with appropriate severity and context
   */
  public logError(
    error: Error | AppError, 
    context?: Record<string, any>,
    level: 'error' | 'warn' | 'debug' = 'error'
  ): void {
    let logMessage = `${error.name}: ${error.message}`;
    let logContext: Record<string, any> = { 
      ...context,
      stack: error.stack 
    };

    // Add additional context if it's our AppError
    if (error instanceof AppError) {
      logContext = {
        ...logContext,
        errorCode: error.code,
        errorContext: error.context,
      };

      // If we have an original error, include its details
      if (error.originalError) {
        logContext.originalError = {
          name: error.originalError.name,
          message: error.originalError.message,
          stack: error.originalError.stack
        };
      }
    }

    // Log with the appropriate level
    if (level === 'error') {
      logger.error(logMessage, logContext);
    } else if (level === 'warn') {
      logger.warn(logMessage, logContext);
    } else {
      logger.debug(logMessage, logContext);
    }
  }

  /**
   * Handle an error in the Telegram bot context
   * by sending an appropriate user-friendly message
   */
  public async handleBotError(
    ctx: JournalBotContext, 
    error: Error | AppError,
    userContext?: Record<string, any>
  ): Promise<void> {
    // First, log the error
    this.logError(error, {
      telegramUserId: ctx.from?.id,
      chatId: ctx.chat?.id,
      ...userContext
    });

    // Get user-friendly message based on error type
    const userMessage = this.getUserFriendlyMessage(error);

    // Send response to user
    try {
      await ctx.reply(userMessage, { parse_mode: 'HTML' });
    } catch (replyError) {
      // If we can't reply, just log this additional error
      logger.error('Failed to send error message to user', { 
        originalError: error.message,
        replyError 
      });
    }
  }

  /**
   * Get user-friendly error message based on error type
   */
  private getUserFriendlyMessage(error: Error | AppError): string {
    // Default message
    let message = '<b>✨ Oops!</b> Something unexpected happened. Please try again later.';
    
    if (error instanceof AppError) {
      switch (error.code) {
        case ErrorCodes.NOT_FOUND:
          message = '<b>✨ Hmm...</b> I couldn\'t find what you\'re looking for.';
          break;
        case ErrorCodes.AUTH_ERROR:
          message = '<b>✨ Hold on!</b> Seems like we need to get reacquainted. Please start again with /start.';
          break;
        case ErrorCodes.VALIDATION_ERROR:
          message = `<b>✨ Actually...</b> ${error.message || 'That doesn\'t seem right. Please try again.'}`;
          break;
        case ErrorCodes.AI_ERROR:
          message = '<b>✨ Oh dear!</b> My crystal ball is cloudy right now. Let\'s try again in a moment.';
          break;
        case ErrorCodes.DATABASE_ERROR:
          message = '<b>✨ Hmm...</b> I\'m having trouble with my memory. Let\'s try again soon.';
          break;
        case ErrorCodes.EXTERNAL_API_ERROR:
          message = '<b>✨ Well that\'s odd!</b> I\'m having trouble connecting with the universe right now.';
          break;
        // Add more cases as needed
      }
    }

    return message;
  }
}

// Create and export a singleton instance
export const errorService = new ErrorService(); 