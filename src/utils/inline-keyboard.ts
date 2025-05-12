/**
 * Utility functions for handling inline keyboards
 */
import { Context } from 'grammy';
import { logger } from './logger';

/**
 * Removes the inline keyboard from a message after a button has been pressed.
 * Keeps the original message text unchanged.
 * 
 * @param ctx The Grammy context
 * @returns Promise that resolves when the keyboard has been removed or when an error has been handled
 */
export async function removeInlineKeyboard(ctx: Context): Promise<void> {
  // Only proceed if the callback query has a message
  if (!ctx.callbackQuery?.message) {
    return;
  }

  try {
    // Remove the inline keyboard by setting it to an empty array
    await ctx.editMessageReplyMarkup({
      reply_markup: { inline_keyboard: [] },
    });
  } catch (error) {
    // Check if it's a message not found error, which means the message was already deleted
    if (
      error instanceof Error &&
      (error.message.includes('message to edit not found') ||
       error.message.includes('message is not modified'))
    ) {
      // Message was already deleted or not modified, this is fine
      logger.debug('Cannot remove keyboard: message was deleted or not modified');
    } else {
      // Log other errors but don't throw them to avoid interrupting the normal flow
      logger.warn('Failed to remove inline keyboard', error);
    }
  }
}

/**
 * Utility wrapper for callback handlers that automatically removes the inline keyboard
 * after the callback is processed.
 * 
 * @param handler The original callback handler function
 * @returns A wrapped handler that removes the keyboard after execution
 */
export function withKeyboardRemoval<T extends Context>(
  handler: (ctx: T) => Promise<void>
): (ctx: T) => Promise<void> {
  return async (ctx: T) => {
    try {
      // Execute the original handler first
      await handler(ctx);
    } finally {
      // Always try to remove the keyboard, even if the handler fails
      await removeInlineKeyboard(ctx);
    }
  };
} 