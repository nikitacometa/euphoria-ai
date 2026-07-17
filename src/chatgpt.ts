import OpenAI from "openai";
import { OPENAI_API_KEY } from "./config";
import { createReadStream } from "fs";
import * as fs from "fs";

const openai = new OpenAI({
    apiKey: OPENAI_API_KEY
});

export async function transcribeAudio(filePath: string): Promise<string> {
    try {
        console.log(`Attempting to transcribe audio from file: ${filePath}`);

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            console.error(`File does not exist: ${filePath}`);
            return "Sorry, I couldn't transcribe your audio message. The file doesn't exist.";
        }

        // Check file size
        const stats = fs.statSync(filePath);
        console.log(`File size: ${stats.size} bytes`);

        if (stats.size === 0) {
            console.error(`File is empty: ${filePath}`);
            return "Sorry, I couldn't transcribe your audio message. The file is empty.";
        }

        if (stats.size > 25 * 1024 * 1024) {
            console.error(`File is too large: ${stats.size} bytes`);
            return "Sorry, I couldn't transcribe your audio message. The file is too large (max 25MB).";
        }

        // Create readable stream
        const fileStream = createReadStream(filePath);

        // Attempt transcription
        console.log('Sending file to OpenAI for transcription...');

        const response = await openai.audio.transcriptions.create({
            file: fileStream,
            model: "whisper-1",
        });

        // The response contains a text property with the transcription
        const transcriptionText = response.text;

        if (!transcriptionText || transcriptionText.trim() === '') {
            console.error('Transcription returned empty text');
            return "Sorry, I couldn't transcribe your audio message. No speech was detected.";
        }

        console.log(`Transcription successful: "${transcriptionText}"`);
        return transcriptionText;
    } catch (error) {
        console.error('Error transcribing audio:', error);

        // More detailed error information
        if (error instanceof Error) {
            console.error(`Error name: ${error.name}, message: ${error.message}`);
            console.error(`Stack trace: ${error.stack}`);

            // Check for specific error types
            if (error.message.includes('format')) {
                return "Sorry, I couldn't transcribe your audio. The file format is not supported.";
            } else if (error.message.includes('size')) {
                return "Sorry, I couldn't transcribe your audio. The file size exceeds the limit.";
            } else if (error.message.includes('duration')) {
                return "Sorry, I couldn't transcribe your audio. The audio duration exceeds the limit.";
            }
        }

        return "Sorry, I couldn't transcribe your audio message. There was a technical error.";
    }
}
