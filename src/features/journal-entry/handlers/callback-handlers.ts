import { Bot } from 'grammy';
import { JournalBotContext } from '../../../types/session';
import { IUser } from '../../../types/models';
import { logger } from '../../../utils/logger';
import { journalActionKeyboard } from '../keyboards/index';
import { handleCallback } from './button-handlers';
import { showMainMenu } from '../../core/handlers';
import { 
    analyzeAndSuggestQuestionsHandler, 
    finishJournalEntryHandler, 
    handleGoDeeper 
} from '../handlers';

export type CallbackHandler = (ctx: JournalBotContext, user: IUser) => Promise<void>;

const callbackHandlers: Record<string, CallbackHandler> = {
    'analyze_journal': analyzeAndSuggestQuestionsHandler,
    'go_deeper': handleGoDeeper,
    'finish_journal': finishJournalEntryHandler,
    'confirm_cancel_entry': async (ctx, user) => {
        logger.info(`User ${user.telegramId} confirmed cancellation of journal entry ${ctx.session.journalEntryId}`);
        ctx.session.journalEntryId = undefined;
        await ctx.reply(`Entry discarded. We can start fresh anytime ✨`, { parse_mode: 'HTML' });
        await showMainMenu(ctx, user);
    },
    'keep_writing': async (ctx, user) => {
        logger.info(`User ${user.telegramId} chose to continue journal entry ${ctx.session.journalEntryId}`);
        await ctx.reply(`Great! Let's continue where we left off...`, {
            parse_mode: 'HTML',
            reply_markup: journalActionKeyboard
        });
    }
};

export function registerCallbackHandlers(bot: Bot<JournalBotContext>): void {
    // Register each callback handler
    Object.entries(callbackHandlers).forEach(([action, handler]) => {
        bot.callbackQuery(action, async (ctx: JournalBotContext) => {
            await handleCallback(ctx, handler);
        });
    });
} 