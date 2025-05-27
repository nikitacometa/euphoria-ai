/**
 * @deprecated This file is maintained for backward compatibility only.
 * Please import from src/index.ts instead.
 */

import { startApp, bot } from './app';
import { createLogger, LogLevel } from './utils/logger';

// Create a logger
const mainLogger = createLogger('Main', LogLevel.INFO);

// Print warning about deprecated entry point
mainLogger.warn('Using deprecated entry point (main.ts). Please update imports to use src/index.ts instead.');

// Start the application
mainLogger.info('Initializing Infinity bot application via legacy entry point...');
startApp()
  .then(() => {
    mainLogger.info('Infinity bot is running.');
  })
  .catch(error => {
    mainLogger.error('Failed to start Infinity bot:', error);
    process.exit(1);
  });

// Export the bot instance for backward compatibility
export { bot as journalBot };
