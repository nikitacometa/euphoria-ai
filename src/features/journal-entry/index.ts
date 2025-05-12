import { Bot } from 'grammy';
import { JournalBotContext } from '../../types/session';
import {
    handleJournalEntryInput,
    finishJournalEntryHandler,
    analyzeAndSuggestQuestionsHandler,
    newEntryHandler,
    cancelJournalEntryHandler,
    handleGoDeeper,
    handleCancelConfirmation
} from './handlers';
import { findOrCreateUser } from '../../database';
import { logger } from '../../utils/logger';
import { CALLBACKS } from './keyboards/index';

// Define the button texts this module handles - make sure these match EXACTLY what's in keyboards.ts
const NEW_ENTRY_TEXT = "📝 New Entry";
const SHARE_TEXT = "✅ Share"; // From notification
const SAVE_TEXT = "✅ Save";
const FINISH_REFLECTION_TEXT = "✅ Finish Reflection"; // Another save trigger?
const ANALYZE_TEXT = "👁️ AI Thought";
const CANCEL_TEXT = "❌ Cancel";

export function registerJournalEntryHandlers(bot: Bot<JournalBotContext>) {
    
    // Middleware to handle messages when in journaling mode
    bot.on('message', async (ctx, next) => {
        if (ctx.session?.journalEntryId) {
            // We're in journal entry mode - this means message should be added to the entry
            // Unless it's a command
            
            // Let commands pass through
            if (ctx.message && 'text' in ctx.message && ctx.message.text && ctx.message.text.startsWith('/')) {
                await next();
                return;
            }
            
            // It's a regular message to be added to the journal
            if (!ctx.from) return;
            const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
            await handleJournalEntryInput(ctx, user);
        } else {
            // Not journaling, pass to next handler
            await next();
        }
    });

    // Register /new_entry command handler
    bot.command('new_entry', async (ctx) => {
        if (!ctx.from) return;
        const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
        await newEntryHandler(ctx, user);
    });

    // Register callback queries for journal entry feature
    bot.callbackQuery("go_deeper", async (ctx: JournalBotContext) => {
        await ctx.answerCallbackQuery();
        if (!ctx.from) return;
        const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
        await handleGoDeeper(ctx, user);
    });

    // Handle the inline keyboard callbacks
    bot.callbackQuery(CALLBACKS.SAVE, async (ctx: JournalBotContext) => {
        await ctx.answerCallbackQuery();
        if (!ctx.from) return;
        const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
        await finishJournalEntryHandler(ctx, user);
    });

    bot.callbackQuery(CALLBACKS.ANALYZE, async (ctx: JournalBotContext) => {
        await ctx.answerCallbackQuery();
        if (!ctx.from) return;
        const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
        await analyzeAndSuggestQuestionsHandler(ctx, user);
    });

    bot.callbackQuery(CALLBACKS.CANCEL, async (ctx: JournalBotContext) => {
        await ctx.answerCallbackQuery();
        if (!ctx.from) return;
        const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
        await cancelJournalEntryHandler(ctx, user);
    });

    // Handle cancel confirmation callbacks
    bot.callbackQuery([CALLBACKS.CONFIRM_CANCEL, CALLBACKS.KEEP_WRITING], async (ctx: JournalBotContext) => {
        await ctx.answerCallbackQuery();
        if (!ctx.from) return;
        const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
        await handleCancelConfirmation(ctx, user);
    });

    // Handlers for specific button presses (hears) - these are backups for the in-context handlers
    // and handle when buttons are pressed from main menu or other contexts
    bot.hears([NEW_ENTRY_TEXT, SHARE_TEXT], async (ctx) => {
        if (!ctx.from) return;
        const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
        await newEntryHandler(ctx, user);
    });

    bot.hears([SAVE_TEXT, FINISH_REFLECTION_TEXT], async (ctx) => {
        if (!ctx.from) return;
        logger.debug("Save/Finish button pressed via hears handler");
        const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
        await finishJournalEntryHandler(ctx, user);
    });

    bot.hears(ANALYZE_TEXT, async (ctx) => {
        if (!ctx.from) return;
        logger.debug("Analyze button pressed via hears handler");
        const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
        await analyzeAndSuggestQuestionsHandler(ctx, user);
    });

    bot.hears(CANCEL_TEXT, async (ctx) => {
        if (!ctx.from) return;
        logger.debug("Cancel button pressed via hears handler");
        const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
        await cancelJournalEntryHandler(ctx, user);
    });
}
