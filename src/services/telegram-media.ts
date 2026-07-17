import { Context } from 'grammy';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { TELEGRAM_API_TOKEN, LOG_LEVEL } from '../config';
import { createLogger } from '../utils/logger';
import { transcribeAudio } from '../ai/transcription';

const mediaLogger = createLogger('TelegramMedia', LOG_LEVEL);

const TEMP_DIR = path.join(os.tmpdir(), 'journal-bot');

/** Downloads a Telegram file to a local temp path and returns that path. */
async function downloadTelegramFile(ctx: Context, fileId: string, extension: string): Promise<string> {
    const file = await ctx.api.getFile(fileId);
    if (!file.file_path) {
        throw new Error(`Telegram returned no file path for file ${fileId}`);
    }

    const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_API_TOKEN}/${file.file_path}`;
    const response = await fetch(fileUrl);
    if (!response.ok) {
        throw new Error(`Failed to download Telegram file ${fileId}: HTTP ${response.status}`);
    }

    await fs.mkdir(TEMP_DIR, { recursive: true });
    const localFilePath = path.join(TEMP_DIR, `${Date.now()}_${fileId.slice(-8)}${extension}`);
    const buffer = await response.arrayBuffer();
    await fs.writeFile(localFilePath, Buffer.from(buffer));

    return localFilePath;
}

/**
 * Downloads a Telegram media file, transcribes it, and always removes
 * the temp file — including on transcription failure.
 */
async function transcribeTelegramFile(ctx: Context, fileId: string, extension: string): Promise<string> {
    const localFilePath = await downloadTelegramFile(ctx, fileId, extension);
    try {
        return await transcribeAudio(localFilePath);
    } finally {
        await fs.unlink(localFilePath).catch(error =>
            mediaLogger.warn(`Failed to delete temp file ${localFilePath}:`, error)
        );
    }
}

export async function transcribeVoiceMessage(ctx: Context, fileId: string): Promise<string> {
    return transcribeTelegramFile(ctx, fileId, '.oga');
}

export async function transcribeVideoMessage(ctx: Context, fileId: string): Promise<string> {
    return transcribeTelegramFile(ctx, fileId, '.mp4');
}

/** Extracts the file id of a video or video note from a message, if present. */
export function getVideoFileId(message: { video_note?: { file_id: string }; video?: { file_id: string } }): string | null {
    return message.video_note?.file_id ?? message.video?.file_id ?? null;
}
