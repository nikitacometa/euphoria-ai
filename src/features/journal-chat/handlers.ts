import { Types } from 'mongoose';
import { IUser, IJournalEntry } from '../../types/models';
import { logger } from '../../utils/logger';
import { getUserJournalEntries } from '../../database';
import { showMainMenu } from '../core/handlers';
import { createChatInlineKeyboard, CHAT_CALLBACKS } from './keyboards';
import { generateJournalInsights } from '../../services/ai/journal-ai.service';
import { transcribeAudio } from '../../services/ai/openai.service';
import { sendTranscriptionReply } from '../journal-entry/utils';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { TELEGRAM_API_TOKEN, MAX_VOICE_MESSAGE_LENGTH_SECONDS } from '../../config';
import { Bot } from "grammy";
import { JournalBotContext } from "../../types/session";
import { findOrCreateUser } from '../../database';
import { MAIN_MENU_CALLBACKS } from '../core/keyboards';
import { removeInlineKeyboard } from '../../utils/inline-keyboard';

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
    
    await ctx.reply(`<b>Hey, let's have a deep talk! Ask me anything 🤌</b>\n\n• Recognize any patterns in your thoughts/actions\n• Analyze mood changes, correlations\n• Find any information just by meaning\n\n<i>🎤 Haha, ${user.name || user.firstName}! Of course use voices/videos.</i>`, {
        reply_markup: createChatInlineKeyboard(),
        parse_mode: 'HTML'
    });
}

/**
 * Formats the AI response text with HTML formatting.
 * Only uses HTML tags supported by Telegram API: <b>, <i>, <u>, <s>, <a>, <code>, <pre>.
 */
