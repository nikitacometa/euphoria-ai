import { Bot, session } from 'grammy';
import { TELEGRAM_API_TOKEN, LOG_LEVEL } from '../config';
import { createLogger } from '../utils/logger';
import { initialSession, JournalBotContext } from './context';
import { attachUser } from './middleware/user';
import { registerAdminRoutes } from './routes/admin';
import { registerOnboardingRoutes } from './routes/onboarding';
import { registerMenuRoutes } from './routes/menu';
import { registerJournalEntryRoutes } from './routes/journal-entry';
import { registerJournalHistoryRoutes } from './routes/journal-history';
import { registerJournalChatRoutes } from './routes/journal-chat';
import { registerSettingsRoutes } from './routes/settings';
import { registerMessageRouter } from './routes/router';

const botLogger = createLogger('JournalBot', LOG_LEVEL);

export const journalBot = new Bot<JournalBotContext>(TELEGRAM_API_TOKEN);

journalBot.use(session({ initial: initialSession }));
journalBot.use(attachUser);

registerAdminRoutes(journalBot);
registerOnboardingRoutes(journalBot);
registerMenuRoutes(journalBot);
registerJournalEntryRoutes(journalBot);
registerJournalHistoryRoutes(journalBot);
registerJournalChatRoutes(journalBot);
registerSettingsRoutes(journalBot);
registerMessageRouter(journalBot);

// Without a global error handler a single failing update stops long polling.
journalBot.catch(error => {
    botLogger.error(`Unhandled error while processing update ${error.ctx.update.update_id}:`, error.error);
});
