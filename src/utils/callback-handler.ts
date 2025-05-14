import { JournalBotContext } from '../types/session';
import { IUser } from '../types/models';
import { logger } from './logger';
import { requireUser } from '../middlewares/user-context';
import { removeInlineKeyboard } from './inline-keyboard';

/**
 * Creates a callback query handler with common patterns:
 * - Answers the callback query
 * - Gets the user from context
 * - Optionally removes the inline keyboard
 * - Handles errors
 * 
 * @param handler The handler function to wrap
 * @param options Options for the handler
 * @returns A wrapped handler function
 */
export function createCallbackHandler(
  handler: (ctx: JournalBotContext, user: IUser) => Promise<void>,
  options: {
    removeKeyboard?: boolean;
    loggerName?: string;
  } = {}
) {
  const { 
    removeKeyboard = true,
    loggerName = 'CallbackHandler'
  } = options;

  return async (ctx: JournalBotContext) => {
    try {
      // Answer the callback query first
      await ctx.answerCallbackQuery().catch(e => {
        logger.warn(`${loggerName}: Failed to answer callback query`, e);
      });

      // Get the user from context
      const user = requireUser(ctx);

      // Remove the keyboard if requested
      if (removeKeyboard) {
        await removeInlineKeyboard(ctx).catch(e => {
          logger.warn(`${loggerName}: Failed to remove inline keyboard`, e);
        });
      }

      // Call the handler
      await handler(ctx, user);
    } catch (error) {
      logger.error(`${loggerName}: Error handling callback query`, error);
      
      // Try to notify the user of the error
      try {
        await ctx.reply('Sorry, something went wrong while processing your request. Please try again.');
      } catch (replyError) {
        logger.error(`${loggerName}: Failed to send error message`, replyError);
      }
    }
  };
}
