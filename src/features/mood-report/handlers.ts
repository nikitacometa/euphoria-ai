import { JournalBotContext } from '../../types/session';
import { IUser, IJournalEntry, MessageRole, MessageType } from '../../types/models';
import { Types } from 'mongoose';
import { logger } from '../../utils/logger';
import { withCommandLogging } from '../../utils/command-logger';
import { 
    createMoodRatingKeyboard, 
    createDaySuccessKeyboard, 
    createSleepHoursKeyboard, 
    createDetailsKeyboard,
    createSummaryKeyboard,
    MOOD_CALLBACKS 
} from './keyboards';
import { 
    createJournalEntry, 
    addMessageToJournalEntry, 
    completeJournalEntry, 
    saveTextMessage,
    saveVoiceMessage,
    saveVideoMessage,
    saveImageMessage,
    JournalEntry
} from '../../database';
import { t } from '../../utils/localization';
import { showMainMenu } from '../core/handlers';
import { removeInlineKeyboard } from '../../utils/inline-keyboard';
import { requireUser } from '../../middlewares/user-context';
import { transcribeAudio } from '../../services/ai/openai.service';

const HTML_PARSE_MODE = 'HTML' as const;

/**
 * Starts the mood report flow
 */
export const startMoodReport = withCommandLogging('report_mood', async (ctx: JournalBotContext) => {
    if (!ctx.from) return;
    
    const user = requireUser(ctx);
    
    // Reset any existing mood report session
    ctx.session.moodReportActive = true;
    ctx.session.moodReportStep = 'mood';
    ctx.session.moodReportData = {};
    
    // Create a new journal entry
    const entry = await createJournalEntry(user._id as Types.ObjectId);
    ctx.session.moodReportData.entryId = (entry._id as Types.ObjectId).toString();
    
    // Show mood rating keyboard
    await ctx.reply(
        `<b>Hi ${user.name || user.firstName}! 🌟</b>\n\nHow would you rate your mood today?\n\n<i>1 = Terrible, 5 = Amazing</i>`,
        {
            parse_mode: HTML_PARSE_MODE,
            reply_markup: createMoodRatingKeyboard()
        }
    );
});

/**
 * Handles mood rating selection
 */
export async function handleMoodRating(ctx: JournalBotContext, rating: number) {
    await ctx.answerCallbackQuery();
    
    const user = requireUser(ctx);
    
    if (!ctx.session.moodReportData) {
        await ctx.reply('Something went wrong. Please start again with /report_mood');
        return;
    }
    
    ctx.session.moodReportData.moodRating = rating;
    ctx.session.moodReportStep = 'success';
    
    await removeInlineKeyboard(ctx);
    
    const moodEmoji = ['😔', '😕', '😐', '🙂', '😄'][rating - 1];
    
    await ctx.reply(
        `<b>Mood: ${moodEmoji} ${rating}/5</b>\n\nHow successful were you today?\nDid you achieve what you planned?`,
        {
            parse_mode: HTML_PARSE_MODE,
            reply_markup: createDaySuccessKeyboard()
        }
    );
}

/**
 * Handles day success selection
 */
export async function handleDaySuccess(ctx: JournalBotContext, success: string) {
    await ctx.answerCallbackQuery();
    
    const user = requireUser(ctx);
    
    if (!ctx.session.moodReportData) {
        await ctx.reply('Something went wrong. Please start again with /report_mood');
        return;
    }
    
    ctx.session.moodReportData.daySuccess = success;
    ctx.session.moodReportStep = 'sleep';
    
    await removeInlineKeyboard(ctx);
    
    await ctx.reply(
        `<b>Success: ${success}</b>\n\nHow much sleep did you get last night? 😴`,
        {
            parse_mode: HTML_PARSE_MODE,
            reply_markup: createSleepHoursKeyboard()
        }
    );
}

/**
 * Handles sleep hours selection
 */
export async function handleSleepHours(ctx: JournalBotContext, sleep: string) {
    await ctx.answerCallbackQuery();
    
    const user = requireUser(ctx);
    
    if (!ctx.session.moodReportData) {
        await ctx.reply('Something went wrong. Please start again with /report_mood');
        return;
    }
    
    ctx.session.moodReportData.sleepHours = sleep;
    ctx.session.moodReportStep = 'details';
    
    await removeInlineKeyboard(ctx);
    
    // Escape the sleep text for HTML
    const escapedSleep = sleep.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    await ctx.reply(
        `<b>Sleep: ${escapedSleep}</b>\n\nWould you like to add any details about your day?\n\n<i>You can send text, voice note, or video message. Or skip this step.</i>`,
        {
            parse_mode: HTML_PARSE_MODE,
            reply_markup: createDetailsKeyboard()
        }
    );
}

/**
 * Handles details input (text/voice/video)
 */
