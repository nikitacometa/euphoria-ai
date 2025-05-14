import { NextFunction } from 'grammy';
import { JournalBotContext } from '../types/session';
import { findOrCreateUser } from '../database';
import { logger } from '../utils/logger';
import { IUser } from '../types/models';

/**
 * Middleware that attaches the user to the context.
 * This reduces duplication across handlers by automatically finding or creating
 * the user and attaching it to the context.
 */
export function userContextMiddleware() {
  return async (ctx: JournalBotContext, next: NextFunction) => {
    // Skip if no user information is available
    if (!ctx.from) {
      logger.debug('No user information available in context, skipping user context middleware');
      return next();
    }

    try {
      // Find or create the user
      const user = await findOrCreateUser(
        ctx.from.id,
        ctx.from.first_name,
        ctx.from.last_name,
        ctx.from.username
      );

      // Attach the user to the context
      ctx.user = user;

      // Continue to the next middleware or handler
      await next();
    } catch (error) {
      logger.error('Error in user context middleware:', error);
      // Continue to the next middleware or handler even if there was an error
      // This allows error handling middleware to handle the error
      await next();
    }
  };
}

/**
 * Helper function to get the user from context.
 * This is a type-safe way to access the user that was attached by the middleware.
 * 
 * @param ctx The context object
 * @returns The user object or undefined if not available
 */
export function getUserFromContext(ctx: JournalBotContext): IUser | undefined {
  return (ctx as any).user;
}

/**
 * Helper function to require a user in the context.
 * This is useful for handlers that require a user to be present.
 * 
 * @param ctx The context object
 * @returns The user object
 * @throws Error if no user is available
 */
export function requireUser(ctx: JournalBotContext): IUser {
  const user = getUserFromContext(ctx);
  if (!user) {
    throw new Error('User is required but not available in context');
  }
  return user;
}
