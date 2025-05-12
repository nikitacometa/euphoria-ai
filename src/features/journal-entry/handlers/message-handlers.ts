import { Types } from 'mongoose';
import { JournalBotContext } from '../../../types/session';
import { IUser } from '../../../types/models';
import { logger } from '../../../utils/logger';
import { sendTranscriptionReply } from '../utils';
import { journalActionKeyboard } from '../keyboards/index';
import { processMediaMessage, MAX_VOICE_MESSAGE_LENGTH_SECONDS } from './media-processor';
import { addTextMessage, addVideoMessage, addVoiceMessage } from '../../../services/journal-entry.service';
import * as fs from 'fs';

export async function handleTextMessage(
    ctx: JournalBotContext,
    user: IUser,
    entryId: Types.ObjectId
): Promise<boolean> {
    if (!ctx.message || !('text' in ctx.message)) return false;
    
    await addTextMessage(
        user._id as Types.ObjectId,
        entryId,
        ctx.message.message_id,
        ctx.message.text || ''
    );
    
    // Just react with thumbs up - no messages
    await ctx.react("👍").catch(e => logger.warn("Failed to react with thumbs up", e));
    return true;
}

export async function handleVoiceMessage(
    ctx: JournalBotContext,
    user: IUser,
    entryId: Types.ObjectId
): Promise<boolean> {
    if (!ctx.message || !('voice' in ctx.message) || !ctx.message.voice) return false;
    
    // React with eyes first to indicate processing
    await ctx.react("👀").catch(e => logger.warn("Failed to react with eyes", e));
    
    const fileId = ctx.message.voice.file_id;
    
    // Check duration - use configuration constant
    if (ctx.message.voice.duration > MAX_VOICE_MESSAGE_LENGTH_SECONDS) {
        await ctx.reply(`Sorry, voice messages cannot be longer than ${MAX_VOICE_MESSAGE_LENGTH_SECONDS} seconds. Please try again with a shorter recording.`, {
            reply_markup: journalActionKeyboard
        });
        return true;
    }
    
    const { transcription, localFilePath } = await processMediaMessage(ctx, fileId, 'voice');
    fs.unlinkSync(localFilePath); // Clean up temp file
    
    await addVoiceMessage(
        user._id as Types.ObjectId,
        entryId,
        ctx.message.message_id,
        fileId,
        localFilePath,
        transcription
    );
    
    // Send transcription if user wants it
    await sendTranscriptionReply(ctx, ctx.message.message_id, transcription, user);
    
    // Simply replace the eyes reaction with thumbs up
    await ctx.react("👍").catch(e => logger.warn("Failed to add thumbs up reaction", e));
    return true;
}

export async function handleVideoMessage(
    ctx: JournalBotContext,
    user: IUser,
    entryId: Types.ObjectId
): Promise<boolean> {
    if (!ctx.message || (!('video_note' in ctx.message) && !('video' in ctx.message))) return false;
    
    // React with eyes first to indicate processing
    await ctx.react("👀").catch(e => logger.warn("Failed to react with eyes", e));
    
    const fileId = ('video_note' in ctx.message && ctx.message.video_note?.file_id) || 
                  ('video' in ctx.message && ctx.message.video?.file_id) || '';
    if (!fileId) throw new Error('Video file ID not found');
    
    let transcription = "";
    let localFilePath = "";
    
    try {
        const result = await processMediaMessage(ctx, fileId, 'video');
        transcription = result.transcription;
        localFilePath = result.localFilePath;
        fs.unlinkSync(localFilePath); // Clean up temp file
    } catch (transcriptionError) {
        logger.error('Error transcribing video:', transcriptionError);
        transcription = "[Could not transcribe audio]";
    }
    
    await addVideoMessage(
        user._id as Types.ObjectId,
        entryId,
        ctx.message.message_id,
        fileId,
        localFilePath,
        transcription
    );
    
    // Send transcription if user wants it
    await sendTranscriptionReply(ctx, ctx.message.message_id, transcription, user);
    
    // Simply replace the eyes reaction with thumbs up
    await ctx.react("👍").catch(e => logger.warn("Failed to add thumbs up reaction", e));
    return true;
} 