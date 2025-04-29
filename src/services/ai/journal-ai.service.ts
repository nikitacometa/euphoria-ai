import { GPT_VERSION, LOG_LEVEL } from "../../config";
import { IMessage, MessageType, IJournalEntry, IUser, IChatMessage } from "../../types/models";
import { createLogger } from "../../utils/logger";
import { openAIService } from "./openai-client.service";
import { journalPrompts } from "../../config/ai-prompts";
import { AIError } from "../../types/errors";
import { errorService } from "../error.service";

// Create a logger for the journal AI
const journalAiLogger = createLogger('JournalAI', LOG_LEVEL);

/**
 * Extract text content from an entry's messages.
 * @param entry Journal entry with messages
 * @returns Concatenated text content from all messages
 */
function extractContentFromEntry(entry: IJournalEntry): string {
    const messages = entry.messages as IMessage[];
    
    // Use fullText field if available, otherwise extract from messages
    if (entry.fullText) {
        return entry.fullText;
    }
    
    // Extract content from messages
    return messages.map(message => {
        let content = '';
        
        if (message.type === MessageType.TEXT) {
            content = message.text || '';
        } else if (message.type === MessageType.VOICE || message.type === MessageType.VIDEO) {
            content = message.transcription || '';
        }
        
        return content;
    }).filter(content => content.length > 0).join('\n\n');
}

/**
 * Format user information for AI prompts
 * @param user User object
 * @returns Formatted string with user information
 */
function formatUserInfo(user: IUser): string {
    return `User Information:
- Name: ${user.name || user.firstName}
- Age: ${user.age || 'Unknown'}
- Gender: ${user.gender || 'Unknown'}
- Occupation: ${user.occupation || 'Unknown'}
- Bio: ${user.bio || 'Unknown'}`;
}

/**
 * Analyzes a journal entry and generates insights
 */
export async function analyzeJournalEntry(
    entry: IJournalEntry,
    user: IUser
): Promise<string> {
    try {
        const entryContent = extractContentFromEntry(entry);
        
        if (!entryContent) {
            return "Not enough content to analyze.";
        }
        
        // Create prompt for analysis
        const userInfo = formatUserInfo(user);
        const messages: IChatMessage[] = [
            { role: 'system', content: journalPrompts.analysisSystemPrompt },
            { role: 'user', content: `${userInfo}\n\nJournal Entry:\n${entryContent}` }
        ];
        
        // Call OpenAI API through our centralized service
        const response = await openAIService.createChatCompletion(messages, {
            temperature: 0.7,
            max_tokens: 300
        });
        
        return response.choices[0].message.content || "Could not generate insights.";
    } catch (error) {
        // Log the error using our error service
        errorService.logError(
            error instanceof AIError 
                ? error 
                : new AIError(
                    'Error analyzing journal entry', 
                    { entryId: entry._id?.toString(), userId: user._id?.toString() },
                    error instanceof Error ? error : undefined
                ),
            {},
            'error'
        );
        
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
        const entryContent = extractContentFromEntry(entry);
        
        if (!entryContent) {
            return ["What would you like to write about today?"];
        }
        
        // Create prompt for question generation
        const userInfo = formatUserInfo(user);
        const messages: IChatMessage[] = [
            { role: 'system', content: journalPrompts.questionsSystemPrompt },
            { role: 'user', content: `${userInfo}\n\nJournal Entry:\n${entryContent}` }
        ];
        
        // Call OpenAI API through our centralized service
        const response = await openAIService.createChatCompletion(messages, {
            temperature: 0.7,
            max_tokens: 300,
            response_format: { type: "json_object" }
        });
        
        const content = response.choices[0].message.content || "{}";
        
        // Use our helper to parse JSON safely
        const parsedResponse = openAIService.parseJsonResponse(
            content, 
            { questions: ["What else would you like to explore?"] }
        );
        
        return parsedResponse.questions || ["What else would you like to explore?"];
    } catch (error) {
        // Log the error using our error service
        errorService.logError(
            error instanceof AIError 
                ? error 
                : new AIError(
                    'Error generating journal questions', 
                    { entryId: entry._id?.toString(), userId: user._id?.toString() },
                    error instanceof Error ? error : undefined
                ),
            {},
            'error'
        );
        
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
        
        // Prepare entries summary
        const entriesSummary = entries.map((entry, index) => {
            const entryContent = extractContentFromEntry(entry);
            const date = new Date(entry.createdAt).toLocaleDateString();
            return `Entry ${index + 1} (${date}):\n${entryContent}`;
        }).join('\n\n---\n\n');
        
        // Create prompt for insights
        const userInfo = formatUserInfo(user);
        let userPrompt = `${userInfo}\n\nJournal Entries:\n${entriesSummary}\n\n`;
        
        if (question) {
            userPrompt += `Based on these entries, please answer the following question as concisely as possible: ${question}`;
        } else {
            userPrompt += `Please provide a very brief analysis (1-3 sentences) of the most significant patterns or insights from these journal entries.`;
        }
        userPrompt += `format output as html, use paragraphs for each sentense, separating with two newlines, highlight rare only important wrods with <b> for bold, <i> for italic`;
        
        const messages: IChatMessage[] = [
            { role: 'system', content: journalPrompts.insightsSystemPrompt },
            { role: 'user', content: userPrompt }
        ];
        
        // Call OpenAI API through our centralized service
        const response = await openAIService.createChatCompletion(messages, {
            temperature: 0.7,
            max_tokens: 300
        });
        
        return response.choices[0].message.content || "I couldn't find any significant patterns in your entries yet.";
    } catch (error) {
        // Log the error using our error service
        errorService.logError(
            error instanceof AIError 
                ? error 
                : new AIError(
                    'Error generating journal insights', 
                    { 
                        entriesCount: entries.length, 
                        userId: user._id?.toString(),
                        question: question 
                    },
                    error instanceof Error ? error : undefined
                ),
            {},
            'error'
        );
        
        return "Sorry, I encountered an error while analyzing your journal entries.";
    }
} 