import { Bot } from 'grammy';
import { JournalBotContext } from '../../types/session';
import {
    handleJournalEntryInput,
    finishJournalEntryHandler,
    analyzeAndSuggestQuestionsHandler,
    newEntryHandler,
    cancelJournalEntryHandler,
    handleGoDeeper
} from './handlers';
import { findOrCreateUser } from '../../database';
import { logger } from '../../utils/logger';

// Define the button texts this module handles - make sure these match EXACTLY what's in keyboards.ts
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
            // We're in journal entry mode - this means message should be added to the entry
            // Unless it's a command or button press
            
            // Let commands pass through
            if (ctx.message && 'text' in ctx.message && ctx.message.text && ctx.message.text.startsWith('/')) {
                await next();
                return;
            }
            
            // User is journaling, handle their input - but not if it's a button press
            if (!ctx.from) return; 
            
            // Check if the message is a button press by exact match
            if (ctx.message && 'text' in ctx.message && ctx.message.text) {
                const text = ctx.message.text;
                
                // Log for debugging
                logger.debug(`Text message received during journal entry: "${text}"`);
                
                // Handle button presses directly here for reliability
                if (text === SAVE_TEXT || text === FINISH_REFLECTION_TEXT) {
                    const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
                    await finishJournalEntryHandler(ctx, user);
                    return;
                }
                
                if (text === ANALYZE_TEXT) {
                    const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
                    await analyzeAndSuggestQuestionsHandler(ctx, user);
                    return;
                }
                
                if (text === CANCEL_TEXT) {
                    const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
                    await cancelJournalEntryHandler(ctx, user);
                    return;
                }
            }
            
            // It's a regular message to be added to the journal
            const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
            await handleJournalEntryInput(ctx, user);
        } else {
            // Not journaling, pass to next handler
            await next();
        }
    });

    // Register callback queries for journal entry feature
    bot.callbackQuery("analyze_journal", async (ctx: JournalBotContext) => {
        await ctx.answerCallbackQuery();
        if (!ctx.from) return;
        const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
        await analyzeAndSuggestQuestionsHandler(ctx, user);
    });

    bot.callbackQuery("go_deeper", async (ctx: JournalBotContext) => {
        await ctx.answerCallbackQuery();
        if (!ctx.from) return;
        const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
        await handleGoDeeper(ctx, user);
    });

    bot.callbackQuery("finish_journal", async (ctx: JournalBotContext) => {
        await ctx.answerCallbackQuery();
        if (!ctx.from) return;
        const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
        await finishJournalEntryHandler(ctx, user);
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
