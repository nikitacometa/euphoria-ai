import { Bot } from 'grammy';
import { JournalBotContext } from '../types/session';
import { registerCoreHandlers } from '../features/core';
import { registerJournalEntryHandlers } from '../features/journal-entry';
import { registerJournalHistoryHandlers } from '../features/journal-history';
import { registerJournalChatHandlers } from '../features/journal-chat';
import { registerSettingsHandlers } from '../features/settings';
import { registerOnboardingHandlers } from '../features/onboarding';
import { registerMoodReportHandlers } from '../features/mood-report';
import { logger } from '../utils/logger';
import { registerReanalyzeCommands } from '../commands/reanalyze';

/**
 * Registers all feature handlers with the bot
 */
export function registerFeatures(bot: Bot<JournalBotContext>): void {
    // === FEATURE REGISTRATION ===
    logger.info('Registering bot feature handlers...');
    
    // Register core handlers first (commands like /start, /cancel)
    registerCoreHandlers(bot);
    
    // Register feature-specific handlers
    registerOnboardingHandlers(bot);
    registerJournalEntryHandlers(bot);
    registerJournalHistoryHandlers(bot);
    registerJournalChatHandlers(bot);
    registerSettingsHandlers(bot);
    registerMoodReportHandlers(bot);
    registerReanalyzeCommands(bot);
    
    logger.info('All feature handlers registered successfully');
    // ============================
} 