import { Bot } from 'grammy';
import { createBot } from './bot';
import { registerFeatures } from './feature-registry';
import { connectToDatabase } from '../database';
import { notificationService } from '../services/notification.service';
import { logger, createLogger } from '../utils/logger';
import { LOG_LEVEL } from '../config';
import { JournalBotContext } from '../types/session';

// Create a logger for the app
const appLogger = createLogger('App', LOG_LEVEL);

// Create the bot instance immediately
export const bot = createBot();

/**
 * Initialize and start the Euphoria bot
 * @returns The configured and started bot instance
 */
export async function startApp(): Promise<Bot<JournalBotContext>> {
    appLogger.info('Starting Euphoria bot application...');
    
    try {
        // Connect to database
        appLogger.info('Connecting to database...');
        await connectToDatabase();
        appLogger.info('Database connection established');
        
        // Register all feature handlers
        registerFeatures(bot);
        
        // Start the bot
        appLogger.info('Starting bot...');
        await bot.start();
        appLogger.info('Bot started successfully');
        
        // Start the notification service
        appLogger.info('Starting notification service...');
        notificationService.start();
        appLogger.info('Notification service started');
        
        // Return the bot instance for testing or external access
        return bot;
    } catch (error) {
        appLogger.error('Failed to start application:', error);
        throw error;
    }
}

// If this file is run directly, start the app
if (require.main === module) {
    startApp().catch(error => {
        console.error('Fatal error starting application:', error);
        process.exit(1);
    });
} 