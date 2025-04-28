import { JournalBotContext } from '../../types/session';
import { IUser } from '../../types/models';
import { MAIN_MENU_KEYBOARD } from './keyboards';

/**
 * Displays the main menu keyboard to the user.
 */
export async function showMainMenu(ctx: JournalBotContext, user: IUser) {
    // Consider adding a check if the keyboard is already shown?
    await ctx.reply(`Welcome back, ${user.name || user.firstName}! Ready to explore your thoughts? ✨`, {
        reply_markup: MAIN_MENU_KEYBOARD,
        parse_mode: 'HTML'
    });
}
