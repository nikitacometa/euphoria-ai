import { Types } from 'mongoose';
import { InlineKeyboard } from 'grammy';
import { JournalBotContext } from '../../types/session';
import { IUser, IMessage, MessageType } from '../../types/models';
import { getUserJournalEntries, getJournalEntryById } from '../../database';
import { showMainMenu } from '../core/handlers';
import { createJournalHistoryKeyboard, createViewEntryKeyboard } from './keyboards';
import { logger } from '../../utils/logger';

// Helper to get user ID string (consider moving to core/utils later)
function getUserIdString(user: IUser | Types.ObjectId): string {
    if (user instanceof Types.ObjectId) {
        return user.toString();
    } else if (user && user._id) {
        return user._id.toString();
    } else {
        logger.error("Could not determine user ID string from:", user);
        throw new Error("Invalid user object provided");
    }
}

/**
 * Handles the "📚 Journal History" button press.
 * Fetches entries and displays them using an inline keyboard.
 */
export async function showJournalHistoryHandler(ctx: JournalBotContext, user: IUser) {
    const entries = await getUserJournalEntries(user._id as Types.ObjectId);

    if (entries.length === 0) {
        await ctx.reply(`<b>${user.name || user.firstName}</b>, you haven't created any entries yet. Ready to start? ✨`, {
            parse_mode: 'HTML'
        });
        // Optionally show main menu keyboard if no entries?
        // await showMainMenu(ctx, user);
        return;
    }

    const keyboard = createJournalHistoryKeyboard(entries);
    await ctx.reply(`Alright, ${user.name || user.firstName}, those are your recent entries 📚`, {
        reply_markup: keyboard,
        parse_mode: 'HTML'
    });
}

/**
 * Handles the `view_entry:[id]` callback query.
 * Displays the content of a specific journal entry.
 */
export async function viewJournalEntryHandler(ctx: JournalBotContext, user: IUser, entryIdStr: string) {
     try {
            const entryId = new Types.ObjectId(entryIdStr);
            // Ensure messages are populated when fetching
            const entry = await getJournalEntryById(entryId);
            if (!entry) {
                await ctx.answerCallbackQuery({ text: "Error: Entry not found" });
                // Maybe edit the original message?
                await ctx.editMessageText("Sorry, that entry could not be found.").catch(e => logger.warn("Failed to edit message on entry not found", e));
                return;
            }

            // Verify ownership
            const entryUserId = getUserIdString(entry.user);
            const currentUserId = getUserIdString(user);
            if (entryUserId !== currentUserId) {
                await ctx.answerCallbackQuery({ text: "Error: Access denied" });
                logger.warn(`User ${user.telegramId} tried to access entry ${entryIdStr} belonging to ${entryUserId}`);
                await ctx.editMessageText("Access Denied.").catch(e => logger.warn("Failed to edit message on access denied", e));
                return;
            }

            await ctx.answerCallbackQuery(); // Acknowledge the button press
            
            const date = new Date(entry.createdAt);
            const formattedDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;

            let entryText = entry.fullText || "";
            if (!entryText) {
                 // Fallback if fullText wasn't generated (shouldn't happen for completed entries ideally)
                 if (Array.isArray(entry.messages) && typeof entry.messages[0] !== 'string') {
                     entryText = (entry.messages as IMessage[])
                         .map(msg => msg.text || msg.transcription || `[${msg.type}]`)
                         .join('\n---\n');
                 } else {
                     entryText = "[Entry content not available]";
                 }
            }

            // Truncate if too long for a single message
            const MAX_MSG_LENGTH = 4000; // Leave room for formatting and labels
            const analysisText = entry.analysis ? `\n\n<b>Analysis:</b>\n${entry.analysis}` : '';
            const insightsText = entry.aiInsights ? `\n\n<b>Insights:</b>\n${entry.aiInsights}` : '';
            const header = `<b>Reflection from ${formattedDate}</b> 📚\n\n`;
            const footer = `${analysisText}${insightsText}`;
            
            const availableLength = MAX_MSG_LENGTH - header.length - footer.length;
            if (entryText.length > availableLength) {
                entryText = entryText.substring(0, availableLength) + "... [truncated]";
            }

            const keyboard = createViewEntryKeyboard(entryIdStr);

            // Edit the existing message (the history list)
            await ctx.editMessageText(
                `${header}${entryText}${footer}`,
                {
                    reply_markup: keyboard,
                    parse_mode: 'HTML'
                }
            );
        } catch (error: any) {
            logger.error(`Error fetching/displaying entry ${entryIdStr}:`, error);
             if (error.name === 'CastError' && error.kind === 'ObjectId') {
                 await ctx.answerCallbackQuery({ text: "Error: Invalid entry format." });
                 await ctx.editMessageText("Invalid entry format.").catch(e => logger.warn("Failed to edit message on cast error", e));
            } else {
                await ctx.answerCallbackQuery({ text: "Error displaying entry." });
                await ctx.editMessageText("Error displaying entry.").catch(e => logger.warn("Failed to edit message on display error", e));
            }
        }
}

/**
 * Handles the `journal_history` callback query (e.g., from back button).
 * Edits the current message to show the history list again.
 */
export async function showJournalHistoryCallbackHandler(ctx: JournalBotContext, user: IUser) {
    await ctx.answerCallbackQuery();
    const entries = await getUserJournalEntries(user._id as Types.ObjectId);
    
    if (entries.length === 0) {
        await ctx.editMessageText(`<b>${user.name || user.firstName}</b>, you haven't created any entries yet. Ready to start? ✨`, {
            parse_mode: 'HTML',
            // Provide a way back if message was edited
            reply_markup: new InlineKeyboard().text("↩️ Back to Main Menu", "main_menu") 
        });
        return;
    }

    const keyboard = createJournalHistoryKeyboard(entries);
    await ctx.editMessageText(`Alright, ${user.name || user.firstName}, those are your recent entries  📚`, {
        reply_markup: keyboard,
        parse_mode: 'HTML'
    });
}
