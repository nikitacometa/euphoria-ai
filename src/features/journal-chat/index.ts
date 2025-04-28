import { Bot } from 'grammy';
import { JournalBotContext } from '../../types/session';
import {
    startJournalChatHandler,
    handleJournalChatInput,
    exitJournalChatHandler
} from './handlers';
import { findOrCreateUser } from '../../database';

const ASK_JOURNAL_TEXT = "🤔 Ask My Journal";
const EXIT_CHAT_TEXT = "❌ Exit Chat Mode";

export function registerJournalChatHandlers(bot: Bot<JournalBotContext>) {

    // Middleware to handle messages when in journal chat mode
    bot.on('message', async (ctx, next) => {
        if (ctx.session?.journalChatMode) {
            // User is chatting, handle their input
            if (!ctx.from) return; 
            const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
            await handleJournalChatInput(ctx, user);
        } else {
            // Not chatting, pass to next handler
            await next();
        }
    });

    // Handler to initiate chat mode
    bot.hears(ASK_JOURNAL_TEXT, async (ctx) => {
        if (!ctx.from) return;
        const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
        await startJournalChatHandler(ctx, user);
    });

    // Handler to exit chat mode
    bot.hears(EXIT_CHAT_TEXT, async (ctx) => {
        if (!ctx.from) return;
        const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
        await exitJournalChatHandler(ctx, user);
    });
}
