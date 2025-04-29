import { IMessage, MessageRole, MessageType, IChatMessage } from "../../types/models";
import fs from "fs";
import { openAIService } from "./openai-client.service";
import { chatPrompts } from "../../config/ai-prompts";
import { errorService } from "../error.service";
import { AIError } from "../../types/errors";

/**
 * Generate an image based on a text prompt using DALL-E
 * @param prompt Text prompt for image generation
 * @returns URL of the generated image and the revised prompt
 */
export async function generateImage(prompt: string): Promise<{ url: string; revisedPrompt: string }> {
    try {
        return await openAIService.generateImage(prompt);
    } catch (error) {
        errorService.logError(
            error instanceof AIError 
                ? error 
                : new AIError(
                    'Error generating image', 
                    { prompt },
                    error instanceof Error ? error : undefined
                ),
            {},
            'error'
        );
        throw error;
    }
}

/**
 * Generate a chat response with conversation history
 * @param currentMessage The current user message
 * @param conversationHistory Array of previous messages in the conversation
 * @returns Generated response text
 */
export async function promptWithConversationHistory(
    currentMessage: string, 
    conversationHistory: IMessage[]
): Promise<string> {
    try {
        // Convert conversation history to IChatMessage format
        const messages: IChatMessage[] = [
            {
                role: 'system',
                content: chatPrompts.conversationSystemPrompt
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

        // Call the centralized service
        const chatCompletion = await openAIService.createChatCompletion(messages);

        const message = chatCompletion.choices[0].message;
        if (message.content == null) {
            throw new AIError('No message content');
        }
        return message.content;
    } catch (error) {
        errorService.logError(
            error instanceof AIError 
                ? error 
                : new AIError(
                    'Error generating chat response', 
                    { messageCount: conversationHistory.length },
                    error instanceof Error ? error : undefined
                ),
            {},
            'error'
        );
        throw error;
    }
}

/**
 * Generate a response to a single text prompt
 * @param text Text prompt
 * @returns Generated response text
 */
export async function promptText(text: string): Promise<string> {
    try {
        const chatCompletion = await openAIService.createChatCompletion([
            { role: 'user', content: text }
        ]);
        
        const message = chatCompletion.choices[0].message;
        if (message.content == null) {
            throw new AIError('No message content');
        }
        return message.content;
    } catch (error) {
        errorService.logError(
            error instanceof AIError 
                ? error 
                : new AIError(
                    'Error generating text response', 
                    { textLength: text.length },
                    error instanceof Error ? error : undefined
                ),
            {},
            'error'
        );
        throw error;
    }
}

/**
 * Transcribe audio content from a file
 * @param filePath Path to audio file
 * @returns Transcribed text
 */
export async function transcribeAudio(filePath: string): Promise<string> {
    try {
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            throw new AIError(`File does not exist: ${filePath}`, { filePath });
        }
        
        // Check file size
        const stats = fs.statSync(filePath);
        if (stats.size === 0) {
            throw new AIError(`File is empty: ${filePath}`, { filePath, size: stats.size });
        }
        
        if (stats.size > 25 * 1024 * 1024) {
            throw new AIError(`File is too large: ${stats.size} bytes`, { filePath, size: stats.size });
        }
        
        // Use the centralized service
        return await openAIService.transcribeAudio(filePath);
    } catch (error) {
        // Handle specific error cases with user-friendly messages
        if (error instanceof AIError) {
            if (error.message.includes('does not exist')) {
                return "Sorry, I couldn't transcribe your audio message. The file doesn't exist.";
            } else if (error.message.includes('empty')) {
                return "Sorry, I couldn't transcribe your audio message. The file is empty.";
            } else if (error.message.includes('too large')) {
                return "Sorry, I couldn't transcribe your audio message. The file is too large (max 25MB).";
            }
            
            errorService.logError(error, {}, 'error');
        } else {
            errorService.logError(
                new AIError(
                    'Error transcribing audio', 
                    { filePath },
                    error instanceof Error ? error : undefined
                ),
                {},
                'error'
            );
        }
        
        // Check for specific error types for better user messaging
        if (error instanceof Error) {
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
