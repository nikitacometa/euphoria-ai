import OpenAI from "openai";
import { GPT_VERSION, OPENAI_API_KEY, LOG_LEVEL } from "../../config";
import { IMessage, MessageType, IJournalEntry, IUser } from "../../types/models";
import { createLogger } from "../../utils/logger";

// Create a logger for the journal AI
const journalAiLogger = createLogger('JournalAI', LOG_LEVEL);

const openai = new OpenAI({
    apiKey: OPENAI_API_KEY
});

interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

/**
 * Analyzes a journal entry and generates insights
 */
export async function analyzeJournalEntry(
    entry: IJournalEntry,
    user: IUser
): Promise<string> {
    try {
        const messages = entry.messages as IMessage[];
        
        // Prepare messages for analysis
        const entryContent = messages.map(message => {
            let content = '';
            
            if (message.type === MessageType.TEXT) {
                content = message.text || '';
            } else if (message.type === MessageType.VOICE) {
                content = message.transcription || '';
            } else if (message.type === MessageType.VIDEO) {
                content = message.transcription || '';
            }
            
            return content;
        }).filter(content => content.length > 0).join('\n\n');
        
        if (!entryContent) {
            return "Not enough content to analyze.";
        }
        
        // Create prompt for analysis
        const systemPrompt = `You are a warm, empathetic, and insightful journal assistant with a friendly personality.
Your task is to analyze the user's journal entry and provide the 3 most important insights.
Focus on identifying emotional patterns, recurring themes, and potential areas for personal growth.
Be supportive, non-judgmental, and constructive in your analysis.
Your tone should be conversational, warm, and slightly playful - like a smart friend who gives great advice.

Format your response as 3 concise bullet points that highlight only the most important observations.
Each bullet point should be 1 sentence maximum and start with "• ".
Focus on the most significant aspects: core emotions, key patterns, and main insights.`;

        const userInfo = `User Information:
- Name: ${user.name || user.firstName}
- Age: ${user.age || 'Unknown'}
- Gender: ${user.gender || 'Unknown'}
- Occupation: ${user.occupation || 'Unknown'}
- Bio: ${user.bio || 'Unknown'}`;

        const chatMessages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `${userInfo}\n\nJournal Entry:\n${entryContent}` }
        ];
        
        // Call OpenAI API
        const response = await openai.chat.completions.create({
            model: GPT_VERSION,
            messages: chatMessages,
            temperature: 0.7,
            max_tokens: 300
        });
        
        return response.choices[0].message.content || "Could not generate insights.";
    } catch (error) {
        journalAiLogger.error('Error analyzing journal entry:', error);
        return "Sorry, I encountered an error while analyzing your entry.";
    }
}

/**
 * Generates follow-up questions based on a journal entry
 */
export async function generateJournalQuestions(
    entry: IJournalEntry,
    user: IUser
): Promise<string[]> {
    try {
        const messages = entry.messages as IMessage[];
        
        // Prepare messages for question generation
        const entryContent = messages.map(message => {
            let content = '';
            
            if (message.type === MessageType.TEXT) {
                content = message.text || '';
            } else if (message.type === MessageType.VOICE) {
                content = message.transcription || '';
            } else if (message.type === MessageType.VIDEO) {
                content = message.transcription || '';
            }
            
            return content;
        }).filter(content => content.length > 0).join('\n\n');
        
        if (!entryContent) {
            return ["What would you like to write about today?"];
        }
        
        // Create prompt for question generation
        const systemPrompt = `You are a warm, empathetic, and insightful journal assistant with a friendly personality.
Your task is to generate 2-3 thoughtful follow-up questions based on the user's journal entry.
These questions should help the user explore their thoughts and feelings more deeply.
The questions should be open-ended, non-judgmental, and encourage reflection.
Each question should be directly related to the content of their journal entry.
Make each question very concise and short (maximum 10 words).
Your tone should be conversational, warm, and slightly playful - like a smart friend who asks great questions.
Focus on the most significant aspects of the entry to create meaningful questions.
Format your response as a JSON object with a "questions" array containing the questions as strings.
Example format: {"questions": ["How did that make you feel?", "What would you do differently?"]}`;

        const userInfo = `User Information:
- Name: ${user.name || user.firstName}
- Age: ${user.age || 'Unknown'}
- Gender: ${user.gender || 'Unknown'}
- Occupation: ${user.occupation || 'Unknown'}
- Bio: ${user.bio || 'Unknown'}`;

        const chatMessages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `${userInfo}\n\nJournal Entry:\n${entryContent}` }
        ];
        
        // Call OpenAI API
        const response = await openai.chat.completions.create({
            model: GPT_VERSION,
            messages: chatMessages,
            temperature: 0.7,
            max_tokens: 300,
            response_format: { type: "json_object" }
        });
        
        const content = response.choices[0].message.content || "{}";
        let parsedResponse;
        
        try {
            parsedResponse = JSON.parse(content);
        } catch (error) {
            journalAiLogger.error('Error parsing JSON response:', error);
            return ["What else would you like to explore?"];
        }
        
        return parsedResponse.questions || ["What else would you like to explore?"];
    } catch (error) {
        journalAiLogger.error('Error generating journal questions:', error);
        return ["What else would you like to explore?"];
    }
}

