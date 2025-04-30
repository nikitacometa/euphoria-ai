import { Context } from 'grammy';
import { BaseError, ErrorCategory } from '../classes/base-error';
import { getTelegramFriendlyMessage } from '../utils/error-map';
import { ErrorHelper } from '../utils/error-helper';
import { ILogger } from '../../utils/logger/types';

/**
 * Options for handling errors in bot contexts
 */
export interface BotErrorHandlerOptions {
  /**
   * Logger instance to use for error logging
   */
  logger: ILogger;
  
  /**
   * Whether to send error messages to the user
   */
  notifyUser?: boolean;
  
  /**
   * Whether to include message text in error logs
   */
  logMessageText?: boolean;
  
  /**
   * Custom error formatter for user-facing messages
   */
  formatErrorMessage?: (error: unknown) => string;
  
  /**
   * Categories of errors that should be shown to users
   */
  userVisibleCategories?: ErrorCategory[];
}

/**
 * Handler for bot errors
 */
export class BotErrorHandler {
  private readonly logger: ILogger;
  private readonly notifyUser: boolean;
  private readonly logMessageText: boolean;
  private readonly formatErrorMessage: (error: unknown) => string;
  private readonly userVisibleCategories: Set<ErrorCategory>;
  
  /**
   * Create a new bot error handler
   * 
   * @param options Handler options
   */
  constructor(options: BotErrorHandlerOptions) {
    const {
      logger,
      notifyUser = true,
      logMessageText = true,
      formatErrorMessage = getTelegramFriendlyMessage,
      userVisibleCategories = [
        ErrorCategory.VALIDATION,
        ErrorCategory.BUSINESS_LOGIC,
        ErrorCategory.AUTHENTICATION,
        ErrorCategory.AUTHORIZATION
      ]
    } = options;
    
    this.logger = logger;
    this.notifyUser = notifyUser;
    this.logMessageText = logMessageText;
    this.formatErrorMessage = formatErrorMessage;
    this.userVisibleCategories = new Set(userVisibleCategories);
  }
  
  /**
   * Handle an error in a bot context
   * 
   * @param ctx Bot context
   * @param error Error that occurred
   * @param additionalContext Additional context for logging
   */
  public async handleError(
    ctx: Context,
    error: unknown,
    additionalContext?: Record<string, any>
  ): Promise<void> {
    // Create log context from the bot context
    const logContext: Record<string, any> = {
      updateId: ctx.update?.update_id,
      chatId: ctx.chat?.id,
      userId: ctx.from?.id,
      username: ctx.from?.username,
      ...additionalContext
    };
    
    // Include message text in logs if enabled
    if (this.logMessageText && ctx.message?.text) {
      logContext.messageText = ctx.message.text;
    }
    
    // Log the error with full context
    ErrorHelper.logError(this.logger, error, logContext);
    
    // Normalize the error for processing
    const normalizedError = ErrorHelper.normalizeError(error);
    
    // Determine if we should show the error to the user
    const shouldShowToUser = this.notifyUser && this.shouldShowErrorToUser(normalizedError);
    
    // Send error message to user if appropriate
    if (shouldShowToUser) {
      try {
        const userMessage = this.formatErrorMessage(normalizedError);
        await ctx.reply(userMessage, { parse_mode: 'HTML' });
      } catch (replyError) {
        // Log if we fail to send the error message
        this.logger.warn('Failed to send error message to user', {
          originalError: normalizedError.message,
          replyError: replyError instanceof Error ? replyError.message : String(replyError)
        });
      }
    }
  }
  
  /**
   * Determine if an error should be shown to the user
   * 
   * @param error Error to check
   * @returns Whether the error should be shown to users
   */
  private shouldShowErrorToUser(error: BaseError): boolean {
    // Don't show unexpected errors to users
    if (error.category === ErrorCategory.UNEXPECTED) {
      return false;
    }
    
    // Only show certain categories of errors to users
    return this.userVisibleCategories.has(error.category);
  }
} 