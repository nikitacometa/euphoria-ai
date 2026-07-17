import { Bot } from 'grammy';
import { JournalBotContext } from '../context';
import { buttonFilter } from '../helpers';
import { enterJournalEntry } from './journal-entry';
import { showJournalHistory } from './journal-history';
import { enterChatMode, handleAnalyzeToday } from './journal-chat';
import { enterSettings } from './settings';

/** Wires the main-menu buttons to their feature handlers. */
export function registerMenuRoutes(bot: Bot<JournalBotContext>): void {
    bot.filter(buttonFilter('createNewEntry'), enterJournalEntry);
    bot.filter(buttonFilter('viewJournalHistory'), showJournalHistory);
    bot.filter(buttonFilter('chatAboutJournal'), enterChatMode);
    bot.filter(buttonFilter('analyzeToday'), handleAnalyzeToday);
    bot.filter(buttonFilter('settings'), enterSettings);
}
