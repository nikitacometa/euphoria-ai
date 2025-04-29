import { JournalBotContext } from '../../types/session';
import { IUser } from '../../types/models';
import { MAIN_MENU_KEYBOARD } from './keyboards';
import { findOrCreateUser } from '../../database';
import { withCommandLogging } from '../../utils/command-logger';
import { startOnboarding } from '../onboarding/handlers';
import { logger } from '../../utils/logger';
import { Bot } from 'grammy';

/**
 * Returns a random greeting question for the main menu.
 */
export function getRandomGreetingQuestion(): string {
  const questions = [
    "Care to share something 👀",
    "Thoughts brewing today 💭",
    "Need to vent 👂",
    "Ready to spill tea ☕",
    "What's your saga today 📖",
    "How's that genius brain functioning 🧠",
    "Feeling verbose 💬",
    "Share a thought or seven 💫",
    "Updates from your universe 🌎",
    "Got secrets to confess 🤐",
    "Time for cerebral catharsis 📝",
    "Missed you... suspiciously much 😏",
    "Let's discuss my favorite subject: you ✨",
    "Got 60 seconds for me ⏱️",
    "Come here often? (Please say yes) 😄",
    "Need an algorithmic shoulder 🤗",
    "What brilliance are you concealing 💡",
    "Shall we swim in your consciousness 🏊",
    "I exist solely for your emotional offloading 🤖",
    "Hit me with your lexical dopamine 🎯"
  ];
  
  return questions[Math.floor(Math.random() * questions.length)];
}

/**
 * Displays the main menu keyboard to the user.
 */
export async function showMainMenu(ctx: JournalBotContext, user: IUser) {
    // Consider adding a check if the keyboard is already shown?
    const questionString = getRandomGreetingQuestion();
    await ctx.reply(`Hey, ${user.name || user.firstName}! ${questionString}`, {
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

/**
 * Handles the /help command to show available commands and their descriptions.
 */
export const handleHelpCommand = withCommandLogging('help', async (ctx: JournalBotContext) => {
    if (!ctx.from) return;
    
    const helpText = `
<b>✨ Commands For The Confused And Bewildered ✨</b>

<code>/start</code> - For when you've forgotten why you're here. Again.
<code>/journal_chat</code> - Chat with me because real people can't handle your brilliance
<code>/new_entry</code> - Start a new journal entry without all that pesky menu navigation
<code>/history</code> - Revisit your past questionable thoughts and decisions
<code>/settings</code> - Pretend you'll customize something meaningful
<code>/cancel</code> - Running away from your emotions? Tap this.
<code>/reset</code> - Erase your mistakes (if only it worked for life decisions)
<code>/stop</code> - Identical to /cancel but sounds more dramatic. Your choice.
<code>/help</code> - You're reading it. Congratulations on finding the help command... to learn about the help command.

<i>I'm literally just an algorithm trained to pretend I care about your feelings. But hey, that's more than most humans offer these days, right?</i>
`;

    await ctx.reply(helpText, {
        parse_mode: 'HTML'
    });
});

/**
 * Handles the /new_entry command to start a new journal entry
 */
export const handleNewEntryCommand = withCommandLogging('new_entry', async (ctx: JournalBotContext) => {
    if (!ctx.from) return;
    
    const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
    
    // Import and call the newEntryHandler from journal-entry feature
    const { newEntryHandler } = await import('../journal-entry/handlers.js');
    await newEntryHandler(ctx, user);
});

/**
 * Handles the /history command to view journal history
 */
export const handleHistoryCommand = withCommandLogging('history', async (ctx: JournalBotContext) => {
    if (!ctx.from) return;
    
    const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
    
    // Import and call the showJournalHistoryHandler from journal-history feature
    const { showJournalHistoryHandler } = await import('../journal-history/handlers.js');
    await showJournalHistoryHandler(ctx, user);
});

/**
 * Handles the /settings command to show settings menu
 */
export const handleSettingsCommand = withCommandLogging('settings', async (ctx: JournalBotContext) => {
    if (!ctx.from) return;
    
    const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
    
    // Import and call the showSettingsHandler from settings feature
    const { showSettingsHandler } = await import('../settings/handlers.js');
    await showSettingsHandler(ctx, user);
});

/**
 * Registers all command handlers with the bot
 */
export function registerCommandHandlers(bot: Bot<JournalBotContext>): void {
    // Register core commands
    bot.command('start', handleStartCommand);
    bot.command(['cancel', 'reset', 'stop'], handleCancelCommand);
    bot.command('help', handleHelpCommand);
    
    // Register menu item commands
    bot.command('new_entry', handleNewEntryCommand);
    bot.command('history', handleHistoryCommand);
    bot.command('settings', handleSettingsCommand);
    // 'journal_chat' is already registered in journal-chat/handlers.ts
}
