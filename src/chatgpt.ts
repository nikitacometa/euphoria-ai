import OpenAI from "openai";
import { GPT_VERSION, OPENAI_API_KEY } from "./config";
import { createReadStream } from "fs";

const openai = new OpenAI({
    apiKey: OPENAI_API_KEY
});

export async function promptText(text: string): Promise<string> {
    const chatCompletion = await openai.chat.completions.create({
        messages: [{ role: 'user', content: text }],
        model: GPT_VERSION,
    });
    const message = chatCompletion.choices[0].message;
    if (message.content == null) {
        throw new Error('No message content');
    }
    return message.content;
}

export async function transcribeAudio(filePath: string): Promise<string> {
    try {
        const transcription = await openai.audio.transcriptions.create({
            file: createReadStream(filePath),
            model: "whisper-1",
        });
        
        return transcription.text;
    } catch (error) {
        console.error('Error transcribing audio:', error);
        return "Sorry, I couldn't transcribe your audio message.";
    }
}
