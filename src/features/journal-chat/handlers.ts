import { Types } from 'mongoose';
import { IUser, IJournalEntry } from '../../types/models';
import { logger } from '../../utils/logger';
import { getUserJournalEntries } from '../../database';
import { showMainMenu } from '../core/handlers';
import { exitChatKeyboard } from './keyboards';
import { generateJournalInsights } from '../../services/ai/journal-ai.service';
import { transcribeAudio } from '../../services/ai/openai.service';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { TELEGRAM_API_TOKEN } from '../../config';
import { Bot } from "grammy";
import { JournalBotContext } from "../../types/session";
import { findOrCreateUser } from '../../database';

/**
 * Initiates the journal chat mode.
 */
export async function startJournalChatHandler(ctx: JournalBotContext, user: IUser) {
    if (!user) return;

    const entries = await getUserJournalEntries(user._id as Types.ObjectId);
    
    if (entries.length === 0) {
        await ctx.reply(`<b>${user.name || user.firstName}</b>, let's create some entries first before we analyze them ✨`, {
            parse_mode: 'HTML'
        });
        await showMainMenu(ctx, user);
        return;
    }
    
    // Enter journal chat mode
    ctx.session.journalChatMode = true;
    ctx.session.waitingForJournalQuestion = true;
    
    await ctx.reply(`Hey, ${user.name || user.firstName}! Ask your journal anything! 🌟\n\n<i>• Any patterns in thoughts\n• Mood analysis\n• Important events\n• Hidden motivations\n• Goals</i>\n\nOf course, you can use voice/videos to ask things.`, {
        reply_markup: exitChatKeyboard,
        parse_mode: 'HTML'
    });
}

/**
 * Handles incoming messages (text, voice) during journal chat mode.
 */
export async function handleJournalChatInput(ctx: JournalBotContext, user: IUser) {
    if (!ctx.session.journalChatMode || !ctx.message) return;

    let questionText: string | null = null;
    let waitMsgId: number | null = null;
    let localFilePath: string | null = null;

    try {
        // --- Handle Voice Message ---
        if (ctx.message.voice) {
            const waitMsg = await ctx.reply("⏳", { reply_markup: exitChatKeyboard });
            waitMsgId = waitMsg.message_id;

            const fileId = ctx.message.voice.file_id;
            const file = await ctx.api.getFile(fileId);
            const filePath = file.file_path;
            if (!filePath) throw new Error('Voice file path not found');

            localFilePath = await downloadTelegramFile(filePath, 'voice');
            questionText = await transcribeAudio(localFilePath);

            if (ctx.chat && waitMsgId) {
                await ctx.api.editMessageText(ctx.chat.id, waitMsgId, `⏳`, { reply_markup: exitChatKeyboard });
            }

        // --- Handle Text Message ---
        } else if (ctx.message.text) {
            questionText = ctx.message.text;
            const waitMsg = await ctx.reply(`⏳`, { reply_markup: exitChatKeyboard });
            waitMsgId = waitMsg.message_id;

        } else {
            await ctx.reply("I can currently only process text or voice questions in chat mode.", { reply_markup: exitChatKeyboard });
            return;
        }

        // --- Common Logic: Fetch entries and call AI ---
        if (questionText) {
            const entries = await getUserJournalEntries(user._id as Types.ObjectId);
            if (entries.length === 0) {
                 if (waitMsgId && ctx.chat) {
                     await ctx.api.deleteMessage(ctx.chat.id, waitMsgId).catch(e => logger.warn("Failed to delete wait msg", e));
                 }
                await ctx.reply("You don't seem to have any journal entries yet to analyze.", { reply_markup: exitChatKeyboard });
                return;
            }

            // Fix parameter order to match the service implementation
            const insights = await generateJournalInsights(entries, user, questionText);

            if (waitMsgId && ctx.chat) {
                await ctx.api.deleteMessage(ctx.chat.id, waitMsgId).catch(e => logger.warn("Failed to delete wait msg", e));
            }
            await ctx.reply(insights || "I couldn't find any specific insights for that question.", { reply_markup: exitChatKeyboard, parse_mode: 'HTML' });
        }

    } catch (error) {
        logger.error('Error handling journal chat input:', error);
        if (waitMsgId && ctx.chat) {
             await ctx.api.deleteMessage(ctx.chat.id, waitMsgId).catch(e => logger.warn("Failed to delete wait msg after error", e));
        }
        await ctx.reply("😵‍💫 Oops! Something went wrong while processing your question. Please try again.", { reply_markup: exitChatKeyboard });
    } finally {
        // Clean up temp voice file
        if (localFilePath) {
            fs.unlink(localFilePath, (err) => {
                if (err) logger.warn(`Failed to delete temp audio file: ${localFilePath}`, err);
                else logger.debug(`Deleted temp audio file: ${localFilePath}`);
            });
        }
    }
}

/**
 * Handles the "❌ Exit Chat Mode" button press.
 */
export async function exitJournalChatHandler(ctx: JournalBotContext) {
    if (!ctx.from) return;
    const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);

    ctx.session.journalChatMode = false;
    ctx.session.waitingForJournalQuestion = false;
    
    if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery().catch(e => logger.warn("Failed to answer exit_chat_mode CBQ", e));
    }

    await ctx.reply("Returning to main menu. Chat mode disabled.", {
        reply_markup: { remove_keyboard: true }
    });
    
    await showMainMenu(ctx, user);
}

async function downloadTelegramFile(filePath: string, type: 'voice' | 'video'): Promise<string> {
    const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_API_TOKEN}/${filePath}`;
    const tempDir = path.join(os.tmpdir(), 'journal-chat-downloads');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    const extension = filePath.split('.').pop() || (type === 'voice' ? 'oga' : 'mp4');
    const localFilePath = path.join(tempDir, `${type}_${Date.now()}.${extension}`);
    
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error(`Failed to download file: ${response.statusText} (${response.status})`);
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(localFilePath, Buffer.from(buffer));
    logger.debug(`Downloaded ${type} file to ${localFilePath}`);
    return localFilePath;
}

export const registerJournalChatHandlers = (bot: Bot<JournalBotContext>) => {
    bot.callbackQuery("exit_chat_mode", async (ctx) => {
        await exitJournalChatHandler(ctx);
    });
    
    bot.command("journal_chat", async (ctx) => {
        if (!ctx.from) return;
        const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
        await startJournalChatHandler(ctx, user);
    });

    bot.on("message", async (ctx, next) => {
        if (ctx.session?.journalChatMode) {
            if (ctx.message?.text?.startsWith('/')) {
                await ctx.reply("Please exit chat mode first to use commands.", { reply_markup: exitChatKeyboard });
                return;
            }
            if (!ctx.from) return;
            const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
            await handleJournalChatInput(ctx, user);
        } else {
            await next();
        }
    });
};
