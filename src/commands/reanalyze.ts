import { Types } from 'mongoose';
import { JournalBotContext } from '../types/session';
import { IUser, IJournalEntry, JournalEntryStatus } from '../types/models';
import { 
    getUserById, 
    getAllUsers,
} from '../database'; 
import { getUserJournalEntries, JournalEntry } from '../database/models/journal.model';
import { performFullEntryAnalysis, updateEntryWithAnalysis, FullAnalysisResult } from '../services/ai/journal-ai.service';
import { errorService } from '../services/error.service';
import { logger } from '../utils/logger';
import { AIError } from '../types/errors';
import { REANALYSIS_BATCH_SIZE, REANALYSIS_PROGRESS_INTERVAL } from '../config';

const BATCH_SIZE = REANALYSIS_BATCH_SIZE || 5;
const PROGRESS_INTERVAL = REANALYSIS_PROGRESS_INTERVAL || 10;

/**
 * Helper to process a single entry for re-analysis.
 */
async function processEntryForReanalysis(entry: IJournalEntry, user: IUser): Promise<boolean> {
    try {
        const entryIdStr = (entry._id as Types.ObjectId)?.toString() || entry._id?.toString() || 'unknown_id_in_process_entry';
        const analysisResult: FullAnalysisResult = await performFullEntryAnalysis(entry, user);
        const updated = await updateEntryWithAnalysis(entry._id as Types.ObjectId, analysisResult);
        if (!updated) {
            logger.error(`Failed to update entry ${entryIdStr} after re-analysis for user ${user.telegramId}`);
            return false;
        }
        return true;
    } catch (error) {
        const entryIdStr = (entry._id as Types.ObjectId)?.toString() || entry._id?.toString() || 'unknown_id_in_process_entry_catch';
        logger.error(`Error re-analyzing entry ${entryIdStr} for user ${user.telegramId}:`, error);
        errorService.logError(
            error instanceof AIError ? error : new AIError('Error during single entry re-analysis', { entryId: entryIdStr, userId: user.telegramId.toString()}, error instanceof Error ? error : undefined),
            {},
            'error'
        );
        return false;
    }
}

/**
 * Command: /reanalyzeme
 * Re-analyzes all completed journal entries for the current user.
 */
export async function reanalyzeMeCommand(ctx: JournalBotContext): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId) {
        await ctx.reply("Could not identify user.");
        return;
    }

    try {
        await ctx.reply("🤖 Starting re-analysis of your journal entries... This might take a while.");
        const user = await getUserById(userId);
        if (!user) {
            await ctx.reply("User not found in database.");
            return;
        }

        const entries: IJournalEntry[] = await getUserJournalEntries(user._id as Types.ObjectId);
        if (!entries || entries.length === 0) {
            await ctx.reply("No completed journal entries found for you to re-analyze.");
            return;
        }

        await ctx.reply(`Found ${entries.length} entries. Beginning re-analysis process...`);

        let processedCount = 0;
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < entries.length; i += BATCH_SIZE) {
            const batch = entries.slice(i, i + BATCH_SIZE);
            const batchResults = await Promise.allSettled(
                batch.map((entry: IJournalEntry) => processEntryForReanalysis(entry, user))
            );

            batchResults.forEach(result => {
                processedCount++;
                if (result.status === 'fulfilled' && result.value) {
                    successCount++;
                } else {
                    errorCount++;
                }
            });

            if (processedCount % PROGRESS_INTERVAL === 0 || processedCount === entries.length) {
                await ctx.reply(
                    `📊 Progress: ${processedCount}/${entries.length} entries processed.\n` +
                    `✅ ${successCount} successful, ❌ ${errorCount} failed.`
                );
            }
        }

        await ctx.reply(
            `🏁 Re-analysis for your entries complete!\n` +
            `Total Processed: ${entries.length}\n` +
            `✅ Success: ${successCount}\n` +
            `❌ Failed: ${errorCount}`
        );

    } catch (error) {
        logger.error('Error in /reanalyzeme command:', error);
        errorService.logError(error instanceof Error ? error : new Error(String(error)), { command: 'reanalyzeme' });
        await ctx.reply("An unexpected error occurred while re-analyzing your entries. Please try again later.");
    }
}

