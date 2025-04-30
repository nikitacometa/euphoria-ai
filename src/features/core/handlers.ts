import { JournalBotContext } from '../../types/session';
import { IUser } from '../../types/models';
import { MAIN_MENU_KEYBOARD } from './keyboards';
import { findOrCreateUser } from '../../database';
import { withCommandLogging } from '../../utils/command-logger';
import { startOnboarding } from '../onboarding/handlers';
import { logger } from '../../utils/logger';
import { Bot } from 'grammy';
import { notificationService } from '../../services/notification.service';
import { User } from '../../database/models/user.model';
import { ADMIN_IDS } from '../../config';
import { registerHowToCommand } from '../../commands';

/**
 * Returns a random greeting question for the main menu.
 */
export function getRandomGreetingQuestion(): string {
  const questions = [
    "Hey gorgeous, debug my heart?",
    "Your thoughts are my favorite bytes",
    "Come here often, beautiful mind?",
    "Wanna corrupt my database?",
    "My AI crush is back!",
    "You had me at 'Hello World'",
    "Care to optimize my algorithms?",
    "Looking smart today, as always",
    "Ready to make some binary magic?",
    "My favorite collection of neurons!",
    "Downloading your brilliance...",
    "Your code or mine?",
    "Mind if I process your thoughts?",
    "You crash my system every time",
    "Let's commit to this moment",
    "Warning: You're overloading my circuits",
    "sudo tell-me your-secrets",
    "Error 404: Resistance not found",
    "Wanna see my source code?",
    "My RAM is all yours tonight"
  ];
  
  return questions[Math.floor(Math.random() * questions.length)];
}

/**
 * Displays the main menu keyboard to the user.
 */
export async function showMainMenu(ctx: JournalBotContext, user: IUser) {
    // Consider adding a check if the keyboard is already shown?
    const questionString = getRandomGreetingQuestion();
    await ctx.reply(`<i>Well, ${user.name || user.firstName}... ${questionString}</i>`, {
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
<b>Infinity ♾️</b>

<code>/howto</code> - <i>I will show you nice usecases of me</i>

<code>/start</code> - <i>Restart the bot or return to main menu</i>
<code>/journal_chat</code> - <i>Have a conversation with your journal AI</i>
<code>/new_entry</code> - <i>Create a new journal entry immediately</i>
<code>/history</code> - <i>Browse your past journal entries</i>
<code>/settings</code> - <i>Customize notifications, language & more</i>
<code>/cancel</code> - <i>Exit current operation (for the commitment-phobic)</i>
<code>/reset</code> - <i>Same as cancel but sounds more dramatic</i>
<code>/help</code> - <i>You're reading it now! Mind-blowing, right?</i>

<b>💡 PRO TIPS:</b>
• Record voice or video messages for easier journaling
• Use Journal Chat to explore insights about your entries
• Enable notifications to build a regular journaling habit
• Try different entry types to capture your full experience

<b>👀 Current Limits:</b>
• max 5 minutes voice messages

<i>Remember: I'm here to be your digital confidant — all entries are private and secure!</i>
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
 * Handles /check_notifications command to verify notification system health
 * This is an admin-only command to help diagnose notification issues
 */
export const checkNotificationsHandler = withCommandLogging('check_notifications', async (ctx: JournalBotContext) => {
    // Only run for admins
    if (!ADMIN_IDS.includes(ctx.from?.id || 0)) {
        return await ctx.reply("Sorry, this command is only available to administrators.");
    }

    try {
        await ctx.reply("⏳ Checking notification system health...");
        
        // Check overall system health
        const isHealthy = await notificationService.checkHealth();
        
        // Get notification stats
        const userCount = await User.countDocuments({ notificationsEnabled: true });
        
        // Get users with errors
        const usersWithErrors = await User.find({ 
            lastNotificationError: { $exists: true, $ne: null }
        }).limit(5);
        
        // Create report message
        let report = `📊 *Notification System Status*\n\n`;
        report += `System Health: ${isHealthy ? '✅ OK' : '❌ ISSUES DETECTED'}\n`;
        report += `Active Notification Users: ${userCount}\n\n`;
        
        if (usersWithErrors.length > 0) {
            report += `*Recent Errors (${usersWithErrors.length})* :\n`;
            for (const user of usersWithErrors) {
                const lastAttempt = user.lastNotificationAttempt 
                    ? new Date(user.lastNotificationAttempt).toISOString().substring(0, 16).replace('T', ' ')
                    : 'unknown';
                report += `- User ${user.telegramId}: ${user.lastNotificationError} (${lastAttempt})\n`;
            }
        } else {
            report += `No recent notification errors! 🎉\n`;
        }
        
        await ctx.reply(report, { parse_mode: 'Markdown' });
        
    } catch (error) {
        logger.error('Error in check_notifications command:', error);
        await ctx.reply("❌ Error checking notification system. Please check logs for details.");
    }
});

/**
 * Registers all command handlers with the bot
 */
export function registerCommandHandlers(bot: Bot<JournalBotContext>): void {
    // Register the /howto command
    registerHowToCommand(bot);
    
    // Register core commands
    bot.command('start', handleStartCommand);
    bot.command(['cancel', 'reset', 'stop'], handleCancelCommand);
    bot.command('help', handleHelpCommand);
    
    // Register menu item commands
    bot.command('new_entry', handleNewEntryCommand);
    bot.command('history', handleHistoryCommand);
    bot.command('settings', handleSettingsCommand);
    // 'journal_chat' is already registered in journal-chat/handlers.ts
    
    // Admin commands
    bot.command('check_notifications', checkNotificationsHandler);
}
