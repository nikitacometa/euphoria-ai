import { Bot } from 'grammy';
import { JournalBotContext } from '../../types/session';
import {
    handleJournalEntryInput,
    finishJournalEntryHandler,
    analyzeAndSuggestQuestionsHandler,
    newEntryHandler,
    cancelJournalEntryHandler
} from './handlers';
import { findOrCreateUser } from '../../database';

// Define the button texts this module handles
const NEW_ENTRY_TEXT = "📝 New Entry";
const SHARE_TEXT = "✅ Share"; // From notification
const SAVE_TEXT = "✅ Save";
const FINISH_REFLECTION_TEXT = "✅ Finish Reflection"; // Another save trigger?
const ANALYZE_TEXT = "🔍 Analyze & Suggest Questions";
const CANCEL_TEXT = "❌ Cancel";

export function registerJournalEntryHandlers(bot: Bot<JournalBotContext>) {
    
    // Middleware to handle messages when in journaling mode
    bot.on('message', async (ctx, next) => {
        if (ctx.session?.journalEntryId) {
            // User is journaling, handle their input
            if (!ctx.from) return; // Should exist
            const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
            await handleJournalEntryInput(ctx, user);
        } else {
            // Not journaling, pass to next handler
            await next();
        }
    });

    // Handlers for specific button presses (hears)
    bot.hears([NEW_ENTRY_TEXT, SHARE_TEXT], async (ctx) => {
        if (!ctx.from) return;
        const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
        await newEntryHandler(ctx, user);
    });

    bot.hears([SAVE_TEXT, FINISH_REFLECTION_TEXT], async (ctx) => {
        if (!ctx.from) return;
        const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
        // Both buttons trigger the finish/save logic
        await finishJournalEntryHandler(ctx, user);
    });

    bot.hears(ANALYZE_TEXT, async (ctx) => {
        if (!ctx.from) return;
        const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
        await analyzeAndSuggestQuestionsHandler(ctx, user);
    });

    // Note: The CANCEL_TEXT handler needs careful placement.
    // It could be triggered outside journaling (e.g., notification time setting).
    // The current cancelJournalEntryHandler includes fallback logic for this,
    // but ideally, cancellation should be handled within each feature context.
    // For now, we register it here, relying on the handler's internal check.
    bot.hears(CANCEL_TEXT, async (ctx) => {
         if (!ctx.from) return;
         const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
         await cancelJournalEntryHandler(ctx, user);
    });

    // TODO: Potentially move the callbackQuery handlers related to analysis/go deeper here too.
}
