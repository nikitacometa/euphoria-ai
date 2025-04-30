import { Bot, session } from 'grammy';
import { TELEGRAM_API_TOKEN } from '../config';
import { JournalBotContext, JournalBotSession } from '../types/session';
import { errorService } from '../services/error.service';
import { AppError } from '../types/errors';
import { botLoggerMiddleware } from '../utils/bot-logger-middleware';

// Create and configure the bot
export function createBot(): Bot<JournalBotContext> {
    // Create bot instance
    const bot = new Bot<JournalBotContext>(TELEGRAM_API_TOKEN);

    // Set up session middleware
    bot.use(session({
        initial: (): JournalBotSession => ({
            journalChatMode: false,
            waitingForJournalQuestion: false
        })
    }));

    // Add debug logging middleware
    bot.use(botLoggerMiddleware());

    // Handle error cases with Infinity's personality
    bot.catch((err) => {
        // Use the error service instead of direct logging
        if (err.error instanceof AppError) {
            errorService.handleBotError(err.ctx, err.error);
        } else {
            // For non-AppErrors, provide context that this is unhandled
            errorService.handleBotError(err.ctx, err.error as Error, { 
                source: 'global_error_handler',
                unhandled: true 
            });
        }
    });

    return bot;
} 