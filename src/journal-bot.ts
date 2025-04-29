import { LOG_LEVEL } from './config';
import { createLogger } from './utils/logger';
import { journalBot as bot } from './app';

// Export the bot from app to avoid duplicate instances
export { bot };
export { bot as journalBot }; 