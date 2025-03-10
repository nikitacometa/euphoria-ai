import OpenAI from "openai";
import { GPT_VERSION, OPENAI_API_KEY } from "./config";
import { createReadStream } from "fs";
import { IMessage, MessageRole, MessageType } from "./database/models/message.model";
import fs from "fs";

const openai = new OpenAI({
    apiKey: OPENAI_API_KEY
});

interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export async function generateImage(prompt: string): Promise<{ url: string; revisedPrompt: string }> {
    try {
        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt,
            n: 1,
            size: "1024x1024",
            quality: "standard",
        });

        const url = response.data[0].url;
        const revisedPrompt = response.data[0].revised_prompt;

        if (!url) {
            throw new Error('No image URL returned from OpenAI');
        }

        return { 
            url, 
            revisedPrompt: revisedPrompt || prompt 
        };
    } catch (error) {
        console.error('Error generating image:', error);
        throw new Error('Failed to generate image');
    }
}

export async function promptWithConversationHistory(
    currentMessage: string, 
    conversationHistory: IMessage[]
): Promise<string> {
    // Convert conversation history to OpenAI format
    const messages: ChatMessage[] = [
        {
            role: 'system',
            content: 'You are a helpful assistant in a Telegram bot. Be concise, friendly, and helpful.'
        }
    ];

    // Add conversation history
    for (const message of conversationHistory) {
        let content = '';
        
        if (message.type === MessageType.TEXT) {
            content = message.text || '';
        } else if (message.type === MessageType.VOICE) {
            content = message.transcription || '';
        } else if (message.type === MessageType.VIDEO) {
            content = message.transcription || '';
        }
        
        if (content) {
            messages.push({
                role: message.role === MessageRole.USER ? 'user' : 'assistant',
                content
            });
        }
    }

    // Add current message
    messages.push({
        role: 'user',
        content: currentMessage
    });

    // Call OpenAI API
    const chatCompletion = await openai.chat.completions.create({
        messages,
        model: GPT_VERSION,
    });

    const message = chatCompletion.choices[0].message;
    if (message.content == null) {
        throw new Error('No message content');
    }
    return message.content;
}

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
