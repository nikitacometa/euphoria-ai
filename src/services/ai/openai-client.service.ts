import OpenAI from "openai";
import { GPT_VERSION, OPENAI_API_KEY } from "../../config";
import { IChatMessage } from "../../types/models"; 
import { errorService } from "../error.service";
import { AIError, ExternalAPIError } from "../../types/errors";
import { createReadStream } from "fs";

// Maximum number of retry attempts for API calls
const MAX_RETRIES = 3;
// Base delay in milliseconds for exponential backoff
const BASE_DELAY = 500;

/**
 * Centralized OpenAI client service with retry logic and error handling.
 * This service provides a unified interface for all OpenAI API interactions.
 */
class OpenAIClientService {
    private client: OpenAI;
    
    constructor() {
        this.client = new OpenAI({
            apiKey: OPENAI_API_KEY
        });
    }

    /**
     * Creates a chat completion with automatic retry on transient failures.
     * 
     * @param messages - Array of messages to send to the AI
     * @param options - Additional options for the chat completion
     * @returns The chat completion response
     * @throws AIError - If the API call fails after retries
     */
    async createChatCompletion(
        messages: IChatMessage[],
        options: {
            model?: string;
            temperature?: number;
            max_tokens?: number;
            response_format?: { type: "json_object" } | { type: "text" };
        } = {}
    ) {
        const model = options.model || GPT_VERSION;
        const temperature = options.temperature !== undefined ? options.temperature : 0.7;
        const max_tokens = options.max_tokens || 800;
        const response_format = options.response_format;

        let lastError: Error | null = null;
        
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
                // Add delay for retries based on exponential backoff
                if (attempt > 0) {
                    const delay = BASE_DELAY * Math.pow(2, attempt - 1);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
                
                // Make the API call
                const response = await this.client.chat.completions.create({
                    model,
                    messages: messages as any, // Type conversion needed due to OpenAI SDK
                    temperature,
                    max_tokens,
                    ...(response_format && { response_format })
                });
                
                return response;
            } catch (error: any) {
                lastError = error;
                
                // If this is a permanent error (not related to rate limits or connectivity),
                // don't retry
                const statusCode = error?.status || error?.response?.status;
                if (statusCode && statusCode < 500 && statusCode !== 429) {
                    break;
                }
                
                // Log the retry attempt
                errorService.logError(
                    new AIError(`OpenAI API retry attempt ${attempt + 1} failed`, 
                        { 
                            error: error.message,
                            statusCode,
                            model,
                            temperature,
                            max_tokens
                        },
                        error
                    ),
                    {}, // No additional context
                    attempt < MAX_RETRIES - 1 ? 'warn' : 'error' // Only log as error on last retry
                );
            }
        }
        
        // If we got here, all retry attempts failed
        throw new AIError(
            `Failed to create chat completion after ${MAX_RETRIES} attempts`,
            { lastError: lastError?.message },
            lastError || undefined
        );
    }

    /**
     * Parses the JSON response from OpenAI, handling any parsing errors gracefully.
     * 
     * @param jsonString - JSON string to parse
     * @param defaultValue - Default value to return if parsing fails
     * @returns Parsed JSON object or default value
     */
    parseJsonResponse<T>(jsonString: string, defaultValue: T): T {
        try {
            return JSON.parse(jsonString) as T;
        } catch (error) {
            errorService.logError(
                new AIError(
                    "Failed to parse JSON response from OpenAI",
                    { response: jsonString },
                    error instanceof Error ? error : undefined
                ),
                {},
                'warn'
            );
            return defaultValue;
        }
    }

    /**
     * Transcribes audio content from a file.
     * 
     * @param filePath - Path to the audio file
     * @returns Transcription text
     * @throws AIError - If the transcription fails
     */
    async transcribeAudio(filePath: string): Promise<string> {
        try {
            // Create readable stream
            const fileStream = createReadStream(filePath);
            
            // Make API call with retries
            let lastError: Error | null = null;
            
            for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
                try {
                    // Add delay for retries based on exponential backoff
                    if (attempt > 0) {
                        const delay = BASE_DELAY * Math.pow(2, attempt - 1);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                    
                    const response = await this.client.audio.transcriptions.create({
                        file: fileStream,
                        model: "whisper-1",
                    });
                    
                    return response.text;
                } catch (error: any) {
                    lastError = error;
                    
                    // If this is a permanent error (not related to rate limits or connectivity),
                    // don't retry
                    const statusCode = error?.status || error?.response?.status;
                    if (statusCode && statusCode < 500 && statusCode !== 429) {
                        break;
                    }
                    
                    // Log the retry attempt
                    errorService.logError(
                        new AIError(`Audio transcription retry attempt ${attempt + 1} failed`, 
                            { 
                                error: error.message,
                                statusCode,
                                filePath,
                            },
                            error
                        ),
                        {}, // No additional context
                        attempt < MAX_RETRIES - 1 ? 'warn' : 'error' // Only log as error on last retry
                    );
                }
            }
            
            // If we got here, all retry attempts failed
            throw new AIError(
                `Failed to transcribe audio after ${MAX_RETRIES} attempts`,
                { lastError: lastError?.message, filePath },
                lastError || undefined
            );
        } catch (error) {
            if (error instanceof AIError) {
                throw error; // Re-throw AIErrors
            }
            
            throw new AIError(
                "Failed to transcribe audio",
                { filePath },
                error instanceof Error ? error : undefined
            );
        }
    }

    /**
     * Generates an image using DALL-E.
     * 
     * @param prompt - Text prompt for image generation
     * @returns Generated image URL and revised prompt
     * @throws AIError - If the image generation fails
     */
    async generateImage(prompt: string): Promise<{ url: string; revisedPrompt: string }> {
        try {
            // Make API call with retries
            let lastError: Error | null = null;
            
            for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
                try {
                    // Add delay for retries based on exponential backoff
                    if (attempt > 0) {
                        const delay = BASE_DELAY * Math.pow(2, attempt - 1);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                    
                    const response = await this.client.images.generate({
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
                } catch (error: any) {
                    lastError = error;
                    
                    // If this is a permanent error (not related to rate limits or connectivity),
                    // don't retry
                    const statusCode = error?.status || error?.response?.status;
                    if (statusCode && statusCode < 500 && statusCode !== 429) {
                        break;
                    }
                    
                    // Log the retry attempt
                    errorService.logError(
                        new AIError(`Image generation retry attempt ${attempt + 1} failed`, 
                            { 
                                error: error.message,
                                statusCode,
                                prompt
                            },
                            error
                        ),
                        {}, // No additional context
                        attempt < MAX_RETRIES - 1 ? 'warn' : 'error' // Only log as error on last retry
                    );
                }
            }
            
            // If we got here, all retry attempts failed
            throw new AIError(
                `Failed to generate image after ${MAX_RETRIES} attempts`,
                { lastError: lastError?.message, prompt },
                lastError || undefined
            );
        } catch (error) {
            if (error instanceof AIError) {
                throw error; // Re-throw AIErrors
            }
            
            throw new AIError(
                "Failed to generate image",
                { prompt },
                error instanceof Error ? error : undefined
            );
        }
    }
}

// Export singleton instance
export const openAIService = new OpenAIClientService(); 