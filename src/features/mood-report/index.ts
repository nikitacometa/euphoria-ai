import { Bot } from 'grammy';
import { JournalBotContext } from '../../types/session';
import { 
    startMoodReport,
    handleMoodRating,
    handleDaySuccess,
    handleSleepHours,
    handleDetailsInput,
    saveMoodReport,
    handleReflectMore,
    cancelMoodReport
} from './handlers';
import { MOOD_CALLBACKS } from './keyboards';
import { findOrCreateUser } from '../../database';
import { logger } from '../../utils/logger';
import { requireUser } from '../../middlewares/user-context';

/**
 * Registers mood report handlers with the bot
 */
export function registerMoodReportHandlers(bot: Bot<JournalBotContext>): void {
    // Register the slash command
    bot.command('report_mood', startMoodReport);
    
    // Register mood rating callbacks
    bot.callbackQuery(MOOD_CALLBACKS.MOOD_1, async (ctx) => {
        await handleMoodRating(ctx, 1);
    });
    bot.callbackQuery(MOOD_CALLBACKS.MOOD_2, async (ctx) => {
        await handleMoodRating(ctx, 2);
    });
    bot.callbackQuery(MOOD_CALLBACKS.MOOD_3, async (ctx) => {
        await handleMoodRating(ctx, 3);
    });
    bot.callbackQuery(MOOD_CALLBACKS.MOOD_4, async (ctx) => {
        await handleMoodRating(ctx, 4);
    });
    bot.callbackQuery(MOOD_CALLBACKS.MOOD_5, async (ctx) => {
        await handleMoodRating(ctx, 5);
    });
    
    // Register day success callbacks
    bot.callbackQuery(MOOD_CALLBACKS.SUCCESS_VERY, async (ctx) => {
        await handleDaySuccess(ctx, '🌟 Crushed it!');
    });
    bot.callbackQuery(MOOD_CALLBACKS.SUCCESS_MOSTLY, async (ctx) => {
        await handleDaySuccess(ctx, '✅ Mostly yes');
    });
    bot.callbackQuery(MOOD_CALLBACKS.SUCCESS_SOMEWHAT, async (ctx) => {
        await handleDaySuccess(ctx, '🤷 Somewhat');
    });
    bot.callbackQuery(MOOD_CALLBACKS.SUCCESS_NOT_REALLY, async (ctx) => {
        await handleDaySuccess(ctx, '😕 Not really');
    });
    bot.callbackQuery(MOOD_CALLBACKS.SUCCESS_FAILED, async (ctx) => {
        await handleDaySuccess(ctx, '❌ Failed today');
    });
    
    // Register sleep callbacks
    bot.callbackQuery(MOOD_CALLBACKS.SLEEP_LESS_4, async (ctx) => {
        await handleSleepHours(ctx, '😴 < 4 hours');
    });
    bot.callbackQuery(MOOD_CALLBACKS.SLEEP_4_6, async (ctx) => {
        await handleSleepHours(ctx, '😪 4-6 hours');
    });
    bot.callbackQuery(MOOD_CALLBACKS.SLEEP_6_8, async (ctx) => {
        await handleSleepHours(ctx, '🙂 6-8 hours');
    });
    bot.callbackQuery(MOOD_CALLBACKS.SLEEP_8_10, async (ctx) => {
        await handleSleepHours(ctx, '😊 8-10 hours');
    });
    bot.callbackQuery(MOOD_CALLBACKS.SLEEP_MORE_10, async (ctx) => {
        await handleSleepHours(ctx, '😁 > 10 hours');
    });
    
    // Register action callbacks
    bot.callbackQuery(MOOD_CALLBACKS.SKIP_DETAILS, async (ctx) => {
        await ctx.answerCallbackQuery();
        const user = requireUser(ctx);
        await handleDetailsInput(ctx);
    });
    
    bot.callbackQuery(MOOD_CALLBACKS.SAVE_MOOD, saveMoodReport);
    bot.callbackQuery(MOOD_CALLBACKS.REFLECT_MORE, handleReflectMore);
    bot.callbackQuery(MOOD_CALLBACKS.CANCEL_MOOD, cancelMoodReport);
    
    // Middleware to handle details input when in mood report mode
    bot.on(['message:text', 'message:voice', 'message:video_note', 'message:photo'], async (ctx, next) => {
        if (ctx.session?.moodReportActive && ctx.session?.moodReportStep === 'details') {
            try {
                await handleDetailsInput(ctx);
            } catch (error) {
                logger.error('Error handling mood report details input:', error);
                await ctx.reply('Sorry, there was an error processing your input. Please try again.');
            }
            return;
        }
        return next();
    });
} 