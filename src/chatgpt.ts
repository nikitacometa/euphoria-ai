import OpenAI from "openai";
import { GPT_VERSION, OPENAI_API_KEY } from "./config";
import { createReadStream } from "fs";
import { IMessage, MessageRole, MessageType } from "./database/models/message.model";

const openai = new OpenAI({
    apiKey: OPENAI_API_KEY
});

interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
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
