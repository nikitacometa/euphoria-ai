import { TELEGRAM_API_TOKEN } from './config'
import { connectToDatabase } from './database'
import { logger, createLogger } from './utils/logger'
import { LOG_LEVEL } from './config'
import { journalBot } from './journal-bot-new'

// Create a logger for the main application
const mainLogger = createLogger('Main', LOG_LEVEL);

// Connect to MongoDB
connectToDatabase().catch(error => mainLogger.error('Failed to connect to MongoDB:', error));

// Log bot startup
mainLogger.info('Starting Journal Bot...');

// Start the bot
journalBot.start({
    onStart: () => {
        mainLogger.info('Journal Bot started successfully!');
    }
});

// Handle errors
process.on('uncaughtException', (error) => {
    mainLogger.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    mainLogger.error('Unhandled rejection at:', promise, 'reason:', reason);
});

// Export the bot for testing
export { journalBot };