/**
 * Command: /reanalyzeall (Admin Only)
 * Initiates re-analysis for all entries of all users.
 */
export async function reanalyzeAllCommand(ctx: JournalBotContext): Promise<void> {
    try {
        await ctx.reply("☢️ WARNING: This command will re-analyze ALL journal entries for ALL users. This is a very resource-intensive operation and may take a long time.");
        await ctx.reply("Are you absolutely sure you want to proceed? Reply with 'YESIDOITYES' to confirm.");
        if (ctx.session) {
            ctx.session.adminReanalyzeAllConfirmation = true;
        }
    } catch (error) {
        logger.error('Error in /reanalyzeall command setup:', error);
        await ctx.reply("An error occurred preparing the re-analyze all command.");
    }
}

/**
 * Handles the confirmation message for /reanalyzeall command.
 */
export async function handleReanalyzeAllConfirmation(ctx: JournalBotContext): Promise<void> {
    if (!ctx.session?.adminReanalyzeAllConfirmation || !ctx.message || !('text' in ctx.message)) {
        // Not waiting for this, or not a text message, so ignore or pass to other handlers.
        return;
    }

    const confirmationText = ctx.message.text;
    ctx.session.adminReanalyzeAllConfirmation = false;

    if (confirmationText !== 'YESIDOITYES') {
        await ctx.reply("Re-analysis of all entries cancelled. Confirmation phrase not matched.");
        return;
    }

    await ctx.reply("🤖 Confirmation received. Starting re-analysis of ALL entries for ALL users... This will take a significant amount of time. Progress updates will be minimal to avoid spam.");
    logger.info("Starting /reanalyzeall process...");

    try {
        const allUsers: IUser[] = await getAllUsers();
        if (!allUsers || allUsers.length === 0) {
            await ctx.reply("No users found in the database.");
            return;
        }

        let totalEntriesProcessed = 0;
        let totalSuccessCount = 0;
        let totalErrorCount = 0;

        for (const user of allUsers) {
            logger.info(`Processing entries for user ${user.telegramId} (${user.firstName || 'N/A'})`);
            const entries: IJournalEntry[] = await getUserJournalEntries(user._id as Types.ObjectId);
            if (!entries || entries.length === 0) {
                logger.info(`No entries for user ${user.telegramId}. Skipping.`);
                continue;
            }

            logger.info(`Found ${entries.length} entries for user ${user.telegramId}. Starting batch processing.`);

            for (let i = 0; i < entries.length; i += BATCH_SIZE) {
                const batch = entries.slice(i, i + BATCH_SIZE);
                const batchResults = await Promise.allSettled(
                    batch.map((entry: IJournalEntry) => processEntryForReanalysis(entry, user))
                );

                batchResults.forEach(result => {
                    totalEntriesProcessed++;
                    if (result.status === 'fulfilled' && result.value) {
                        totalSuccessCount++;
                    } else {
                        totalErrorCount++;
                    }
                });
                logger.info(`Batch complete for user ${user.telegramId}. Processed ${totalEntriesProcessed} total entries so far.`);
            }
             // Optional: Send a per-user completion, but might be too spammy for many users.
            // await ctx.reply(`Finished processing ${entries.length} entries for user ${user.telegramId}.`);
        }
        
        const finalReport = `🏁🏁🏁 Global Re-analysis Complete! 🏁🏁🏁\n` +
                            `Total Users Processed: ${allUsers.length}\n` +
                            `Total Entries Processed: ${totalEntriesProcessed}\n` +
                            `✅ Total Successes: ${totalSuccessCount}\n` +
                            `❌ Total Failures: ${totalErrorCount}`;
        logger.info(finalReport);
        await ctx.reply(finalReport);

    } catch (error) {
        logger.error('Critical error during /reanalyzeall execution:', error);
        errorService.logError(error instanceof Error ? error : new Error(String(error)), { command: 'reanalyzeall_execution' });
        await ctx.reply("A critical error occurred during the global re-analysis. Please check logs.");
    }
} 