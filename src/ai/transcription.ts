import { createReadStream, promises as fs } from 'fs';
import { createLogger } from '../utils/logger';
import { LOG_LEVEL } from '../config';
import { openai } from './client';

const transcriptionLogger = createLogger('Transcription', LOG_LEVEL);

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // Whisper API limit

/**
 * Transcribes an audio or video file with Whisper.
 * Throws on failure; callers decide how to surface errors to the user.
 * Never returns error prose as if it were a transcription.
 */
export async function transcribeAudio(filePath: string): Promise<string> {
    const stats = await fs.stat(filePath);

    if (stats.size === 0) {
        throw new Error(`Cannot transcribe empty file: ${filePath}`);
    }
    if (stats.size > MAX_FILE_SIZE_BYTES) {
        throw new Error(`File exceeds Whisper 25MB limit (${stats.size} bytes): ${filePath}`);
    }

    transcriptionLogger.debug(`Transcribing ${filePath} (${stats.size} bytes)`);

    const response = await openai.audio.transcriptions.create({
        file: createReadStream(filePath),
        model: 'whisper-1'
    });

    const transcription = response.text.trim();
    if (!transcription) {
        throw new Error('Transcription returned empty text (no speech detected)');
    }

    transcriptionLogger.debug(`Transcription successful (${transcription.length} chars)`);
    return transcription;
}
