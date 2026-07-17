import { Bot, InlineKeyboard } from 'grammy';
import { Types } from 'mongoose';
import { getJournalEntryById, getUserJournalEntries, IJournalEntry, IMessage, MessageType } from '../../database';
import { getTextForUser } from '../../utils/localization';
import { createLogger } from '../../utils/logger';
import { LOG_LEVEL } from '../../config';
import { JournalBotContext } from '../context';
import { showMainMenu } from '../helpers';

const historyLogger = createLogger('JournalHistory', LOG_LEVEL);

const HISTORY_PAGE_SIZE = 10;

export function registerJournalHistoryRoutes(bot: Bot<JournalBotContext>): void {
    bot.callbackQuery('main_menu', async ctx => {
        await ctx.answerCallbackQuery();
        ctx.session.mode = { kind: 'idle' };
        await showMainMenu(ctx, ctx.user);
    });

    bot.callbackQuery('view_history', async ctx => {
        await ctx.answerCallbackQuery();
        await showJournalHistory(ctx);
    });

    bot.callbackQuery(/^view_entry:(.+)$/, async ctx => {
        await ctx.answerCallbackQuery();
        await showJournalEntry(ctx, ctx.match[1]);
    });
}

/** Lists the user's most recent completed entries as inline buttons. */
export async function showJournalHistory(ctx: JournalBotContext): Promise<void> {
    const entries = await getUserJournalEntries(ctx.user._id as unknown as Types.ObjectId);

    if (entries.length === 0) {
        await ctx.reply(getTextForUser('noEntries', ctx.user), { parse_mode: 'HTML' });
        await showMainMenu(ctx, ctx.user);
        return;
    }

    const keyboard = new InlineKeyboard();
    entries.slice(0, HISTORY_PAGE_SIZE).forEach(entry => {
        keyboard.text(`${formatEntryDate(entry.createdAt)} ${entrySnippet(entry)}`, `view_entry:${entry._id}`).row();
    });
    keyboard.text('Back to Main Menu', 'main_menu');

    await ctx.reply(getTextForUser('journalHistory', ctx.user), {
        reply_markup: keyboard,
        parse_mode: 'HTML'
    });
}

async function showJournalEntry(ctx: JournalBotContext, entryId: string): Promise<void> {
    try {
        const entry = await getJournalEntryById(new Types.ObjectId(entryId));
        // Ownership check: callback data arrives from the client and can be forged.
        if (!entry || !isOwnedBy(entry, ctx.user._id)) {
            await ctx.reply('Entry not found.');
            return;
        }

        const messages = entry.messages as IMessage[];
        const entryContent = messages
            .map(message => {
                if (message.type === MessageType.TEXT) {
                    return message.text || '';
                }
                if (message.type === MessageType.VOICE) {
                    return getTextForUser('voiceTranscription', ctx.user, {
                        transcription: message.transcription || 'No transcription available'
                    });
                }
                if (message.type === MessageType.VIDEO) {
                    return getTextForUser('videoTranscription', ctx.user, {
                        transcription: message.transcription || 'No transcription available'
                    });
                }
                return '';
            })
            .filter(content => content.length > 0)
            .join('\n\n');

        const createdAt = new Date(entry.createdAt);
        const keyboard = new InlineKeyboard()
            .text('Back to Journal History', 'view_history')
            .row()
            .text('Back to Main Menu', 'main_menu');

        await ctx.reply(
            getTextForUser('journalEntry', ctx.user, {
                date: createdAt.toLocaleDateString(),
                time: createdAt.toLocaleTimeString(),
                content: entryContent,
                analysis: entry.analysis || 'No analysis available'
            }),
            { reply_markup: keyboard, parse_mode: 'HTML' }
        );
    } catch (error) {
        historyLogger.error('Error viewing entry:', error);
        await ctx.reply('Sorry, I encountered an error while retrieving your journal entry.');
    }
}

function isOwnedBy(entry: IJournalEntry, userId: unknown): boolean {
    const owner = entry.user;
    const ownerId = typeof owner === 'object' && owner !== null && '_id' in owner ? owner._id : owner;
    return String(ownerId) === String(userId);
}

/** Formats an entry timestamp as [DD/MM/YY HH:MM]. */
function formatEntryDate(createdAt: Date): string {
    const date = new Date(createdAt);
    const pad = (value: number) => value.toString().padStart(2, '0');
    return `[${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear().toString().slice(-2)} ${pad(date.getHours())}:${pad(date.getMinutes())}]`;
}

function entrySnippet(entry: IJournalEntry): string {
    const source =
        entry.fullText ||
        (entry.messages as IMessage[]).find(msg => msg.type === MessageType.TEXT && msg.text)?.text ||
        '';
    if (!source) {
        return 'Entry';
    }
    return source.substring(0, 15) + (source.length > 15 ? '...' : '');
}
