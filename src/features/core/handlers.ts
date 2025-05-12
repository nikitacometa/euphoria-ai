import { JournalBotContext } from '../../types/session';
import { IUser } from '../../types/models';
import { createMainMenuInlineKeyboard } from './keyboards';
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
 * Generates a varied greeting message for the main menu.
 * Incorporates journaling theme, user name (sometimes), and random formatting.
 * 
 * Note: We standardize on HTML parse mode throughout the application for consistency
 * and to avoid issues with special character escaping that occurs with MarkdownV2.
 * This ensures all UI messages follow the same formatting pattern.
 */
export function getMainMenuGreeting(user: IUser): { text: string; parse_mode?: 'HTML' } {
  const userName = user.name || user.firstName;
  const useName = Math.random() < 0.6; // Use name ~60% of the time

  // Define the type for the greeting functions and their return values
  type GreetingFunction = (name?: string) => { text: string; parse_mode?: 'HTML' };

  const greetings: GreetingFunction[] = [
    // Simple & Journaling focused
    () => ({ text: `Back for more self-reflection? Let's dive in.`, parse_mode: 'HTML' }),
    () => ({ text: `Ready to chronicle your day? The journal awaits.`, parse_mode: 'HTML' }),
    () => ({ text: `What thoughts are swirling today? Let's capture them.`, parse_mode: 'HTML' }),
    () => ({ text: `Time to unload your mind? I'm ready.`, parse_mode: 'HTML' }),
    (name?: string) => ({ text: `Hey${name ? ` ${name}` : ''}! What's on the agenda? Journaling, insights, or settings?`, parse_mode: 'HTML' }),

    // Playful / Slightly Sarcastic - converted from MarkdownV2 to HTML
    (name?: string) => ({ text: `Oh, it's <b>you</b> again${name ? `, ${name}` : ''}. Ready to spill the tea... to yourself?`, parse_mode: 'HTML' }),
    () => ({ text: `<b>Taps microphone</b> Is this thing on? Good. Main menu time.`, parse_mode: 'HTML' }),
    () => ({ text: `<i>Another day, another existential thought dump? Let's go.</i>`, parse_mode: 'HTML' }),
    (name?: string) => ({ text: `Look who decided to grace us with their presence${name ? `, ${name}` : ''}. What journaling adventures await?`, parse_mode: 'HTML' }),
    () => ({ text: `Beep boop. Main menu initialized. Don't break anything.`, parse_mode: 'HTML' }),

    // Already using HTML formatting
    (name?: string) => ({ text: `<i>Well hello there${name ? `, ${name}` : ''}.</i> Ready for some introspection?`, parse_mode: 'HTML' }),
    () => ({ text: `<code>Loading main menu...</code> Complete. What's next?`, parse_mode: 'HTML' }),
    (name?: string) => ({ text: `<b>${name || 'Hey'}!</b> Your journal is calling.`, parse_mode: 'HTML' }),
    () => ({ text: `✨ Main Menu Magic! ✨ What shall we conjure?`, parse_mode: 'HTML' }),
  ];

  const randomIndex = Math.floor(Math.random() * greetings.length);
  const selectedGreetingFn = greetings[randomIndex];
  
  return (selectedGreetingFn.length > 0 && useName ? selectedGreetingFn(userName) : selectedGreetingFn());
}

/**
 * Displays the main menu to the user with varied greetings.
 * Uses inline keyboard for better UI and more consistent experience.
 */
export async function showMainMenu(ctx: JournalBotContext, user: IUser) {
    const greeting = getMainMenuGreeting(user);
    await ctx.reply(greeting.text, {
        reply_markup: createMainMenuInlineKeyboard(),
        parse_mode: greeting.parse_mode 
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

    // Revert to the original single help text constant
    const helpText = `
<b>Enter the Infinity ♾️</b>

<code>/howto</code> - <i>I will show you nice usecases of me</i>

<code>/start</code> - <i>Restart the bot or return to main menu</i>
<code>/menu</code> - <i>Show the main menu with clickable buttons</i>
<code>/journal_chat</code> - <i>Have a conversation with your journal AI</i>
<code>/new_entry</code> - <i>Create a new journal entry immediately</i>
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
 * Handles /notify_all command to send notifications to all users
 * This is an admin-only command to broadcast notifications to all users
 */
export const notifyAllHandler = withCommandLogging('notify_all', async (ctx: JournalBotContext) => {
    // Only run for admins
    if (!ADMIN_IDS.includes(ctx.from?.id || 0)) {
        return await ctx.reply("Sorry, this command is only available to administrators.");
    }

    try {
        await ctx.reply("🚀 Starting notification broadcast to all users...");
        
        // Get all users from the database
        const users = await User.find();
        const userCount = users.length;
        
        if (userCount === 0) {
            return await ctx.reply("❌ No users found in the database.");
        }
        
        // Notify admin with count
        await ctx.reply(`📤 Preparing to send notifications to ${userCount} users. This may take some time...`);
        
        // Process and track notification sending
        let successCount = 0;
        let errorCount = 0;
        let errorUsers: Array<{id: number, error: string}> = [];
        
        // Process users in batches to prevent overloading
        for (const user of users) {
            try {
                // Use the notification service's sendBroadcastNotification method
                await notificationService.sendBroadcastNotification(user);
                successCount++;
                
                // Update last notification sent timestamp
                await User.findByIdAndUpdate(user._id, {
                    lastNotificationSent: new Date(),
                    lastNotificationError: null
                });
                
                // Log progress for every 10 users
                if (successCount % 10 === 0) {
                    logger.info(`Notification broadcast progress: ${successCount}/${userCount} users processed`);
                }
                
            } catch (error) {
                errorCount++;
                const errorMessage = error instanceof Error ? error.message : String(error);
                errorUsers.push({ id: user.telegramId, error: errorMessage });
                
                // Update error information in user record
                await User.findByIdAndUpdate(user._id, {
                    lastNotificationError: errorMessage,
                    lastNotificationAttempt: new Date()
                }).catch(err => {
                    logger.error(`Failed to update error status for user ${user.telegramId}:`, err);
                });
                
                logger.error(`Error sending notification to user ${user.telegramId}:`, error);
            }
            
            // Small delay between notifications to prevent rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Send summary to admin
        let summary = `✅ *Notification Broadcast Complete*\n\n`;
        summary += `Total Users: ${userCount}\n`;
        summary += `Successful Notifications: ${successCount}\n`;
        summary += `Failed Notifications: ${errorCount}\n\n`;
        
        if (errorCount > 0) {
            summary += `*Error Details* (showing first ${Math.min(5, errorCount)}):\n`;
            errorUsers.slice(0, 5).forEach(user => {
                summary += `- User ${user.id}: ${user.error.substring(0, 50)}${user.error.length > 50 ? '...' : ''}\n`;
            });
        }
        
        await ctx.reply(summary, { parse_mode: 'Markdown' });
        
    } catch (error) {
        logger.error('Error in notify_all command:', error);
        await ctx.reply("❌ Error during notification broadcast. Please check logs for details.");
    }
});

/**
 * Handles the /menu command to display the main menu
 */
export const handleMenuCommand = withCommandLogging('menu', async (ctx: JournalBotContext) => {
    if (!ctx.from) return;

    const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
    
    await showMainMenu(ctx, user);
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
