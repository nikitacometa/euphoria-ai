import { Bot, session } from 'grammy';
import { TELEGRAM_API_TOKEN, LOG_LEVEL } from './config';
import { 
    connectToDatabase
} from './database';
import { logger, createLogger } from './utils/logger';
import { notificationService } from './services/notification.service';
import { errorService } from './services/error.service';
import { AppError } from './types/errors';

// Import shared types
import { JournalBotContext, JournalBotSession } from './types/session';
import { registerOnboardingHandlers } from './features/onboarding';
import { registerJournalEntryHandlers } from './features/journal-entry';
import { registerCoreHandlers } from './features/core';
import { registerJournalHistoryHandlers } from './features/journal-history';
import { registerJournalChatHandlers } from './features/journal-chat';
import { registerSettingsHandlers } from './features/settings';

// Create a logger for the journal bot
const journalBotLogger = createLogger('JournalBot', LOG_LEVEL);

// Create bot instance
const bot = new Bot<JournalBotContext>(TELEGRAM_API_TOKEN);

// Set up session middleware
bot.use(session({
    initial: (): JournalBotSession => ({
        journalChatMode: false,
        waitingForJournalQuestion: false
    })
}));

// Connect to MongoDB
connectToDatabase().catch(error => journalBotLogger.error('Failed to connect to MongoDB:', error));

// === FEATURE REGISTRATION ===
registerCoreHandlers(bot);
registerOnboardingHandlers(bot);
registerJournalEntryHandlers(bot);
registerJournalHistoryHandlers(bot);
registerJournalChatHandlers(bot);
registerSettingsHandlers(bot);
// ============================

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

// Start the bot
bot.start();

// Start the notification service
notificationService.start();

// Export the bot
export { bot as journalBot }; 