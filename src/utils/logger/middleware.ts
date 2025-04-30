import { Context, Middleware } from 'grammy';
import { createRequestContext } from './utils';
import { ILogger } from './types';
import { performance } from 'perf_hooks';

/**
 * Options for logger middleware
 */
export interface LoggerMiddlewareOptions {
  logger: ILogger;
  level?: 'debug' | 'info';
  logStart?: boolean;
  shouldLogError?: (error: Error) => boolean;
}

/**
 * Create middleware for logging request handling
 * 
 * @param options Middleware options
 * @returns Grammy middleware
 */
export function createLoggerMiddleware(options: LoggerMiddlewareOptions): Middleware<Context> {
  const { 
    logger,
    level = 'info', 
    logStart = true,
    shouldLogError = () => true
  } = options;
  
  return async (ctx, next) => {
    // Generate or get request ID
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    // Create request context
    const logContext = {
      requestId,
      updateId: ctx.update?.update_id,
      chatId: ctx.chat?.id,
      userId: ctx.from?.id,
      username: ctx.from?.username
    };
    
    // Create request logger with context
    const requestLogger = logger.child(logContext);
    
    // Attach logger to context for handlers to use
    (ctx as any).logger = requestLogger;
    
    // Track start time for performance logging
    const startTime = performance.now();
    
    if (logStart) {
      // Log request start
      const method = getUpdateType(ctx);
      const message = `Handling ${method}`;
      
      if (level === 'debug') {
        requestLogger.debug(message, { 
          update: JSON.stringify(ctx.update).slice(0, 1000) // Prevent huge logs
        });
      } else {
        requestLogger.info(message);
      }
    }
    
    try {
      // Process request
      await next();
      
      // Log request completion
      const duration = Math.round(performance.now() - startTime);
      
      if (level === 'debug') {
        requestLogger.debug(`Completed in ${duration}ms`);
      } else {
        requestLogger.info(`Completed in ${duration}ms`);
      }
    } catch (error) {
      // Only log if the filter passes
      if (shouldLogError(error as Error)) {
        const duration = Math.round(performance.now() - startTime);
        requestLogger.error(`Error processing request (${duration}ms)`, {
          errorName: (error as Error).name,
          errorMessage: (error as Error).message,
          errorStack: (error as Error).stack,
        });
      }
      
      // Re-throw to allow error handling middleware to process
      throw error;
    }
  };
}

/**
 * Get the type of update being processed
 */
function getUpdateType(ctx: Context): string {
  const update = ctx.update;
  if (!update) return 'unknown';
  
  if (update.message) return 'message';
  if (update.edited_message) return 'edited_message';
  if (update.channel_post) return 'channel_post';
  if (update.edited_channel_post) return 'edited_channel_post';
  if (update.inline_query) return 'inline_query';
  if (update.chosen_inline_result) return 'chosen_inline_result';
  if (update.callback_query) return 'callback_query';
  if (update.shipping_query) return 'shipping_query';
  if (update.pre_checkout_query) return 'pre_checkout_query';
  if (update.poll) return 'poll';
  if (update.poll_answer) return 'poll_answer';
  if (update.my_chat_member) return 'my_chat_member';
  if (update.chat_member) return 'chat_member';
  
  return 'unknown';
} 