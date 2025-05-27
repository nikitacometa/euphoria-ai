import { JournalBotContext } from '../../types/session';
import { IUser } from '../../types/models';
import { createMainMenuInlineKeyboard } from './keyboards';
import { findOrCreateUser, User as UserModel } from '../../database';
import { withCommandLogging } from '../../utils/command-logger';
import { startOnboarding } from '../onboarding/handlers';
import { logger } from '../../utils/logger';
import { Bot, Context } from 'grammy';
import { notificationService } from '../../services/notification.service';
import { ADMIN_IDS } from '../../config';
import { registerHowToCommand, registerNotificationSettingsCommands, registerAdminCommands } from '../../commands';
import { t } from '../../utils/localization';
import { getUserFromContext, requireUser } from '../../middlewares/user-context';

const HTML_PARSE_MODE = 'HTML' as const;

/**
 * Helper function to reply with HTML formatting (copied from journal-entry/handlers)
 */
async function replyWithHTML(ctx: JournalBotContext, message: string, options: Partial<Parameters<Context['reply']>[1]> = {}) {
    return ctx.reply(message, {
        parse_mode: HTML_PARSE_MODE,
        ...options
    });
}

/**
 * Generates a varied greeting message for the main menu.
 * Incorporates journaling theme, user name (sometimes), and random formatting.
 *
 * Note: We standardize on HTML parse mode throughout the application for consistency
 * and to avoid issues with special character escaping that occurs with MarkdownV2.
 * This ensures all UI messages follow the same formatting pattern.
 */
export function getMainMenuGreeting(user: IUser): { text: string; parse_mode?: 'HTML' } {
  const userName = user.name || user.firstName;
  const greetingText = t('common:mainMenu.greeting', {
    user,
    name: userName,
    defaultValue: `Hey ${userName}! What's on the agenda? Journaling, insights, or settings?`
  });
  return { text: greetingText, parse_mode: 'HTML' };
}

/**
 * Displays the main menu to the user with varied greetings.
 * Uses inline keyboard for better UI and more consistent experience.
 */
export async function showMainMenu(ctx: JournalBotContext, user: IUser, messageText?: string) {
    const greeting = messageText ? { text: messageText, parse_mode: HTML_PARSE_MODE } : getMainMenuGreeting(user);
    await replyWithHTML(ctx, greeting.text, { reply_markup: createMainMenuInlineKeyboard(user) });
    ctx.session.isMainMenuActive = true; // Set the flag
}

/**
 * Handles the /start command to either start onboarding or show main menu.
 */
export const handleStartCommand = withCommandLogging('start', async (ctx: JournalBotContext) => {
    if (!ctx.from) return;

    // Get user from context (added by userContextMiddleware)
    const user = requireUser(ctx);

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
    if (!ctx.from) {
        await replyWithHTML(ctx, t('core:cancelCommand.sessionsReset', { defaultValue: "✨ All active sessions have been reset."}));
        return;
    }

    // Get user from context (added by userContextMiddleware)
    const user = requireUser(ctx);

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

    await replyWithHTML(ctx, t('core:cancelCommand.sessionsReset', { user, defaultValue: "✨ All active sessions have been reset. Returning to main menu."}));
    await showMainMenu(ctx, user);
});

/**
 * Handles the /help command to show available commands and their descriptions.
 */
export const handleHelpCommand = withCommandLogging('help', async (ctx: JournalBotContext) => {
    if (!ctx.from) return;

    // Get user from context (added by userContextMiddleware)
    const user = requireUser(ctx);

    const helpText = t('core:helpCommand.fullText', {
        user,
        defaultValue: `
<b>Enter the Infinity ♾️</b>

<code>/howto</code> - <i>I will show you nice usecases of me</i>

<code>/start</code> - <i>Restart the bot or return to main menu</i>
<code>/menu</code> - <i>Show the main menu with clickable buttons</i>
<code>/journal_chat</code> - <i>Have a conversation with your journal AI</i>
<code>/new_entry</code> - <i>Create a new journal entry immediately</i>
<code>/report_mood</code> - <i>Quick mood check-in with guided questions</i>
<code>/history</code> - <i>Browse your past journal entries</i>
<code>/settings</code> - <i>Customize notifications, language & more</i>
<code>/cancel</code> - <i>Exit current operation (for the commitment-phobic)</i>
<code>/reset</code> - <i>Same as cancel but sounds more dramatic</i>
<code>/help</code> - <i>You're reading it now! Mind-blowing, right?</i>

<b>💡 PRO TIPS:</b>
• Record voice/video messages for easier journaling
• Use Journal Chat to explore insights about your entries
• Enable notifications to build a regular journaling habit
• Try different entry types to capture your full experience

<b>👀 Current Limits:</b>
• max 5 minutes voice messages

<i>Remember: I'm here to be your digital confidant — all entries are private and secure!</i>
`
    });

    await replyWithHTML(ctx, helpText);
});

