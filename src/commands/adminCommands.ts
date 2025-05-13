import { Bot } from 'grammy';
import { JournalBotContext, JournalBotSession } from '../types/session';
import { User, findOrCreateUser, getAllUsers } from '../database';
import { logger } from '../utils/logger';
import { ADMIN_IDS } from '../config';

// The declare module for awaitingBroadcastMessage will be removed as the flag is no longer needed.

const ADMIN_COMMAND_LOGGER_TAG = 'AdminCommands';

export function registerAdminCommands(bot: Bot<JournalBotContext>) {
    // Command: /notifyusers <message_to_broadcast>
    bot.command('notifyusers', async (ctx) => {
        if (!ctx.from || !ADMIN_IDS.includes(ctx.from.id)) {
            logger.warn(`Non-admin user ${ctx.from?.id} attempted to use /notifyusers.`, { tag: ADMIN_COMMAND_LOGGER_TAG });
            return ctx.reply('Sorry, this command is for admins only.');
        }

        const messageToBroadcast = ctx.match.trim();

        if (!messageToBroadcast) {
            logger.info(`Admin ${ctx.from.id} used /notifyusers without a message.`, { tag: ADMIN_COMMAND_LOGGER_TAG });
            return ctx.reply('Please provide a message to broadcast after the command. Usage: /notifyusers Your message here');
        }

        logger.info(`Admin ${ctx.from.id} initiated broadcast with message: "${messageToBroadcast.substring(0, 50)}..."`, { tag: ADMIN_COMMAND_LOGGER_TAG });
        await ctx.reply(`Preparing to broadcast your message: "${messageToBroadcast.substring(0,100)}..."`);

        try {
            const allUsers = await getAllUsers();
            if (!allUsers || allUsers.length === 0) {
                logger.warn('/notifyusers: No users found to broadcast to.', { tag: ADMIN_COMMAND_LOGGER_TAG });
                return ctx.reply('No users found to send the message to.');
            }

            let successCount = 0;
            let errorCount = 0;

            for (const user of allUsers) {
                try {
                    await bot.api.sendMessage(user.telegramId, messageToBroadcast);
                    successCount++;
                    if (successCount % 20 === 0) {
                        logger.info(`Broadcast progress: ${successCount}/${allUsers.length} users.`, { tag: ADMIN_COMMAND_LOGGER_TAG });
                        await new Promise(resolve => setTimeout(resolve, 500)); 
                    }
                } catch (e: any) {
                    errorCount++;
                    logger.error(`Failed to send broadcast to user ${user.telegramId}: ${e.message}`, { tag: ADMIN_COMMAND_LOGGER_TAG, error: e });
                }
            }
            const summary = `Broadcast complete. Sent to ${successCount} users. Failed for ${errorCount} users.`;
            logger.info(summary, { tag: ADMIN_COMMAND_LOGGER_TAG });
            await ctx.reply(summary);

        } catch (error: any) {
            logger.error(`Error during /notifyusers broadcast logic: ${error.message}`, { tag: ADMIN_COMMAND_LOGGER_TAG, error });
            await ctx.reply('An unexpected error occurred while broadcasting. Please check the logs.');
        }
    });

    // The general message handler for ctx.session.awaitingBroadcastMessage is no longer needed here.
} 