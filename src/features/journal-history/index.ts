import { Bot } from 'grammy';
import { JournalBotContext } from '../../types/session';
import {
    showJournalHistoryHandler,
    viewJournalEntryHandler,
    showJournalHistoryCallbackHandler,
    deleteJournalEntryHandler
} from './handlers';
import { findOrCreateUser } from '../../database';

const HISTORY_TEXT = "📚 Journal History";
const VIEW_ENTRY_PREFIX = 'view_entry:';
const DELETE_ENTRY_PREFIX = 'delete_entry:';
const HISTORY_CALLBACK = 'journal_history';

export function registerJournalHistoryHandlers(bot: Bot<JournalBotContext>) {
    
    // Handler for the main history button
    bot.hears(HISTORY_TEXT, async (ctx) => {
        if (!ctx.from) return;
        const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
        await showJournalHistoryHandler(ctx, user);
    });

    // Handle specific callback queries for this feature
    bot.callbackQuery(new RegExp(`^${VIEW_ENTRY_PREFIX}`), async (ctx) => {
         if (!ctx.from || !ctx.callbackQuery?.data) return;
         const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
         const entryId = ctx.callbackQuery.data.substring(VIEW_ENTRY_PREFIX.length);
         await viewJournalEntryHandler(ctx, user, entryId);
    });

    // Handle delete entry callback
    bot.callbackQuery(new RegExp(`^${DELETE_ENTRY_PREFIX}`), async (ctx) => {
         if (!ctx.from || !ctx.callbackQuery?.data) return;
         const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
         const entryId = ctx.callbackQuery.data.substring(DELETE_ENTRY_PREFIX.length);
         await deleteJournalEntryHandler(ctx, user, entryId);
    });

    bot.callbackQuery(HISTORY_CALLBACK, async (ctx) => {
         if (!ctx.from) return;
         const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
         await showJournalHistoryCallbackHandler(ctx, user);
    });
}
