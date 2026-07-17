import { NextFunction } from 'grammy';
import { findOrCreateUser } from '../../database';
import { JournalBotContext } from '../context';

/**
 * Resolves the database user once per update and exposes it as `ctx.user`,
 * so route handlers never talk to the users collection directly.
 * Updates without a sender (e.g. channel posts) are ignored.
 */
export async function attachUser(ctx: JournalBotContext, next: NextFunction): Promise<void> {
    if (!ctx.from) {
        return;
    }

    // A journal is personal: sessions and entries must never be shared through
    // a group chat, so non-private chats are ignored entirely.
    if (ctx.chat && ctx.chat.type !== 'private') {
        return;
    }

    ctx.user = await findOrCreateUser(
        ctx.from.id,
        ctx.from.first_name,
        ctx.from.last_name,
        ctx.from.username
    );

    await next();
}
