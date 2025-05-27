import { Context, Keyboard, InlineKeyboard } from 'grammy';
import { IMessage, IJournalEntry, MessageType, IUser } from '../../types/models';
import { journalActionKeyboard } from './keyboards/index';
import { JournalEntry } from '../../database/models/journal.model';
import { t } from '../../utils/localization'; // Import the new t function
// import { t } from '../../utils/localization'; // TODO: Uncomment when localization is implemented

/**
 * Formats a transcription for display
 */
export function formatTranscription(transcription: string, user?: IUser): string {
    return `<b>${t('journal:transcriptionHeader', { user })}</b>\n\n<code>${sanitizeHtmlForTelegram(transcription)}</code>`;
}

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
    
    await ctx.reply(formatTranscription(transcription, user), {
        reply_to_message_id: messageId,
        parse_mode: 'HTML'
        // Removed reply_markup to eliminate inline keyboard
    });
}

/**
 * Extracts and concatenates text/transcription from all messages in a journal entry.
 */
export async function extractFullText(entry: IJournalEntry): Promise<string> {
    // Ensure messages are populated before casting
    if (!entry.messages || !Array.isArray(entry.messages) || typeof entry.messages[0] === 'string') {
        // If we have an entry ID but unpopulated messages, try to fetch with populated messages
        if (entry._id) {
            try {
                const populatedEntry = await JournalEntry.findById(entry._id).populate('messages');
                if (populatedEntry && Array.isArray(populatedEntry.messages) && typeof populatedEntry.messages[0] !== 'string') {
                    return extractFullText(populatedEntry); // Recursively call with populated entry
                }
            } catch (error) {
                console.warn(`Failed to re-fetch entry with populated messages: ${entry._id}`, error);
            }
        }
        
        console.warn("Attempted to extract text from entry with unpopulated messages:", entry._id);
        return ""; // Or throw an error
    }

    const messages = entry.messages as IMessage[]; // Safe to cast now
    const entryContent = messages.map(message => {
        let content = '';

        // Check if the message is forwarded by looking at the DB entry
        // We need to ensure the message object potentially has the raw Telegram data
        // or that we stored relevant forwarded info during handleJournalEntryInput
        // For now, assume the IMessage might have the raw ctx.message structure
        // or we need to adjust saving logic later.
        // This is a simplified check based on typical ctx.message structure.
        // NOTE: This assumes the 'message' object passed during saving contained the forward info.
        // A more robust solution might involve storing 'forward_origin'/'forward_from' in IMessage.
        const potentialRawMessage = message as any; // Cast to access potential raw fields

        if (potentialRawMessage.forward_origin || potentialRawMessage.forward_from) {
             // It's a forwarded message, try to get original content
             if (potentialRawMessage.text) {
                 content = potentialRawMessage.text;
             } else if (potentialRawMessage.transcription) {
                 // Use transcription if available (likely from voice/video note)
                 content = potentialRawMessage.transcription;
             }
             // Add checks for other forwarded types if needed (e.g., caption)
             // else if (potentialRawMessage.caption) { content = potentialRawMessage.caption; }
        } else {
            // Not forwarded, process normally based on stored type
            if (message.type === MessageType.TEXT) {
                content = message.text || '';
            } else if (message.type === MessageType.VOICE) {
                content = message.transcription || '';
            } else if (message.type === MessageType.VIDEO) {
                // This assumes video/video_note transcriptions are stored in IMessage.transcription
                content = message.transcription || '';
            }
        }
        // Ignore other types like IMAGE if they exist
        return content;
    }).filter(content => content.length > 0).join('\n\n'); // Join with double newline for paragraph breaks
    
    return entryContent;
}

/**
 * Sanitizes HTML content for Telegram messages.
 * Telegram only supports a limited set of HTML tags:
 * <b>, <i>, <u>, <s>, <tg-spoiler>, <a>, <code>, <pre>
 */
export function sanitizeHtmlForTelegram(text: string): string {
    return text
        .replace(/<\/?p>/g, '') // Remove paragraph tags
        .replace(/<(?!\/?(b|i|u|s|tg-spoiler|a|code|pre)[ >])[^>]+>/g, '') // Remove unsupported tags
        .trim();
}

