import { JournalBotContext } from '../../../types/session';
import { logger } from '../../../utils/logger';
import { transcribeAudio } from '../../../services/ai/openai.service';
import { TELEGRAM_API_TOKEN } from '../../../config';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export const MAX_VOICE_MESSAGE_LENGTH_SECONDS = 300; // 5 minutes

/**
 * Process media messages (voice/video) for transcription
 */
export async function processMediaMessage(
    ctx: JournalBotContext,
    fileId: string,
    mediaType: 'voice' | 'video'
): Promise<{ transcription: string; localFilePath: string }> {
    // Send transcription progress indicator
    const progressMsg = await ctx.reply("⏳");
    
    try {
        const file = await ctx.api.getFile(fileId);
        const filePath = file.file_path;
        if (!filePath) throw new Error(`${mediaType} file path not found`);

        const localFilePath = await downloadTelegramFile(filePath, mediaType);
        const transcription = await transcribeAudio(localFilePath);
        
        // Delete progress indicator message
        if (ctx.chat) {
            await ctx.api.deleteMessage(ctx.chat.id, progressMsg.message_id)
                .catch(e => logger.warn(`Failed to delete transcription progress message: ${e}`));
        }
        
        return { transcription, localFilePath };
    } catch (error) {
        // Delete progress indicator message on error too
        if (ctx.chat) {
            await ctx.api.deleteMessage(ctx.chat.id, progressMsg.message_id)
                .catch(e => logger.warn(`Failed to delete transcription progress message after error: ${e}`));
        }
        
        // Re-throw for caller to handle
        throw error;
    }
}

/**
 * Download file from Telegram
 */
async function downloadTelegramFile(filePath: string, type: 'voice' | 'video'): Promise<string> {
    const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_API_TOKEN}/${filePath}`;
    const tempDir = path.join(os.tmpdir(), 'journal-bot-downloads');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    const extension = filePath.split('.').pop() || (type === 'voice' ? 'oga' : 'mp4');
    const localFilePath = path.join(tempDir, `${type}_${Date.now()}.${extension}`);
    
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error(`Failed to download file: ${response.statusText} (${response.status})`);
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(localFilePath, Buffer.from(buffer));
    return localFilePath;
} 