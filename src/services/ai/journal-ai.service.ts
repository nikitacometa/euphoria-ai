import { GPT_VERSION, LOG_LEVEL } from "../../config";
import { journalPrompts } from "../../config/ai-prompts";
import { Types } from 'mongoose';
import { IMessage, MessageType, IJournalEntry, IUser, IChatMessage, JournalEntryStatus } from "../../types/models";
import { createLogger } from "../../utils/logger";
import { openAIService } from "./openai-client.service";
import { AIError } from "../../types/errors";
import { errorService } from "../error.service";
import { JournalEntry } from '../../database/models/journal.model';

const journalAiLogger = createLogger('JournalAI', LOG_LEVEL);

// Interface for the full analysis result
export interface FullAnalysisResult {
    summary: string;
    questions: string[];
    name?: string; 
    keywords?: string[];
    rawAnalysis?: string; // Optional: if we want to store the direct AI summary separately
    insights?: string; // Optional: if insights are generated separately from summary
}

/**
 * Extract text content from an entry's messages for AI processing.
 * @param entry Journal entry with messages
 * @returns Concatenated text content from all messages
 */
function extractContentFromEntry(entry: IJournalEntry): string {
    const messages = entry.messages as IMessage[];
    if (entry.fullText && entry.messages.length === 0) { // Prefer fullText if messages are empty (e.g. re-analysis of old entry)
        return entry.fullText;
    }
    // Otherwise, always reconstruct from messages to ensure freshness for re-analysis
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
 */
function formatUserInfo(user: IUser): string {
    return `User Information:\n- Name: ${user.name || user.firstName}\n- Age: ${user.age || 'Unknown'}\n- Gender: ${user.gender || 'Unknown'}\n- Occupation: ${user.occupation || 'Unknown'}\n- Bio: ${user.bio || 'Unknown'}`;
}

/**
 * Performs a comprehensive analysis of a journal entry, 
 * similar to the one done when an entry is completed.
 * This includes summary, questions, title (name), and keywords.
 */
export async function performFullEntryAnalysis(
    entry: IJournalEntry,
    user: IUser
): Promise<FullAnalysisResult> {
    try {
        const entryContent = extractContentFromEntry(entry);
        if (!entryContent) {
            return {
                summary: "Entry is empty. No analysis performed.",
                questions: ["What would you like to write about today?"],
                name: entry.name || "Untitled Entry",
                keywords: entry.keywords || []
            };
        }

        const userInfo = formatUserInfo(user);
        const languageInstruction = user.aiLanguage === 'ru' ? 
            '\nPlease respond in Russian language. Ensure the output is a valid JSON object with keys: summary, question, name, keywords.' :
            '\nPlease respond in English language. Ensure the output is a valid JSON object with keys: summary, question, name, keywords.';

        const messages: IChatMessage[] = [
            { role: 'system', content: journalPrompts.completionSystemPrompt + languageInstruction },
            { role: 'user', content: `${userInfo}\n\nJournal Entry Content:\n${entryContent}\n\nProvide summary, a single reflective question, a concise entry name (max 5 words), and 3-5 keywords.` }
        ];

        const response = await openAIService.createChatCompletion(messages, {
            temperature: 0.7,
            max_tokens: 500,
            response_format: { type: "json_object" }
        });

        const rawApiResponseContent = response.choices[0].message.content || "{}";
        const parsedResponse = openAIService.parseJsonResponse(
            rawApiResponseContent,
            { 
                summary: "Thank you for sharing.", 
                question: "What stood out to you?", // Expecting a single question string now
                name: "Journal Entry",
                keywords: ["journal", "entry"]
            }
        );

        // Ensure questions is always an array, even if AI gives a single string
        const questionsArray = Array.isArray(parsedResponse.question) 
            ? parsedResponse.question 
            : (parsedResponse.question ? [parsedResponse.question] : ["What stood out to you?"]);

        return {
            summary: parsedResponse.summary || "Analysis summary unavailable.",
            questions: questionsArray,
            name: parsedResponse.name || entry.name || "Untitled Entry",
            keywords: parsedResponse.keywords || entry.keywords || [],
            rawAnalysis: rawApiResponseContent // Store for debugging or alternative use
        };
    } catch (error) {
        errorService.logError(
            error instanceof AIError 
                ? error 
                : new AIError(
                    'Error performing full entry analysis', 
                    { entryId: entry._id?.toString() || 'unknown_entry_id', userId: user._id?.toString() || 'unknown_user_id' }, // Fallback for undefined IDs
                    error instanceof Error ? error : undefined
                ),
            {},
            'error'
        );
        return {
            summary: "Sorry, an error occurred during analysis.",
            questions: ["How does this make you feel?"],
            name: entry.name || "Error in Analysis",
            keywords: entry.keywords || ["error"]
        };
    }
}

/**
 * Updates the journal entry in the database with the new analysis results.
 * @param entryId The ID of the journal entry to update.
 * @param analysisResult The result from performFullEntryAnalysis.
 * @returns The updated journal entry or null if an error occurred.
 */
export async function updateEntryWithAnalysis(
    entryId: Types.ObjectId, 
    analysisResult: FullAnalysisResult
): Promise<IJournalEntry | null> {
    try {
        const updateData: Partial<IJournalEntry> = {
            analysis: analysisResult.summary, // Main summary goes into 'analysis'
            aiQuestions: analysisResult.questions,
            aiInsights: analysisResult.insights || analysisResult.summary, // Use summary if no specific insights
            name: analysisResult.name,
            keywords: analysisResult.keywords,
            // Optionally update status if re-analysis implies it's re-completed
            // status: JournalEntryStatus.COMPLETED 
        };

        // Update fullText separately if it was regenerated (extractContentFromEntry might be called by performFullEntryAnalysis)
        // const entry = await getJournalEntryById(entryId);
        // if(entry) { // This could be added if performFullEntryAnalysis doesn't use entry.fullText directly always
        //    const currentFullText = extractContentFromEntry(entry);
        //    if(currentFullText) updateData.fullText = currentFullText; 
        // }

        const updatedEntry = await JournalEntry.findByIdAndUpdate(
            entryId,
            { $set: updateData },
            { new: true }
        ).populate('messages').populate('user'); // Ensure user is populated for next steps if needed
        
        return updatedEntry;
    } catch (error) {
        errorService.logError(
            error instanceof AIError 
                ? error 
                : new AIError(
                    'Error updating entry with analysis results', 
                    // For error context, stringify part of the result or indicate its presence
                    { entryId: entryId.toString(), analysisSummary: analysisResult.summary?.substring(0,50) || 'N/A' }, 
                    error instanceof Error ? error : undefined
                ),
            {},
            'error'
        );
        return null;
    }
}

// Existing functions analyzeJournalEntry, generateJournalQuestions, generateJournalInsights can remain
// or be deprecated/refactored if performFullEntryAnalysis covers all their use cases.
// For re-analysis, performFullEntryAnalysis is the primary function.

export async function analyzeJournalEntry(
    entry: IJournalEntry,
    user: IUser
): Promise<string> {
    // This function can now be a simplified version or call performFullEntryAnalysis
    // For now, keeping its original logic for existing call sites if any.
    // ... (original implementation as read previously)
    try {
        const entryContent = extractContentFromEntry(entry);
        if (!entryContent) return "Not enough content to analyze.";
        const userInfo = formatUserInfo(user);
        const languageInstruction = user.aiLanguage === 'ru' ? '\nPlease respond in Russian language.' : '\nPlease respond in English language.';
        const messages: IChatMessage[] = [
            { role: 'system', content: journalPrompts.analysisSystemPrompt + languageInstruction },
            { role: 'user', content: `${userInfo}\n\nJournal Entry:\n${entryContent}` }
        ];
        const response = await openAIService.createChatCompletion(messages, { temperature: 0.7, max_tokens: 300 });
        return response.choices[0].message.content || "Could not generate insights.";
    } catch (error) {
        errorService.logError( error instanceof AIError ? error : new AIError('Error analyzing journal entry', { entryId: entry._id?.toString()|| 'unknown_entry_id', userId: user._id?.toString()|| 'unknown_user_id' }, error instanceof Error ? error : undefined), {}, 'error');
        return "Sorry, I encountered an error while analyzing your entry.";
    }
}

export async function generateJournalQuestions(
    entry: IJournalEntry,
    user: IUser
): Promise<string[]> {
    // This function can now be a simplified version or call performFullEntryAnalysis
    // For now, keeping its original logic for existing call sites if any.
    // ... (original implementation as read previously)
    try {
        const entryContent = extractContentFromEntry(entry);
        if (!entryContent) return ["What would you like to write about today?"];
        const userInfo = formatUserInfo(user);
        const languageInstruction = user.aiLanguage === 'ru' ? '\nPlease respond in Russian language.' : '\nPlease respond in English language.';
        const messages: IChatMessage[] = [
            { role: 'system', content: journalPrompts.questionsSystemPrompt + languageInstruction },
            { role: 'user', content: `${userInfo}\n\nJournal Entry:\n${entryContent}` }
        ];
        const response = await openAIService.createChatCompletion(messages, { temperature: 0.7, max_tokens: 300, response_format: { type: "json_object" } });
        const content = response.choices[0].message.content || "{}";
        const parsedResponse = openAIService.parseJsonResponse( content, { questions: ["What else would you like to explore?"] });
        return parsedResponse.questions || ["What else would you like to explore?"];
    } catch (error) {
        errorService.logError( error instanceof AIError ? error : new AIError('Error generating journal questions', { entryId: entry._id?.toString()|| 'unknown_entry_id', userId: user._id?.toString()|| 'unknown_user_id' }, error instanceof Error ? error : undefined), {}, 'error');
        return ["What else would you like to explore?"];
    }
}

export async function generateJournalInsights(
    entries: IJournalEntry[],
    user: IUser,
    question?: string
): Promise<string> {
    // This function analyzes MULTIPLE entries, so it's different from performFullEntryAnalysis
    // It can remain as is.
    // ... (original implementation as read previously)
    try {
        if (entries.length === 0) return `${user.name || user.firstName}, you don\'t have any journal entries yet. Let\'s start journaling so I can provide you with insights!`;
        const entriesSummary = entries.map((entry, index) => { const entryContent = extractContentFromEntry(entry); const date = new Date(entry.createdAt).toLocaleDateString(); return `Entry ${index + 1} (${date}):\n${entryContent}`; }).join('\n\n---\n\n');
        const userInfo = formatUserInfo(user);
        let userPrompt = `${userInfo}\n\nJournal Entries:\n${entriesSummary}\n\n`;
        if (question) { userPrompt += `Based on these entries, please answer the following question as concisely as possible: ${question}`; } else { userPrompt += `Please provide a very brief analysis (1-3 sentences) of the most significant patterns or insights from these journal entries.`; }
        userPrompt += `format output as html, use paragraphs for each sentense, separating with two newlines, highlight rare only important wrods with <b> for bold, <i> for italic`;
        const languageInstruction = user.aiLanguage === 'ru' ? '\nPlease respond in Russian language.' : '\nPlease respond in English language.';
        const messages: IChatMessage[] = [
            { role: 'system', content: journalPrompts.insightsSystemPrompt + languageInstruction },
            { role: 'user', content: userPrompt }
        ];
        const response = await openAIService.createChatCompletion(messages, { temperature: 0.7, max_tokens: 300 });
        return response.choices[0].message.content || "I couldn\'t find any significant patterns in your entries yet.";
    } catch (error) {
        errorService.logError( error instanceof AIError ? error : new AIError('Error generating journal insights', { entriesCount: entries.length.toString(), userId: user._id?.toString() || 'unknown_user_id', question: question || 'N/A' }, error instanceof Error ? error : undefined), {}, 'error');
        return "Sorry, I encountered an error while analyzing your journal entries.";
    }
} 