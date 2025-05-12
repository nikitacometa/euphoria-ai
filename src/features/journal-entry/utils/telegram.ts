import { Context, Keyboard, InlineKeyboard } from 'grammy';
import { IUser } from '../../../types/models';
import { journalActionKeyboard } from '../keyboards/index';
import { formatTranscription } from './formatting';

/**
 * Sends the transcription text as a reply to the original message if user has it enabled.
 */
export async function sendTranscriptionReply(
    ctx: Context, 
    messageId: number, 
    transcription: string, 
    user?: IUser, 
    customKeyboard?: Keyboard | InlineKeyboard
): Promise<void> {
    // If user is provided and showTranscriptions is explicitly false, don't send
    if (!user || user.showTranscriptions === false) {
        return;
    }
    
    await ctx.reply(formatTranscription(transcription), {
        reply_to_message_id: messageId,
        parse_mode: 'HTML'
        // No keyboard for transcription replies
    });
} 