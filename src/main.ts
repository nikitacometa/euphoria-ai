/**
 * @deprecated This file is maintained for backward compatibility only.
 * Please import from src/index.ts instead.
 */

import { startApp, journalBot } from './app';
import { createLogger, LogLevel } from './utils/logger';

// Create a logger
const mainLogger = createLogger('Main', LogLevel.INFO);

// Print warning about deprecated entry point
mainLogger.warn('Using deprecated entry point (main.ts). Please update imports to use src/index.ts instead.');

// Start the application
mainLogger.info('Initializing Euphoria bot application via legacy entry point...');
startApp()
  .then(() => {
    mainLogger.info('Euphoria bot is running.');
  })
  .catch(error => {
    mainLogger.error('Failed to start Euphoria bot:', error);
    process.exit(1);
  });

// Export the bot instance for backward compatibility
export { journalBot };
