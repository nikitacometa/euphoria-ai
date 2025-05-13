import { Bot } from 'grammy';
import { createBot } from './bot';
import { registerFeatures } from './feature-registry';
import { connectToDatabase } from '../database';
import { notificationService } from '../services/notification.service';
import { logger, createLogger } from '../utils/logger';
import { LOG_LEVEL } from '../config/index';
import { JournalBotContext } from '../types/session';
import { setupLocalization } from '../config/i18n';

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
        appLogger.info('Initializing localization...');
        await setupLocalization();
        appLogger.info('Localization initialized.');

        appLogger.info('Connecting to database...');
        await connectToDatabase();
        appLogger.info('Database connection established');
        
        appLogger.info('Registering bot feature handlers...');
        registerFeatures(bot);
        appLogger.info('All feature handlers registered successfully.');
        
        appLogger.info('Starting notification service core functionality...');
        notificationService.start(); // This logs its own startup internally
        appLogger.info('Notification service core functionality has been initialized.');
        
        appLogger.info('Initiating notification system health check (will run asynchronously)...');
        notificationService.checkHealth()
            .then(isHealthy => {
                if (isHealthy) {
                    appLogger.info('Notification system health check reported: PASSED');
                } else {
                    appLogger.warn('Notification system health check reported: FAILED - check logs for details');
                }
            })
            .catch(error => {
                appLogger.error('Error during initial notification system health check:', error);
            });
        
        appLogger.info('Bot is now starting (e.g., initiating polling or webhook listener)...');
        // The following line is expected to be long-running/blocking if using polling.
        await bot.start(); 
        
        // If bot.start() is blocking, this log and the return statement might not be hit until shutdown.
        appLogger.info('Bot.start() has been invoked. If polling, it is now active.');
        
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