/**
 * Generates insights based on multiple journal entries
 */
export async function generateJournalInsights(
    entries: IJournalEntry[],
    user: IUser,
    question?: string
): Promise<string> {
    try {
        if (entries.length === 0) {
            return `${user.name || user.firstName}, you don't have any journal entries yet. Let's start journaling so I can provide you with insights!`;
        }
        
        // Prepare entries summary using fullText field if available
        const entriesSummary = entries.map((entry, index) => {
            // Use fullText field if available, otherwise extract from messages
            let entryContent = entry.fullText || '';
            
            if (!entryContent) {
                const messages = entry.messages as IMessage[];
                entryContent = messages.map(message => {
                    let content = '';
                    
                    if (message.type === MessageType.TEXT) {
                        content = message.text || '';
                    } else if (message.type === MessageType.VOICE) {
                        content = message.transcription || '';
                    } else if (message.type === MessageType.VIDEO) {
                        content = message.transcription || '';
                    }
                    
                    return content;
                }).filter(content => content.length > 0).join('\n');
            }
            
            const date = new Date(entry.createdAt).toLocaleDateString();
            return `Entry ${index + 1} (${date}):\n${entryContent}`;
        }).join('\n\n---\n\n');
        
        // Create prompt for insights
        const systemPrompt = `You are a warm, empathetic, and insightful journal analysis assistant with a friendly personality.
Your task is to analyze the user's journal entries and provide a concise, focused answer to their question.
Focus on identifying patterns, recurring themes, emotional trends, and potential areas for personal growth.
Be supportive, non-judgmental, and constructive in your analysis.
Your tone should be conversational, warm, and slightly playful - like a smart friend who gives great advice.

Your response should be as short as possible (1-3 sentences) while still being helpful and insightful.
If the journal entries don't contain enough information to answer the user's question confidently, 
clearly state this fact and suggest what kind of information would be needed.
Do not make up information or provide generic advice if the data is insufficient.`;

        const userInfo = `User Information:
- Name: ${user.name || user.firstName}
- Age: ${user.age || 'Unknown'}
- Gender: ${user.gender || 'Unknown'}
- Occupation: ${user.occupation || 'Unknown'}
- Bio: ${user.bio || 'Unknown'}`;

        let userPrompt = `${userInfo}\n\nJournal Entries:\n${entriesSummary}\n\n`;
        
        if (question) {
            userPrompt += `Based on these entries, please answer the following question as concisely as possible: ${question}`;
        } else {
            userPrompt += `Please provide a very brief analysis (1-3 sentences) of the most significant patterns or insights from these journal entries.`;
        }
        
        const chatMessages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ];
        
        // Call OpenAI API
        const response = await openai.chat.completions.create({
            model: GPT_VERSION,
            messages: chatMessages,
            temperature: 0.7,
            max_tokens: 300
        });
        
        return response.choices[0].message.content || "I couldn't find any significant patterns in your entries yet.";
    } catch (error) {
        journalAiLogger.error('Error generating journal insights:', error);
        return "Sorry, I encountered an error while analyzing your journal entries.";
    }
} 