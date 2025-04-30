import { NextFunction } from 'grammy';
import { JournalBotContext } from '../types/session';
import { createLogger, LogLevel } from './logger';

// Create a dedicated logger for bot messages
const botLogger = createLogger('BotMessages', LogLevel.DEBUG);

/**
 * Middleware to log all incoming bot messages and context objects at debug level
 */
export function botLoggerMiddleware() {
  return async (ctx: JournalBotContext, next: NextFunction) => {
    // Log the update object (contains all data from Telegram)
    botLogger.debug('Received update:', JSON.stringify(ctx.update, null, 2));

    // Log specific message details if present
    if (ctx.message) {
      botLogger.debug('Message content:', {
        messageId: ctx.message.message_id,
        from: ctx.message.from,
        chat: ctx.message.chat,
        text: ctx.message.text,
        hasMedia: !!(ctx.message.photo || ctx.message.video || ctx.message.voice || ctx.message.audio),
        hasDocument: !!ctx.message.document
      });
    }
    
    // Log callback query data if present
    if (ctx.callbackQuery) {
      botLogger.debug('Callback query:', {
        id: ctx.callbackQuery.id,
        from: ctx.callbackQuery.from,
        data: ctx.callbackQuery.data,
        message: ctx.callbackQuery.message ? {
          messageId: ctx.callbackQuery.message.message_id,
          chatId: ctx.callbackQuery.message.chat.id
        } : null
      });
    }

    // Log session state
    botLogger.debug('Session state:', ctx.session);

    // Continue to the next middleware/handler
    await next();
    
    // Optional: log after handling (to see what changed)
    botLogger.debug('Session state after handling:', ctx.session);
  };
} 