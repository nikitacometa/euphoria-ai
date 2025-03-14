import { TELEGRAM_API_TOKEN } from './config'
import { connectToDatabase } from './database'
import { logger, createLogger } from './utils/logger'
import { LOG_LEVEL } from './config'
import bot, { startBot } from './journal-bot-new'
import { startAdminServer } from './admin/text-editor'
import { initializeTexts } from './utils/localization'

// Create a logger for the main application
const mainLogger = createLogger('Main', LOG_LEVEL);

// Main function to start the application
async function startApp() {
    try {
        // Connect to MongoDB
        await connectToDatabase();
        
        // Initialize localization texts from database
        await initializeTexts();
        
        // Log bot startup
        mainLogger.info('Starting Journal Bot...');
        
        // Start the bot
        startBot();
        
        // Start admin server if ENABLE_ADMIN_INTERFACE is set
        if (process.env.ENABLE_ADMIN_INTERFACE === 'true') {
            await startAdminServer();
            mainLogger.info('Admin interface started');
        }
    } catch (error) {
        mainLogger.error('Failed to start application:', error);
        process.exit(1);
    }
}

// Start the application
startApp();

// Handle errors
process.on('uncaughtException', (error) => {
    mainLogger.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    mainLogger.error('Unhandled rejection at:', promise, 'reason:', reason);
});

// Export the bot for testing
export { bot };
