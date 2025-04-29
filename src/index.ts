import { startApp } from './app';
import { createLogger, LogLevel } from './utils/logger';

// Create a logger for the main entry point
const mainLogger = createLogger('Main', LogLevel.INFO);

// Start the application
mainLogger.info('Initializing Euphoria bot application...');
startApp()
  .then(() => {
    mainLogger.info('Euphoria bot is running.');
  })
  .catch(error => {
    mainLogger.error('Failed to start Euphoria bot:', error);
    process.exit(1);
  }); 