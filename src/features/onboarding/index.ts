import { Bot } from 'grammy';
import { JournalBotContext } from '../../types/session';
import { handleOnboarding } from './handlers';
import { findOrCreateUser } from '../../database'; // Need user lookup

export function registerOnboardingHandlers(bot: Bot<JournalBotContext>) {
    // Handle messages only when the user is in an onboarding step
    bot.on('message', async (ctx, next) => {
        // Check if onboardingStep is set in the session
        if (ctx.session?.onboardingStep) {
            // User is onboarding, find/create user and call the handler
            if (!ctx.from) return; // Should exist if message received
            const user = await findOrCreateUser(
                ctx.from.id,
                ctx.from.first_name,
                ctx.from.last_name,
                ctx.from.username
            );
            // Pass user object to the handler
            await handleOnboarding(ctx, user);
        } else {
            // User is not onboarding, pass control to the next middleware/handler
            await next();
        }
    });

    // Note: The initiation of onboarding (setting session.onboardingStep = 'name')
    // will be handled by the modified /start command handler later in journal-bot.ts
    // or moved to a core feature handler.
}
