import { describe, expect, it, vi } from 'vitest';

vi.mock('../database', () => ({
    MessageType: {
        TEXT: 'text',
        VOICE: 'voice',
        IMAGE: 'image',
        VIDEO: 'video'
    }
}));

import { IJournalEntry, IMessage, MessageType } from '../database';
import { extractFullText, getMessageContent } from './entry-text';

function message(overrides: Partial<IMessage> = {}): IMessage {
    return {
        type: MessageType.TEXT,
        ...overrides
    } as unknown as IMessage;
}

describe('getMessageContent', () => {
    it.each([
        ['text message', message({ type: MessageType.TEXT, text: 'written' }), 'written'],
        ['voice message', message({ type: MessageType.VOICE, transcription: 'spoken' }), 'spoken'],
        ['video message', message({ type: MessageType.VIDEO, transcription: 'recorded' }), 'recorded'],
        ['text without text', message({ type: MessageType.TEXT }), ''],
        ['voice without transcription', message({ type: MessageType.VOICE }), ''],
        ['unknown message type', message({ type: 'unknown' as MessageType }), '']
    ])('returns content for a %s', (_case, input, expected) => {
        expect(getMessageContent(input)).toBe(expected);
    });
});

describe('extractFullText', () => {
    it('joins text and transcribed messages while skipping empty content', () => {
        const entry = {
            messages: [
                message({ text: 'First thought' }),
                message({ type: MessageType.VOICE, transcription: 'Second thought' }),
                message({ type: MessageType.TEXT }),
                message({ type: MessageType.VIDEO })
            ]
        } as unknown as IJournalEntry;

        expect(extractFullText(entry)).toBe('First thought\n\nSecond thought');
    });
});