/**
 * Handles the /new_entry command to start a new journal entry
 */
export const handleNewEntryCommand = withCommandLogging('new_entry', async (ctx: JournalBotContext) => {
    if (!ctx.from) return;

    // Get user from context (added by userContextMiddleware)
    const user = requireUser(ctx);

    // Import and call the newEntryHandler from journal-entry feature
    const { newEntryHandler } = await import('../journal-entry/handlers.js');
    await newEntryHandler(ctx, user);
});

/**
 * Handles the /history command to view journal history
 */
export const handleHistoryCommand = withCommandLogging('history', async (ctx: JournalBotContext) => {
    if (!ctx.from) return;

    // Get user from context (added by userContextMiddleware)
    const user = requireUser(ctx);

    // Import and call the showJournalHistoryHandler from journal-history feature
    const { showJournalHistoryHandler } = await import('../journal-history/handlers.js');
    await showJournalHistoryHandler(ctx, user);
});

/**
 * Handles the /settings command to show settings menu
 */
export const handleSettingsCommand = withCommandLogging('settings', async (ctx: JournalBotContext) => {
    if (!ctx.from) return;

    // Get user from context (added by userContextMiddleware)
    const user = requireUser(ctx);

    // Import and call the showSettingsHandler from settings feature
    const { showSettingsHandler } = await import('../settings/handlers.js');
    await showSettingsHandler(ctx, user);
});

/**
 * Handles /check_notifications command to verify notification system health
 * This is an admin-only command to help diagnose notification issues
 */
export const checkNotificationsHandler = withCommandLogging('check_notifications', async (ctx: JournalBotContext) => {
    // Get user from context (added by userContextMiddleware)
    const callingUser = getUserFromContext(ctx);
    if (!ADMIN_IDS.includes(ctx.from?.id || 0)) {
        return await replyWithHTML(ctx, t('errors:adminOnlyCommand', {user: callingUser}));
    }
    try {
        await replyWithHTML(ctx, t('core:checkNotifications.checking', {user: callingUser, defaultValue: "⏳ Checking notification system health..."}));
        const isHealthy = await notificationService.checkHealth();
        const userCount = await UserModel.countDocuments({ notificationsEnabled: true });
        const usersWithErrors = await UserModel.find({ lastNotificationError: { $exists: true, $ne: null }}).limit(5);
        let report = `📊 <b>${t('core:checkNotifications.reportTitle', {user: callingUser, defaultValue: "Notification System Status"})}</b>\n\n`;
        report += `${t('core:checkNotifications.systemHealth', {user: callingUser, healthStatus: isHealthy ? '✅ OK' : '❌ ISSUES DETECTED'})}\n`;
        report += `${t('core:checkNotifications.activeUsers', {user: callingUser, count: userCount.toString()})}\n\n`;
        if (usersWithErrors.length > 0) {
            report += `<b>${t('core:checkNotifications.recentErrorsHeader', {user: callingUser, count: usersWithErrors.length.toString()})}</b> :\n`;
            for (const errorUser of usersWithErrors) {
                const lastAttempt = errorUser.lastNotificationAttempt ? new Date(errorUser.lastNotificationAttempt).toISOString().substring(0, 16).replace('T', ' ') : t('common:unknown', {user: callingUser});
                report += `- User ${errorUser.telegramId}: ${errorUser.lastNotificationError} (${lastAttempt})\n`;
            }
        } else {
            report += `${t('core:checkNotifications.noRecentErrors', {user: callingUser})}\n`;
        }
        await replyWithHTML(ctx, report);
    } catch (error) {
        logger.error('Error in check_notifications command:', error);
        await replyWithHTML(ctx, t('errors:checkNotificationsError', {user: callingUser, defaultValue: "❌ Error checking notification system. Please check logs for details."} ));
    }
});