export async function handleDetailsInput(ctx: JournalBotContext) {
    const user = requireUser(ctx);
    
    if (!ctx.session.moodReportData || !ctx.session.moodReportData.entryId) {
        await ctx.reply('Something went wrong. Please start again with /report_mood');
        return;
    }
    
    const entryId = new Types.ObjectId(ctx.session.moodReportData.entryId);
    
    // Process different message types
    if (ctx.message && ctx.message.message_id) {
        let messageContent = '';
        let messageId: Types.ObjectId | undefined;
        
        if ('text' in ctx.message && ctx.message.text) {
            messageContent = ctx.message.text;
            const savedMessage = await saveTextMessage(
                user._id as Types.ObjectId,
                entryId,
                ctx.message.message_id,
                messageContent,
                MessageRole.USER
            );
            messageId = savedMessage._id as Types.ObjectId;
        } else if ('voice' in ctx.message && ctx.message.voice) {
            try {
                const transcription = await transcribeAudio(ctx.message.voice.file_id);
                messageContent = transcription || '[Voice message]';
                const savedMessage = await saveVoiceMessage(
                    user._id as Types.ObjectId,
                    entryId,
                    ctx.message.message_id,
                    ctx.message.voice.file_id,
                    '', // filePath - we'll use empty string for now
                    transcription || '',
                    MessageRole.USER,
                    ctx.message.voice.duration
                );
                messageId = savedMessage._id as Types.ObjectId;
            } catch (error) {
                logger.error('Error transcribing voice message:', error);
                // Still save the voice message even if transcription fails
                messageContent = '[Voice message - transcription failed]';
                const savedMessage = await saveVoiceMessage(
                    user._id as Types.ObjectId,
                    entryId,
                    ctx.message.message_id,
                    ctx.message.voice.file_id,
                    '',
                    '', // Empty transcription
                    MessageRole.USER,
                    ctx.message.voice.duration
                );
                messageId = savedMessage._id as Types.ObjectId;
            }
        } else if ('video_note' in ctx.message && ctx.message.video_note) {
            try {
                const transcription = await transcribeAudio(ctx.message.video_note.file_id);
                messageContent = transcription || '[Video message]';
                const savedMessage = await saveVideoMessage(
                    user._id as Types.ObjectId,
                    entryId,
                    ctx.message.message_id,
                    ctx.message.video_note.file_id,
                    '', // filePath - we'll use empty string for now
                    transcription || '',
                    MessageRole.USER,
                    ctx.message.video_note.duration
                );
                messageId = savedMessage._id as Types.ObjectId;
            } catch (error) {
                logger.error('Error transcribing video message:', error);
                // Still save the video message even if transcription fails
                messageContent = '[Video message - transcription failed]';
                const savedMessage = await saveVideoMessage(
                    user._id as Types.ObjectId,
                    entryId,
                    ctx.message.message_id,
                    ctx.message.video_note.file_id,
                    '',
                    '', // Empty transcription
                    MessageRole.USER,
                    ctx.message.video_note.duration
                );
                messageId = savedMessage._id as Types.ObjectId;
            }
        } else if ('photo' in ctx.message && ctx.message.photo && ctx.message.photo.length > 0) {
            messageContent = ctx.message.caption || '[Photo]';
            const photo = ctx.message.photo[ctx.message.photo.length - 1];
            const savedMessage = await saveImageMessage(
                user._id as Types.ObjectId,
                entryId,
                ctx.message.message_id,
                photo.file_id, // Using file_id as imageUrl for now
                ctx.message.caption || '',
                MessageRole.USER
            );
            messageId = savedMessage._id as Types.ObjectId;
        }
        
        if (messageId) {
            await addMessageToJournalEntry(entryId, messageId);
        }
        
        ctx.session.moodReportData.details = messageContent;
    }
    
    // Show summary
    await showMoodSummary(ctx, user);
}

/**
 * Shows mood report summary
 */
export async function showMoodSummary(ctx: JournalBotContext, user: IUser) {
    const data = ctx.session.moodReportData;
    
    if (!data) {
        await ctx.reply('Something went wrong. Please start again with /report_mood');
        return;
    }
    
    const moodEmoji = ['😔', '😕', '😐', '🙂', '😄'][(data.moodRating || 3) - 1];
    
    const summary = `<b>📊 Today's Mood Report</b>\n\n` +
        `<b>Mood:</b> ${moodEmoji} ${data.moodRating}/5\n` +
        `<b>Success:</b> ${data.daySuccess || 'Not specified'}\n` +
        `<b>Sleep:</b> ${data.sleepHours || 'Not specified'}\n` +
        `${data.details ? `\n<b>Details:</b>\n${data.details.substring(0, 200)}${data.details.length > 200 ? '...' : ''}` : ''}`;
    
    ctx.session.moodReportStep = 'summary';
    
    await ctx.reply(summary, {
        parse_mode: HTML_PARSE_MODE,
        reply_markup: createSummaryKeyboard()
    });
}

