import { Context, Keyboard, InlineKeyboard } from 'grammy';
import { IMessage, IJournalEntry, MessageType, IUser } from '../../types/models';
import { journalActionKeyboard } from './keyboards/index';
import { JournalEntry } from '../../database/models/journal.model';

/**
 * Formats a transcription for display
 */
export function formatTranscription(transcription: string): string {
    return `<b>Here's what I heard:</b>\n\n<code>${sanitizeHtmlForTelegram(transcription)}</code>`;
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
    
    await ctx.reply(formatTranscription(transcription), {
        reply_to_message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: customKeyboard || journalActionKeyboard
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
export function formatErrorMessage(message: string): string {
    return `<b>Oops!</b> ${sanitizeHtmlForTelegram(message)}`;
}

/**
 * Formats system messages (info, success, etc)
 */
export function formatSystemMessage(message: string): string {
    return sanitizeHtmlForTelegram(message);
}

/**
 * Common error messages
 */
export const ErrorMessages = {
    ENTRY_NOT_FOUND: "I couldn't find that journal entry. Let's start fresh! ✨",
    TRANSCRIPTION_FAILED: "I had trouble understanding that recording. Could you try again? 🎤",
    GENERAL_ERROR: "Something went wrong. Please try again. ✨",
    ANALYSIS_FAILED: "I had trouble analyzing your entry, but don't worry - it's saved! ✨",
    EMPTY_ENTRY: "There's nothing to analyze yet. Share some thoughts first! ✨",
    SESSION_EXPIRED: "Looks like that reflection session ended. Let's start fresh! 💫"
} as const;

/**
 * Creates a message summary of the journal entry
 * @param entry Journal entry to summarize
 * @returns Summary text showing message counts
 */
export async function createEntrySummary(entry: IJournalEntry): Promise<string> {
    if (!entry.messages || !Array.isArray(entry.messages) || entry.messages.length === 0) {
        return 'No messages yet.';
    }

    // Ensure messages are populated
    if (typeof entry.messages[0] === 'string') {
        try {
            const populatedEntry = await JournalEntry.findById(entry._id).populate('messages');
            if (populatedEntry && Array.isArray(populatedEntry.messages) && typeof populatedEntry.messages[0] !== 'string') {
                return createEntrySummary(populatedEntry); // Recursively call with populated entry
            }
            return 'Entry details unavailable.';
        } catch (error) {
            console.warn(`Failed to re-fetch entry with populated messages: ${entry._id}`, error);
            return 'Entry details unavailable.';
        }
    }

    const messages = entry.messages as IMessage[];
    
    // Count message types
    const textCount = messages.filter(m => m.type === MessageType.TEXT).length;
    const voiceCount = messages.filter(m => m.type === MessageType.VOICE).length;
    const videoCount = messages.filter(m => m.type === MessageType.VIDEO).length;
    const imageCount = messages.filter(m => m.type === MessageType.IMAGE).length;
    
    // Create summary
    const parts = [];
    if (textCount > 0) parts.push(`•${textCount} text${textCount !== 1 ? 's' : ''}`);
    if (voiceCount > 0) parts.push(`•${voiceCount} voice${voiceCount !== 1 ? 's' : ''}`);
    if (videoCount > 0) parts.push(`•${videoCount} video${videoCount !== 1 ? 's' : ''}`);
    if (imageCount > 0) parts.push(`•${imageCount} image${imageCount !== 1 ? 's' : ''}`);
    
    const summary = parts.join('\n');
    return summary || 'No messages yet.';
}

/**
 * Creates a status message for the current journal entry
 * Shows message counts and prompts for next action
 */
export async function createEntryStatusMessage(entry: IJournalEntry): Promise<string> {
    // TODO: Add a status message for the current journal entry
    // const summary = await createEntrySummary(entry);
    // return `<b>The more messages you send, the more I love you 🙂‍↕</b>\n\n${summary}\n\n<i>🎤 Share texts, voices, videos.</i>`;
    return `<b>I love reading you. Give me all you have, please 💖</b>\n\n<i>🎤 Share texts, voices, videos.</i>`;

}