/**
 * Formats error messages for user display
 */
export function formatErrorMessage(messageKey: string, user?: IUser, params?: Record<string, any>): string {
    return `<b>${t('common:oops', { user })}</b> ${sanitizeHtmlForTelegram(t(messageKey, {user, ...params}))}`;
}

/**
 * Formats system messages (info, success, etc)
 */
export function formatSystemMessage(messageKey: string, user?: IUser, params?: Record<string, any>): string {
    return sanitizeHtmlForTelegram(t(messageKey, {user, ...params}));
}

/**
 * Creates a message summary of the journal entry
 * @param entry Journal entry to summarize
 * @returns Summary text showing message counts
 */
export async function createEntrySummary(entry: IJournalEntry, user?: IUser): Promise<string> {
    if (!entry) {
        return t('journal:noMessagesYet', { user });
    }

    if (typeof entry.textMessages === 'number' || 
        typeof entry.voiceMessages === 'number' || 
        typeof entry.videoMessages === 'number' || 
        typeof entry.fileMessages === 'number') {
        
        const textCount = entry.textMessages || 0;
        const voiceCount = entry.voiceMessages || 0;
        const videoCount = entry.videoMessages || 0;
        const fileCount = entry.fileMessages || 0;
        
        const formatCounts = [];
        if (textCount > 0) formatCounts.push(`${t('common:summary.text', { user })}:${textCount}`);
        if (voiceCount > 0) formatCounts.push(`${t('common:summary.voice', { user })}:${voiceCount}`);
        if (videoCount > 0) formatCounts.push(`${t('common:summary.video', { user })}:${videoCount}`);
        if (fileCount > 0) formatCounts.push(`${t('common:summary.file', { user })}:${fileCount}`);
        
        if (formatCounts.length > 0) {
            return `[${formatCounts.join(' ')}]`;
        }
    }

    if (!entry.messages || !Array.isArray(entry.messages) || entry.messages.length === 0) {
        return t('journal:noMessagesYet', { user });
    }

    if (typeof entry.messages[0] === 'string') {
        try {
            const populatedEntry = await JournalEntry.findById(entry._id).populate('messages');
            if (populatedEntry && Array.isArray(populatedEntry.messages) && typeof populatedEntry.messages[0] !== 'string') {
                return createEntrySummary(populatedEntry, user); // Pass user
            }
            return t('journal:entryDetailsUnavailable', { user });
        } catch (error) {
            console.warn(`Failed to re-fetch entry with populated messages: ${entry._id}`, error);
            return t('journal:entryDetailsUnavailable', { user });
        }
    }

    const messages = entry.messages as IMessage[];
    const textCount = messages.filter(m => m.type === MessageType.TEXT).length;
    const voiceCount = messages.filter(m => m.type === MessageType.VOICE).length;
    const videoCount = messages.filter(m => m.type === MessageType.VIDEO).length;
    const imageCount = messages.filter(m => m.type === MessageType.IMAGE).length;
    
    const parts = [];
    if (textCount > 0) parts.push(`${t('common:summary.text', { user })}:${textCount}`);
    if (voiceCount > 0) parts.push(`${t('common:summary.voice', { user })}:${voiceCount}`);
    if (videoCount > 0) parts.push(`${t('common:summary.video', { user })}:${videoCount}`);
    if (imageCount > 0) parts.push(`${t('common:summary.image', { user })}:${imageCount}`); // Added image for completeness
    
    if (parts.length > 0) {
        return `[${parts.join(' ')}]`;
    }
    
    return t('journal:noMessagesYet', { user });
}

/**
 * Creates a status message for the current journal entry
 * Shows message counts and prompts for next action
 */
