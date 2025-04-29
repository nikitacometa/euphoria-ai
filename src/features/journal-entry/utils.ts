import { Context } from 'grammy';
import { IMessage, IJournalEntry, MessageType } from '../../types/models';
import { journalActionKeyboard } from './keyboards';

/**
 * Sends the transcription text as a reply to the original message.
 */
export async function sendTranscriptionReply(ctx: Context, messageId: number, transcription: string): Promise<void> {
    await ctx.reply(`<b>Here's what I heard:</b>\n\n<code>${transcription}</code>`, {
        reply_to_message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: journalActionKeyboard
    });
}

/**
 * Extracts and concatenates text/transcription from all messages in a journal entry.
 */
export async function extractFullText(entry: IJournalEntry): Promise<string> {
    // Ensure messages are populated before casting
    if (!entry.messages || !Array.isArray(entry.messages) || typeof entry.messages[0] === 'string') {
        // TODO: Consider re-fetching the entry with populated messages if necessary
        console.warn("Attempted to extract text from entry with unpopulated messages:", entry._id);
        return ""; // Or throw an error
    }

    const messages = entry.messages as IMessage[]; // Safe to cast now
    const entryContent = messages.map(message => {
        let content = '';
        
        if (message.type === MessageType.TEXT) {
            content = message.text || '';
        } else if (message.type === MessageType.VOICE) {
            content = message.transcription || '';
        } else if (message.type === MessageType.VIDEO) {
            content = message.transcription || '';
        }
        // Ignore other types like IMAGE if they exist
        return content;
    }).filter(content => content.length > 0).join('\n\n'); // Join with double newline for paragraph breaks
    
    return entryContent;
}