/**
 * Saves the mood report
 */
export async function saveMoodReport(ctx: JournalBotContext) {
    await ctx.answerCallbackQuery();
    
    const user = requireUser(ctx);
    const data = ctx.session.moodReportData;
    
    if (!data || !data.entryId) {
        await ctx.reply('Something went wrong. Please start again with /report_mood');
        return;
    }
    
    await removeInlineKeyboard(ctx);
    
    try {
        const entryId = new Types.ObjectId(data.entryId);
        
        // Update the journal entry with mood report data
        await JournalEntry.findByIdAndUpdate(entryId, {
            $set: {
                isMoodReport: true,
                moodRating: data.moodRating,
                daySuccess: data.daySuccess,
                sleepHours: data.sleepHours,
                fullText: data.details || '',
                status: 'completed',
                name: `Mood Report - ${new Date().toLocaleDateString()}`,
                keywords: ['mood-report', `mood-${data.moodRating}`, data.daySuccess || '']
            }
        });
        
        // Generate simple insights
        const insights = generateMoodInsights(data);
        
        await completeJournalEntry(
            entryId,
            insights,
            insights,
            `Mood Report - ${new Date().toLocaleDateString()}`,
            ['mood-report', `mood-${data.moodRating}`, data.daySuccess || '']
        );
        
        // Clear session
        ctx.session.moodReportActive = false;
        ctx.session.moodReportStep = undefined;
        ctx.session.moodReportData = undefined;
        
        await ctx.reply(
            `✅ <b>Mood report saved!</b>\n\n${insights}\n\nKeep tracking your mood daily to see patterns over time! 📈`,
            { parse_mode: HTML_PARSE_MODE }
        );
        
        await showMainMenu(ctx, user);
        
    } catch (error) {
        logger.error('Error saving mood report:', error);
        await ctx.reply('Sorry, there was an error saving your mood report. Please try again.');
    }
}

/**
 * Handles reflect more option
 */
export async function handleReflectMore(ctx: JournalBotContext) {
    await ctx.answerCallbackQuery();
    
    const user = requireUser(ctx);
    
    if (!ctx.session.moodReportData || !ctx.session.moodReportData.entryId) {
        await ctx.reply('Something went wrong. Please start again with /report_mood');
        return;
    }
    
    await removeInlineKeyboard(ctx);
    
    // Convert to regular journal entry
    ctx.session.journalEntryId = ctx.session.moodReportData.entryId;
    ctx.session.moodReportActive = false;
    ctx.session.moodReportStep = undefined;
    ctx.session.moodReportData = undefined;
    
    await ctx.reply(
        `Great! Let's dive deeper into your day. Feel free to share more thoughts, feelings, or experiences.\n\n<i>Send messages to continue your reflection...</i>`,
        { parse_mode: HTML_PARSE_MODE }
    );
    
    // Import journal entry handler
    const { handleJournalEntryInput } = await import('../journal-entry/handlers.js');
    // The next message will be handled by journal entry flow
}

/**
 * Cancels mood report
 */
export async function cancelMoodReport(ctx: JournalBotContext) {
    await ctx.answerCallbackQuery();
    
    const user = requireUser(ctx);
    
    await removeInlineKeyboard(ctx);
    
    // Clear session
    ctx.session.moodReportActive = false;
    ctx.session.moodReportStep = undefined;
    ctx.session.moodReportData = undefined;
    
    await ctx.reply('Mood report cancelled. You can start a new one anytime! ✨');
    await showMainMenu(ctx, user);
}

/**
 * Generates simple insights from mood data
 */
function generateMoodInsights(data: any): string {
    const mood = data.moodRating || 3;
    const success = data.daySuccess || 'unknown';
    const sleep = data.sleepHours || 'unknown';
    
    let insights = [];
    
    // Mood insight
    if (mood <= 2) {
        insights.push("Your mood seems low today. Remember, it's okay to have tough days.");
    } else if (mood >= 4) {
        insights.push("You're feeling great today! Keep up the positive energy!");
    }
    
    // Sleep insight
    if (sleep.includes('< 4') || sleep.includes('4-6')) {
        insights.push("Limited sleep might be affecting your mood and productivity. Try to get more rest tonight.");
    } else if (sleep.includes('8-10') || sleep.includes('> 10')) {
        insights.push("Great sleep! This likely contributed to your day's outcomes.");
    }
    
    // Success correlation
    if (mood >= 4 && success.includes('Crushed')) {
        insights.push("High mood + high success = You're on fire! 🔥");
    } else if (mood <= 2 && success.includes('Failed')) {
        insights.push("Tough day all around. Tomorrow is a fresh start!");
    }
    
    return insights.join(' ');
} 