/**
 * Handles /notify_all command to send notifications to all users
 * This is an admin-only command to broadcast notifications to all users
 */
export const notifyAllHandler = withCommandLogging('notify_all', async (ctx: JournalBotContext) => {
    // Get user from context (added by userContextMiddleware)
    const callingUser = getUserFromContext(ctx);
    if (!ADMIN_IDS.includes(ctx.from?.id || 0)) {
        return await replyWithHTML(ctx, t('errors:adminOnlyCommand', {user: callingUser}));
    }
    try {
        await replyWithHTML(ctx, t('core:notifyAll.starting', {user: callingUser}));
        const allDbUsers = await UserModel.find();
        const userCount = allDbUsers.length;
        if (userCount === 0) {
            return await replyWithHTML(ctx, t('core:notifyAll.noUsers', {user: callingUser}));
        }
        await replyWithHTML(ctx, t('core:notifyAll.preparing', {user: callingUser, userCount: userCount.toString()}));
        let successCount = 0;
        let errorCount = 0;
        let errorUsers: Array<{id: number, error: string}> = [];
        for (const dbUser of allDbUsers) {
            try {
                await notificationService.sendBroadcastNotification(dbUser);
                successCount++;
                await UserModel.findByIdAndUpdate(dbUser._id, { lastNotificationSent: new Date(), lastNotificationError: null });
                if (successCount % 10 === 0) logger.info(`Notification broadcast progress: ${successCount}/${userCount} users processed`);
            } catch (e) {
                errorCount++;
                const errorMessage = e instanceof Error ? e.message : String(e);
                errorUsers.push({ id: dbUser.telegramId, error: errorMessage });
                await UserModel.findByIdAndUpdate(dbUser._id, { lastNotificationError: errorMessage, lastNotificationAttempt: new Date() }).catch(err => logger.error(`Failed to update error status for user ${dbUser.telegramId}:`, err));
                logger.error(`Error sending notification to user ${dbUser.telegramId}:`, e);
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        let summary = `✅ <b>${t('core:notifyAll.completeTitle', {user: callingUser})}</b>\n\n`;
        summary += `${t('core:notifyAll.totalUsers', {user: callingUser})}: ${userCount}\n`;
        summary += `${t('core:notifyAll.successful', {user: callingUser})}: ${successCount}\n`;
        summary += `${t('core:notifyAll.failed', {user: callingUser})}: ${errorCount}\n\n`;
        if (errorCount > 0) {
            summary += `<b>${t('core:notifyAll.errorDetailsTitle', {user: callingUser, count: Math.min(5, errorCount).toString()})}</b>:\n`;
            errorUsers.slice(0, 5).forEach(errorDetail => {
                summary += `- User ${errorDetail.id}: ${errorDetail.error.substring(0, 50)}${errorDetail.error.length > 50 ? '...' : ''}\n`;
            });
        }
        await replyWithHTML(ctx, summary);
    } catch (error) {
        logger.error('Error in notify_all command:', error);
        await replyWithHTML(ctx, t('errors:notifyAllError', {user: callingUser}));
    }
});

/**
 * Handles the /menu command to display the main menu
 */
export const handleMenuCommand = withCommandLogging('menu', async (ctx: JournalBotContext) => {
    if (!ctx.from) return;

    // Get user from context (added by userContextMiddleware)
    const user = requireUser(ctx);

    await showMainMenu(ctx, user);
});

/**
 * Registers all command handlers with the bot
 */
export function registerCommandHandlers(bot: Bot<JournalBotContext>): void {
    // Register the /howto command
    registerHowToCommand(bot);
    // Register notification settings commands
    registerNotificationSettingsCommands(bot);
    // Register admin commands
    registerAdminCommands(bot);

    // Register core commands
    bot.command('start', handleStartCommand);
    bot.command(['cancel', 'reset', 'stop'], handleCancelCommand);
    bot.command('help', handleHelpCommand);
    bot.command('menu', handleMenuCommand);

    // Register menu item commands
    bot.command('new_entry', handleNewEntryCommand);
    bot.command('history', handleHistoryCommand);
    bot.command('settings', handleSettingsCommand);
    // 'journal_chat' is already registered in journal-chat/handlers.ts

    // Admin commands
    bot.command('check_notifications', checkNotificationsHandler);
    bot.command('notify_all', notifyAllHandler);
}
