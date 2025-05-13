import { JournalBotContext } from '../types/session';
import { ADMIN_IDS } from '../config'; // Corrected to ADMIN_IDS
import { logger } from '../utils/logger';

/**
 * Middleware to check if the user is an admin.
 * Allows the command to proceed if the user is an admin, otherwise replies with an error.
 */
export async function isAdmin(ctx: JournalBotContext, next: () => Promise<void>): Promise<void> {
    const userId = ctx.from?.id;

    if (userId && ADMIN_IDS.includes(userId)) { // Corrected to ADMIN_IDS and direct number comparison
        await next(); // User is admin, proceed to the command handler
    } else {
        logger.warn(`Non-admin user ${userId || 'unknown'} attempted to use an admin command: ${ctx.message?.text}`);
        await ctx.reply('Sorry, this command is for authorized administrators only. Your attempt has been logged. Just kidding... or am I? 👀');
        // Do not call next(), so the command handler is not executed
    }
} 