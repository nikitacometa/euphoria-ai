import { Bot } from 'grammy';
import { JournalBotContext } from '../context';
import { showMainMenu } from '../helpers';
import { handleOnboardingMessage, resumeOnboarding } from './onboarding';
import { handleJournalEntryMessage } from './journal-entry';
import { handleChatMessage } from './journal-chat';
import { handleSettingsMessage } from './settings';

/**
 * Fallback message router: dispatches free-form messages by session mode.
 * Must be registered after all button filters and commands.
 */
export function registerMessageRouter(bot: Bot<JournalBotContext>): void {
    bot.on('message', async ctx => {
        switch (ctx.session.mode.kind) {
            case 'onboarding':
                await handleOnboardingMessage(ctx);
                return;
            case 'journal_entry':
                await handleJournalEntryMessage(ctx);
                return;
            case 'journal_chat':
                await handleChatMessage(ctx);
                return;
            case 'settings':
                await handleSettingsMessage(ctx);
                return;
            case 'idle':
                // Sessions live in memory, so a restart drops users mid-onboarding
                // into 'idle'. The durable flag decides where they actually belong.
                if (!ctx.user.onboardingCompleted) {
                    await resumeOnboarding(ctx);
                    return;
                }
                await showMainMenu(ctx, ctx.user);
                return;
        }
    });
}
