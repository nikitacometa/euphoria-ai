import { IJournalEntry, IMessage, MessageType } from '../database';

/** Returns the displayable content of a single message (text or transcription). */
export function getMessageContent(message: IMessage): string {
    switch (message.type) {
        case MessageType.TEXT:
            return message.text || '';
        case MessageType.VOICE:
        case MessageType.VIDEO:
            return message.transcription || '';
        default:
            return '';
    }
}

/** Concatenates all message contents of an entry into a single text block. */
export function extractFullText(entry: IJournalEntry): string {
    const messages = entry.messages as IMessage[];
    return messages
        .map(getMessageContent)
        .filter(content => content.length > 0)
        .join('\n\n');
}