export async function createEntryStatusMessage(entry: IJournalEntry, user: IUser): Promise<string> {
    const populatedMessages = entry.messages.filter(m => typeof m !== 'string') as IMessage[];
    
    // Count messages by type
    const textCount = populatedMessages.filter(m => m.type === MessageType.TEXT).length;
    const voiceCount = populatedMessages.filter(m => m.type === MessageType.VOICE).length;
    const videoCount = populatedMessages.filter(m => m.type === MessageType.VIDEO).length;
    const imageCount = populatedMessages.filter(m => m.type === MessageType.IMAGE).length;
    
    let statusParts = [];
    if (textCount > 0) statusParts.push(`${textCount} 📝`);
    if (voiceCount > 0) statusParts.push(`${voiceCount} 🎤`);
    if (videoCount > 0) statusParts.push(`${videoCount} 🎬`);
    if (imageCount > 0) statusParts.push(`${imageCount} 🖼️`);
    
    const statusLine = statusParts.join(' • ');
    
    return `<b>Current Entry:</b>\n${formatMessageList(populatedMessages, user)}\n\n` +
           `${t('journal:statusMessage.encourage', { user, defaultValue: "Keep going! What else is on your mind?" })}\n\n` +
           `<i>${t('journal:statusMessage.shareHint', { user, defaultValue: "Remember to share texts, voice, or video messages." })}</i>`;
}

/**
 * Formats the duration of a voice/video message in a human-readable format.
 * @param durationSeconds Duration in seconds.
 * @param user Optional user object for localization (currently placeholder).
 * @returns Formatted duration string (e.g., "45s", "1m 23s").
 */
export function formatMessageDuration(durationSeconds: number, user?: IUser): string {
    if (durationSeconds < 0) durationSeconds = 0;
    if (durationSeconds < 60) {
        return `${durationSeconds}${t('common:secondsSuffix', { user })}`; 
    }
    const minutes = Math.floor(durationSeconds / 60);
    const seconds = durationSeconds % 60;
    if (seconds === 0) {
        return `${minutes}${t('common:minutesSuffix', { user })}`; 
    }
    return `${minutes}${t('common:minutesSuffix', { user })} ${seconds}${t('common:secondsSuffix', { user })}`;
}

/**
 * Generates a preview string for a given message.
 * @param message The message object.
 * @param user Optional user object for localization.
 * @returns A preview string (e.g., "📝 \"Hello world...\" (text)", "🎤 Voice message (1m 23s)").
 */
export function getMessagePreview(message: IMessage, user?: IUser): string {
    const typeEmojiMap = {
        [MessageType.TEXT]: "📝",
        [MessageType.VOICE]: "🎤",
        [MessageType.VIDEO]: "🎥",
        [MessageType.IMAGE]: "🖼️", 
    };
    const emoji = typeEmojiMap[message.type] || "📎";

    switch (message.type) {
        case MessageType.TEXT:
            const previewText = message.text?.substring(0, 20) || '';
            const ellipsis = (message.text && message.text.length > 20) ? '...' : '';
            return `${emoji} \"${previewText}${ellipsis}\" (${t('common:messageType.text', { user })})`;
        case MessageType.VOICE:
            const voiceDuration = message.duration || 0; 
            return `${emoji} ${t('common:messageType.voice', { user })} (${formatMessageDuration(voiceDuration, user)})`;
        case MessageType.VIDEO:
            const videoDuration = message.duration || 0;
            return `${emoji} ${t('common:messageType.video', { user })} (${formatMessageDuration(videoDuration, user)})`;
        default:
            return `${emoji} ${t('common:messageType.file', { user })}`; // Assuming key exists
    }
}

/**
 * Formats a list of messages into a string for display in the journal entry flow.
 * @param messages Array of message objects.
 * @param user Optional user object for localization.
 * @returns A formatted string listing the messages, or an empty string if no messages.
 */
export function formatMessageList(messages: IMessage[], user?: IUser): string {
    if (!messages || messages.length === 0) {
        return '';
    }
    const header = `<b>${t('journal:currentEntryHeader', { user })}</b>`;
    const messageItems = messages
        .map((msg, index) => `${index + 1}. ${getMessagePreview(msg, user)}`)
        .join('\n');
    
    return `\n${header}\n${messageItems}\n`; 
}
