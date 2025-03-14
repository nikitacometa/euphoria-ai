import { TELEGRAM_API_TOKEN } from './config'
import { connectToDatabase } from './database'
import { logger, createLogger } from './utils/logger'
import { LOG_LEVEL } from './config'
import { journalBot } from './journal-bot-new'
import { startAdminServer } from './admin/text-editor'

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

// Start admin server if ENABLE_ADMIN_INTERFACE is set
if (process.env.ENABLE_ADMIN_INTERFACE === 'true') {
    startAdminServer();
    mainLogger.info('Admin interface started');
}

// Handle errors
process.on('uncaughtException', (error) => {
    mainLogger.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    mainLogger.error('Unhandled rejection at:', promise, 'reason:', reason);
});

// Export the bot for testing
export { journalBot };
