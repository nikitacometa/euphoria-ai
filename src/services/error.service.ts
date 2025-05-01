import { JournalBotContext } from '../types/session';
import { AppError, ErrorCode, ErrorCodes } from '../types/errors';
import { logger } from '../utils/logger';
import { ADMIN_CHAT_ID } from '../config/index';
import { bot } from '../app';
import { AIError } from '../errors/classes/ai-error';

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
      
      // Send critical errors to admin chat, even if not from handleBotError
      if (ADMIN_CHAT_ID && (error instanceof AIError || (error instanceof AppError && error.code === ErrorCodes.AI_ERROR))) {
        this.sendAdminAlert(error, logContext).catch(alertError => {
          logger.error('Failed to send AIError alert to admin chat', { 
            originalError: error.message,
            alertError
          });
        });
      }
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
    const logContext = {
      telegramUserId: ctx.from?.id,
      chatId: ctx.chat?.id,
      update: JSON.stringify(ctx.update, null, 2),
      ...userContext
    };

    // First, log the error
    this.logError(error, logContext);

    // Send alert to admin chat if configured
    if (ADMIN_CHAT_ID) {
      try {
        await this.sendAdminAlert(error, logContext);
      } catch (adminAlertError) {
        logger.error('Failed to send error alert to admin chat', { 
          adminChatId: ADMIN_CHAT_ID,
          originalError: error.message,
          adminAlertError
        });
      }
    }

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
   * Send an alert to the admin chat about an error
   */
  private async sendAdminAlert(error: Error | AppError, context: Record<string, any>): Promise<void> {
    if (!ADMIN_CHAT_ID) return;
    
    const errorMessage = `🚨 *Critical Bot Error* 🚨\n\n*Error Type:* ${error.name}\n*Message:* ${error.message}\n\n*Stack Trace:*\n\`\`\`\n${error.stack || 'No stack trace available'}\n\`\`\`\n\n*Context:*\n\`\`\`json\n${JSON.stringify(context, null, 2)}\n\`\`\``;
    
    // Escape characters for MarkdownV2
    let escapedMessage = errorMessage.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
    
    // Truncate message if too long for Telegram
    const MAX_TELEGRAM_MESSAGE_LENGTH = 4096;
    const truncatedMessage = escapedMessage.length > MAX_TELEGRAM_MESSAGE_LENGTH 
      ? escapedMessage.substring(0, MAX_TELEGRAM_MESSAGE_LENGTH - 100) + '\n... [TRUNCATED]'
      : escapedMessage;
    
    await bot.api.sendMessage(ADMIN_CHAT_ID, truncatedMessage, { parse_mode: 'MarkdownV2' });
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
