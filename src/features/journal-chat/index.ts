import { Bot } from 'grammy';
import { JournalBotContext } from '../../types/session';
import {
    startJournalChatHandler,
    handleJournalChatInput,
    exitJournalChatHandler,
    registerJournalChatHandlers as registerHandlers
} from './handlers';

export function registerJournalChatHandlers(bot: Bot<JournalBotContext>) {
    // Register the handlers exported from handlers.ts
    registerHandlers(bot);
}
