import { Bot } from 'grammy';
import { JournalBotContext } from '../../types/session';
import {
    startJournalChatHandler,
    handleJournalChatInput,
    exitJournalChatHandler,
    registerJournalChatHandlers as registerHandlers
} from './handlers';
import { findOrCreateUser } from '../../database';

const ASK_JOURNAL_TEXT = "🤔 Ask My Journal";
const EXIT_CHAT_TEXT = "❌ Exit Chat Mode";

export function registerJournalChatHandlers(bot: Bot<JournalBotContext>) {
    // Register the handlers exported from handlers.ts
    registerHandlers(bot);

    // Handle the specific menu button text to start chat mode
    bot.hears(ASK_JOURNAL_TEXT, async (ctx) => {
        if (!ctx.from) return;
        const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
        await startJournalChatHandler(ctx, user);
    });

    // Handle the specific text to exit chat mode (as a keyboard button)
    bot.hears(EXIT_CHAT_TEXT, async (ctx) => {
        await exitJournalChatHandler(ctx);
    });
}