function formatResponseWithHTML(text: string): string {
    // Format paragraphs with line breaks instead of unsupported <p> tags
    let formatted = text.replace(/\n\n/g, '\n\n');
    
    // Add bold for important points
    formatted = formatted.replace(/(\*\*|__)(.*?)\1/g, '<b>$2</b>');
    
    // Add italic for emphasis
    formatted = formatted.replace(/(\*|_)(.*?)\1/g, '<i>$2</i>');
    formatted = formatted.replaceAll("<p>", '');
    formatted = formatted.replaceAll("</p>", '');
    
    
    // Add the follow-up question
    formatted += `\n\n🙏 <i>You got what you wanted? Ask to clarify, ask other stuff, ask me hard...</i>`;
    
    return formatted;
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
            // React with eyes first to indicate processing
            await ctx.react("👀").catch(e => logger.warn("Failed to react with eyes", e));
            
            const fileId = ctx.message.voice.file_id;
            
            // Check duration - use configuration constant
            if (ctx.message.voice.duration > MAX_VOICE_MESSAGE_LENGTH_SECONDS) {
                await ctx.reply(`Sorry, voice messages cannot be longer than ${MAX_VOICE_MESSAGE_LENGTH_SECONDS} seconds. Please try again with a shorter recording.`, {
                    reply_markup: createChatInlineKeyboard()
                });
                return;
            }
            
            const file = await ctx.api.getFile(fileId);
            const filePath = file.file_path;
            if (!filePath) throw new Error('Voice file path not found');

            localFilePath = await downloadTelegramFile(filePath, 'voice');
            questionText = await transcribeAudio(localFilePath);
            
            // Send transcription if user wants it
            await sendTranscriptionReply(ctx, ctx.message.message_id, questionText, user, createChatInlineKeyboard());

            // Simply replace the eyes reaction with thumbs up
            await ctx.react("👍").catch(e => logger.warn("Failed to add thumbs up reaction", e));

        // --- Handle Text Message ---
        } else if (ctx.message.text) {
            questionText = ctx.message.text;
            
            // React with thumbs up to acknowledge message received
            await ctx.react("👍").catch(e => logger.warn("Failed to react with thumbs up", e));
            
            const waitMsg = await ctx.reply(`⏳`, { reply_markup: createChatInlineKeyboard() });
            waitMsgId = waitMsg.message_id;

        } else {
            await ctx.reply("I can currently only process text or voice questions in chat mode.", { 
                reply_markup: createChatInlineKeyboard() 
            });
            return;
        }

        // --- Common Logic: Fetch entries and call AI ---
        if (questionText) {
            const entries = await getUserJournalEntries(user._id as Types.ObjectId);
            if (entries.length === 0) {
                 if (waitMsgId && ctx.chat) {
                     await ctx.api.deleteMessage(ctx.chat.id, waitMsgId).catch(e => logger.warn("Failed to delete wait msg", e));
                 }
                await ctx.reply("You don't seem to have any journal entries yet to analyze.", { 
                    reply_markup: createChatInlineKeyboard() 
                });
                return;
            }

            // Fix parameter order to match the service implementation
            const insights = await generateJournalInsights(entries, user, questionText);
            const formattedInsights = formatResponseWithHTML(insights || "I couldn't find any specific insights for that question.");

            if (waitMsgId && ctx.chat) {
                await ctx.api.deleteMessage(ctx.chat.id, waitMsgId).catch(e => logger.warn("Failed to delete wait msg", e));
            }
            await ctx.reply(formattedInsights, { 
                reply_markup: createChatInlineKeyboard(), 
                parse_mode: 'HTML' 
            });
        }

    } catch (error) {
        logger.error('Error handling journal chat input:', error);
        if (waitMsgId && ctx.chat) {
             await ctx.api.deleteMessage(ctx.chat.id, waitMsgId).catch(e => logger.warn("Failed to delete wait msg after error", e));
        }
        await ctx.reply("😵‍💫 Oops! Something went wrong while processing your question. Please try again.", { 
            reply_markup: createChatInlineKeyboard() 
        });
    } finally {
        // Clean up temp voice file
        if (localFilePath && fs.existsSync(localFilePath)) {
            try {
                fs.unlinkSync(localFilePath);
            } catch (err) {
                logger.warn(`Failed to delete temp audio file: ${localFilePath}`, err);
            }
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
    
    await ctx.reply('Exiting chat mode. Returning to main menu.');
    await showMainMenu(ctx, user);
}

/**
 * Downloads a file from Telegram's servers
 * @param filePath The path of the file on Telegram's servers
 * @param fileType The type of file (voice, video, etc.)
 * @returns Local path to the downloaded file
 */
async function downloadTelegramFile(filePath: string, fileType: string): Promise<string> {
    const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_API_TOKEN}/${filePath}`;
    const tempDir = path.join(os.tmpdir(), 'journal-bot-' + fileType);
    
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const localFilePath = path.join(tempDir, `${fileType}_${Date.now()}.${filePath.split('.').pop() || 'mp3'}`);
    
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error(`Failed to download file: ${response.statusText}`);
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(localFilePath, Buffer.from(buffer));
    
    return localFilePath;
}

export const registerJournalChatHandlers = (bot: Bot<JournalBotContext>) => {
    // Register callback query handler for exit chat mode button
    bot.callbackQuery(CHAT_CALLBACKS.EXIT_CHAT, async (ctx) => {
        await ctx.answerCallbackQuery();
        if (!ctx.from) return;
        
        try {
            await removeInlineKeyboard(ctx);
            
            const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
            
            ctx.session.journalChatMode = false;
            ctx.session.waitingForJournalQuestion = false;
            
            await ctx.reply('Exiting chat mode. Returning to main menu.');
            await showMainMenu(ctx, user);
        } catch (error) {
            logger.error('Error in EXIT_CHAT callback handler', error);
        }
    });
    
    bot.command("journal_chat", async (ctx) => {
        if (!ctx.from) return;
        const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
        await startJournalChatHandler(ctx, user);
    });

    bot.on("message", async (ctx, next) => {
        if (ctx.session?.journalChatMode) {
            if (ctx.message?.text?.startsWith('/')) {
                await ctx.reply("Please exit chat mode first to use commands.", { 
                    reply_markup: createChatInlineKeyboard() 
                });
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
