import OpenAI from "openai";
import { GPT_VERSION, OPENAI_API_KEY } from "./config";
import { IMessage, MessageRole, MessageType } from "./database/models/message.model";
import { IJournalEntry } from "./database/models/journal.model";
import { IUser } from "./database/models/user.model";
import { createLogger, LogLevel } from "./utils/logger";
import { LOG_LEVEL } from "./config";

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
        const systemPrompt = `You are an empathetic and insightful journal analysis assistant. 
Your task is to analyze the user's journal entry and provide thoughtful insights.
Focus on identifying emotional patterns, recurring themes, and potential areas for personal growth.
Be supportive, non-judgmental, and constructive in your analysis.

Format your response as 5 concise bullet points that highlight the most important observations.
Each bullet point should be 1-2 sentences maximum and start with "• ".
Focus on different aspects of the entry such as emotions, patterns, insights, strengths, and growth areas.`;

        const userInfo = `User Information:
- Age: ${user.age || 'Unknown'}
- Gender: ${user.gender || 'Unknown'}
- Religion: ${user.religion || 'Unknown'}
- Occupation: ${user.occupation || 'Unknown'}`;

        const chatMessages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `${userInfo}\n\nJournal Entry:\n${entryContent}\n\nPlease analyze this journal entry and provide 5 key insights as bullet points.` }
        ];
        
        // Call OpenAI API
        const response = await openai.chat.completions.create({
            model: GPT_VERSION,
            messages: chatMessages,
            temperature: 0.7,
            max_tokens: 600
        });
        
        return response.choices[0].message.content || "Unable to generate analysis.";
    } catch (error) {
        journalAiLogger.error('Error analyzing journal entry:', error);
        return "Sorry, I encountered an error while analyzing your journal entry.";
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
        const systemPrompt = `You are an empathetic and insightful journal assistant. 
Your task is to generate 3-5 thoughtful follow-up questions based on the user's journal entry.
These questions should help the user explore their thoughts and feelings more deeply.
The questions should be open-ended, non-judgmental, and encourage reflection.
Each question should be directly related to the content of their journal entry.
Format your response as a JSON object with a "questions" array containing the questions as strings.
Example format: {"questions": ["Question 1?", "Question 2?", "Question 3?"]}`;

        const userInfo = `User Information:
- Age: ${user.age || 'Unknown'}
- Gender: ${user.gender || 'Unknown'}
- Religion: ${user.religion || 'Unknown'}
- Occupation: ${user.occupation || 'Unknown'}`;

        const chatMessages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `${userInfo}\n\nJournal Entry:\n${entryContent}\n\nPlease generate 3-5 thoughtful follow-up questions.` }
        ];
        
        // Call OpenAI API
        const response = await openai.chat.completions.create({
            model: GPT_VERSION,
            messages: chatMessages,
            temperature: 0.7,
            max_tokens: 500,
            response_format: { type: "json_object" }
        });
        
        const content = response.choices[0].message.content || "{}";
        
        try {
            const parsedResponse = JSON.parse(content);
            
            // Check if questions array exists and has items
            if (parsedResponse.questions && Array.isArray(parsedResponse.questions) && parsedResponse.questions.length > 0) {
                return parsedResponse.questions;
            }
            
            // If no valid questions array, log and return default questions
            journalAiLogger.warn('No valid questions array in response:', content);
            return [
                "What emotions came up for you while writing this entry?",
                "How does this experience connect to other aspects of your life?",
                "What insights or lessons can you take from this experience?"
            ];
        } catch (e) {
            journalAiLogger.error('Error parsing questions JSON:', e);
            journalAiLogger.error('Raw content:', content);
            
            // Return default questions if parsing fails
            return [
                "What else would you like to share about this experience?", 
                "How did this make you feel?", 
                "What insights have you gained from this experience?"
            ];
        }
    } catch (error) {
        journalAiLogger.error('Error generating journal questions:', error);
        return [
            "What else would you like to share?", 
            "How are you feeling about this?", 
            "Is there anything more you'd like to explore?"
        ];
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
            return "You don't have any journal entries yet. Start journaling to receive insights!";
        }
        
        // Prepare entries summary
        const entriesSummary = entries.map((entry, index) => {
            const messages = entry.messages as IMessage[];
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
            }).filter(content => content.length > 0).join('\n');
            
            const date = new Date(entry.createdAt).toLocaleDateString();
            return `Entry ${index + 1} (${date}):\n${entryContent}`;
        }).join('\n\n---\n\n');
        
        // Create prompt for insights
        const systemPrompt = `You are an empathetic and insightful journal analysis assistant. 
Your task is to analyze the user's journal entries and provide thoughtful insights.
Focus on identifying patterns, recurring themes, emotional trends, and potential areas for personal growth.
Be supportive, non-judgmental, and constructive in your analysis.
Provide a concise response (3-5 paragraphs) that highlights key observations and offers gentle guidance.`;

        const userInfo = `User Information:
- Age: ${user.age || 'Unknown'}
- Gender: ${user.gender || 'Unknown'}
- Religion: ${user.religion || 'Unknown'}
- Occupation: ${user.occupation || 'Unknown'}`;

        let userPrompt = `${userInfo}\n\nJournal Entries:\n${entriesSummary}\n\n`;
        
        if (question) {
            userPrompt += `Based on these entries, please answer the following question: ${question}`;
        } else {
            userPrompt += `Please analyze these journal entries and provide insights.`;
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
            max_tokens: 1000
        });
        
        return response.choices[0].message.content || "Unable to generate insights.";
    } catch (error) {
        journalAiLogger.error('Error generating journal insights:', error);
        return "Sorry, I encountered an error while generating insights from your journal entries.";
    }
} 