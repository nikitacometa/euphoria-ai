import { JournalBotContext } from '../../../types/session';
import { IUser } from '../../../types/models';
import { findOrCreateUser } from '../../../database';
import { logger } from '../../../utils/logger';

/**
 * Helper to handle button presses with user context
 */
export async function handleButtonPress(
    ctx: JournalBotContext,
    handler: (ctx: JournalBotContext, user: IUser) => Promise<void>
): Promise<void> {
    if (!ctx.from) return;
    
    const user = await findOrCreateUser(
        ctx.from.id,
        ctx.from.first_name,
        ctx.from.last_name,
        ctx.from.username
    );
    
    await handler(ctx, user);
}

/**
 * Helper to handle callback queries with user context
 */
export async function handleCallback(
    ctx: JournalBotContext,
    handler: (ctx: JournalBotContext, user: IUser) => Promise<void>
): Promise<void> {
    if (!ctx.from) return;
    
    await ctx.answerCallbackQuery();
    
    const user = await findOrCreateUser(
        ctx.from.id,
        ctx.from.first_name,
        ctx.from.last_name,
        ctx.from.username
    );
    
    await handler(ctx, user);
} 