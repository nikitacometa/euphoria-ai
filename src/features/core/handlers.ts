import { JournalBotContext } from '../../types/session';
import { IUser } from '../../types/models';
import { MAIN_MENU_KEYBOARD } from './keyboards';
import { findOrCreateUser } from '../../database';
import { withCommandLogging } from '../../utils/command-logger';
import { startOnboarding } from '../onboarding/handlers';
import { logger } from '../../utils/logger';

/**
 * Displays the main menu keyboard to the user.
 */
export async function showMainMenu(ctx: JournalBotContext, user: IUser) {
    // Consider adding a check if the keyboard is already shown?
    await ctx.reply(`Welcome back, ${user.name || user.firstName}! Ready to explore your thoughts? ✨`, {
        reply_markup: MAIN_MENU_KEYBOARD,
        parse_mode: 'HTML'
    });
}

/**
 * Handles the /start command to either start onboarding or show main menu.
 */
export const handleStartCommand = withCommandLogging('start', async (ctx: JournalBotContext) => {
    if (!ctx.from) return;

    const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
    
    if (user.onboardingCompleted) {
        await showMainMenu(ctx, user);
    } else {
        await startOnboarding(ctx);
    }
});

/**
 * Handles the /cancel, /reset, and /stop commands to reset user state.
 */
export const handleCancelCommand = withCommandLogging('cancel', async (ctx: JournalBotContext) => {
    if (!ctx.from) return;
    
    const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
    
    // Reset all session flags
    if (ctx.session.journalEntryId) {
        logger.info(`Cancelling journal entry ${ctx.session.journalEntryId} via /cancel command`);
        ctx.session.journalEntryId = undefined;
    }
    
    if (ctx.session.journalChatMode) {
        logger.info(`Exiting journal chat mode via /cancel command`);
        ctx.session.journalChatMode = false;
        ctx.session.waitingForJournalQuestion = false;
    }
    
    if (ctx.session.waitingForNotificationTime) {
        logger.info(`Cancelling notification time setting via /cancel command`);
        ctx.session.waitingForNotificationTime = false;
    }
    
    if (ctx.session.onboardingStep) {
        logger.info(`Cancelling onboarding step ${ctx.session.onboardingStep} via /cancel command`);
        ctx.session.onboardingStep = undefined;
    }
    
    await ctx.reply("✨ All active sessions have been reset. Returning to main menu.");
    await showMainMenu(ctx, user);
});
