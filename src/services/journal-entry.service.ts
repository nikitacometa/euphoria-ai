import { Types } from 'mongoose';
import { IUser, IJournalEntry, IMessage, MessageType, MessageRole } from '../types/models';
import { errorService } from './error.service';
import { DatabaseError } from '../types/errors';
import {
    saveTextMessage,
    saveVoiceMessage,
    saveVideoMessage,
    addMessageToJournalEntry,
    getActiveJournalEntry,
    getJournalEntryById,
    updateJournalEntryFullText as dbUpdateJournalEntryFullText,
    completeJournalEntry as dbCompleteJournalEntry,
    updateJournalEntryQuestions as dbUpdateJournalEntryQuestions,
    createJournalEntry as dbCreateJournalEntry,
    updateJournalEntryAnalysis as dbUpdateJournalEntryAnalysis
} from '../database';
import { JournalEntry } from '../database/models/journal.model';
import { generateJournalQuestions, analyzeJournalEntry } from './ai/journal-ai.service';

/**
 * Wraps service operations with standardized error logging.
 * @param operationName Descriptive name of the operation (e.g., 'create journal entry').
 * @param context Relevant IDs or parameters for error context.
 * @param operation The async function to execute.
 * @returns The result of the operation.
 */
async function handleServiceError<T>(
    operationName: string,
    context: Record<string, any>,
    operation: () => Promise<T>
): Promise<T> {
    try {
        return await operation();
    } catch (error) {
        errorService.logError(
            new DatabaseError(
                `Failed to ${operationName}`,
                context,
                error instanceof Error ? error : undefined
            ),
            {},
            'error'
        );
        throw error;
    }
}

/**
 * Creates a new journal entry for a user
 * @param userId User ID
 * @returns The created journal entry
 */
export async function createEntry(userId: Types.ObjectId): Promise<IJournalEntry> {
    return handleServiceError(
        'create journal entry',
        { userId: userId.toString() },
        () => dbCreateJournalEntry(userId)
    );
}

/**
 * Gets the active journal entry for a user, or creates one if none exists
 * @param userId User ID
 * @returns The active journal entry
 */
export async function getOrCreateActiveEntry(userId: Types.ObjectId): Promise<IJournalEntry> {
    return handleServiceError(
        'get or create active journal entry',
        { userId: userId.toString() },
        async () => {
            const activeEntry = await getActiveJournalEntry(userId);
            
            if (activeEntry) {
                return activeEntry;
            }
            
            return createEntry(userId);
        }
    );
}

/**
 * Gets a journal entry by ID
 * @param entryId Entry ID
 * @returns The journal entry or null if not found
 */
export async function getEntryById(entryId: Types.ObjectId): Promise<IJournalEntry | null> {
    return handleServiceError(
        'get journal entry by ID',
        { entryId: entryId.toString() },
        () => getJournalEntryById(entryId)
    );
}

/**
 * Adds a text message to a journal entry
 * @param userId User ID
 * @param entryId Entry ID
 * @param messageId Telegram message ID
 * @param text Message text
 * @returns Updated journal entry
 */
export async function addTextMessage(
    userId: Types.ObjectId, 
    entryId: Types.ObjectId, 
    messageId: number, 
    text: string
): Promise<IMessage> {
    const context = { userId: userId.toString(), entryId: entryId.toString(), messageId };
    return handleServiceError(
        'add text message',
        context,
        async () => {
            const message = await saveTextMessage(
                userId,
                entryId,
                messageId,
                text,
                MessageRole.USER
            );
            
            await addMessageToJournalEntry(entryId, message._id as Types.ObjectId);
            
            // Increment text message counter
            await JournalEntry.findByIdAndUpdate(
                entryId,
                { $inc: { textMessages: 1 } }
            );
            
            await updateEntryFullText(entryId);
            return message;
        }
    );
}

/**
 * Adds a voice message to a journal entry
 * @param userId User ID
 * @param entryId Entry ID
 * @param messageId Telegram message ID
 * @param fileId Telegram file ID
 * @param filePath Local file path
 * @param transcription Transcription text
 * @returns Updated journal entry
 */
export async function addVoiceMessage(
    userId: Types.ObjectId, 
    entryId: Types.ObjectId, 
    messageId: number,
    fileId: string,
    filePath: string,
    transcription: string
): Promise<IMessage> {
    const context = { userId: userId.toString(), entryId: entryId.toString(), messageId };
    return handleServiceError(
        'add voice message',
        context,
        async () => {
            const message = await saveVoiceMessage(
                userId,
                entryId,
                messageId,
                fileId,
                filePath,
                transcription,
                MessageRole.USER
            );
            
            await addMessageToJournalEntry(entryId, message._id as Types.ObjectId);
            
            // Increment voice message counter
            await JournalEntry.findByIdAndUpdate(
                entryId,
                { $inc: { voiceMessages: 1 } }
            );
            
            await updateEntryFullText(entryId);
            return message;
        }
    );
}

/**
 * Adds a video message to a journal entry
 * @param userId User ID
 * @param entryId Entry ID
 * @param messageId Telegram message ID
 * @param fileId Telegram file ID
 * @param filePath Local file path
 * @param transcription Transcription text
 * @returns Updated journal entry
 */
export async function addVideoMessage(
    userId: Types.ObjectId, 
    entryId: Types.ObjectId, 
    messageId: number,
    fileId: string,
    filePath: string,
    transcription: string
): Promise<IMessage> {
    const context = { userId: userId.toString(), entryId: entryId.toString(), messageId };
    return handleServiceError(
        'add video message',
        context,
        async () => {
            const message = await saveVideoMessage(
                userId,
                entryId,
                messageId,
                fileId,
                filePath,
                transcription,
                MessageRole.USER
            );
            
            await addMessageToJournalEntry(entryId, message._id as Types.ObjectId);
            
            // Increment video message counter
            await JournalEntry.findByIdAndUpdate(
                entryId,
                { $inc: { videoMessages: 1 } }
            );
            
            await updateEntryFullText(entryId);
            return message;
        }
    );
}

/**
 * Updates the full text content of a journal entry based on all its messages
 * @param entryId Entry ID
 * @returns Success status
 */
export async function updateEntryFullText(entryId: Types.ObjectId): Promise<boolean> {
    return handleServiceError(
        'update entry full text',
        { entryId: entryId.toString() },
        async () => {
            // Get the entry with populated messages
            const entry = await getJournalEntryById(entryId);
            if (!entry) {
                return false;
            }
            
            // Ensure messages is treated as an array of IMessage objects
            const messages = (Array.isArray(entry.messages) ? entry.messages : []) as IMessage[];
            
            const fullText = messages
                .map((msg: IMessage) => {
                    if (msg.type === MessageType.TEXT) {
                        return msg.text || '';
                    } else if (msg.type === MessageType.VOICE || msg.type === MessageType.VIDEO) {
                        return msg.transcription || '';
                    }
                    return '';
                })
                .filter(text => text.length > 0)
                .join('\n\n');
            
            await dbUpdateJournalEntryFullText(entryId, fullText);
            return true;
        }
    );
}

/**
 * Completes a journal entry with summary and follow-up question
 * @param entryId Entry ID
 * @param summary Summary text
 * @param question Follow-up question
 * @returns Success status
 */
export async function completeEntry(
    entryId: Types.ObjectId,
    summary: string,
    question: string,
    name?: string,
    keywords?: string[]
): Promise<boolean> {
    return handleServiceError(
        'complete journal entry',
        { entryId: entryId.toString() },
        async () => {
            await dbCompleteJournalEntry(entryId, summary, question, name, keywords);

            const entry = await getEntryById(entryId);
            if (!entry) {
                throw new Error(`Journal entry not found during completion: ${entryId}`);
            }
             if (!entry.user || typeof entry.user === 'string' || !('name' in entry.user)) {
                  throw new Error(`Full user object missing for entry completion AI tasks: ${entryId}`);
             }
            const userObject = entry.user as IUser;

            await generateAndStoreAnalysis(entryId, userObject);
            await generateAndStoreQuestions(entryId, userObject);

            return true;
        }
    );
}

/**
 * Generates follow-up questions for a journal entry
 * @param entryId Entry ID 
 * @param user User object
 * @returns Generated questions
 */
export async function generateQuestionsForEntry(
    entryId: Types.ObjectId,
    user: IUser
): Promise<string[]> {
    try {
        const entry = await getEntryById(entryId);
        if (!entry) {
            return ["What would you like to write about?"];
        }
        
        const questions = await generateJournalQuestions(entry, user);
        await dbUpdateJournalEntryQuestions(entryId, questions);
        
        return questions;
    } catch (error) {
        errorService.logError(
            error instanceof Error ? error : new DatabaseError(
                'Failed to generate questions for journal entry',
                { 
                    entryId: entryId.toString(),
                    userId: user._id?.toString()
                }
            ),
            {},
            'error'
        );
        return ["What else would you like to explore?"];
    }
}

/**
 * Updates a journal entry with analysis and deeper questions
 * @param entryId Entry ID
 * @param analysis Analysis text
 * @param questions Questions array
 * @returns Success status
 */
export async function updateEntryAnalysisAndQuestions(
    entryId: Types.ObjectId,
    analysis: string,
    questions: string[]
): Promise<boolean> {
    return handleServiceError(
        'update entry analysis and questions manually',
        { entryId: entryId.toString() },
        async () => {
            await dbUpdateJournalEntryAnalysis(entryId, analysis);
            await dbUpdateJournalEntryQuestions(entryId, questions);
            return true;
        }
    );
}

/**
 * Checks if an entry exists and belongs to a user
 * @param entryId Entry ID
 * @param userId User ID
 * @returns True if entry exists and belongs to user
 */
export async function validateEntryBelongsToUser(
    entryId: Types.ObjectId,
    userId: Types.ObjectId
): Promise<boolean> {
    return handleServiceError(
        'validate entry ownership',
        { entryId: entryId.toString(), userId: userId.toString() },
        async () => {
            const entry = await getJournalEntryById(entryId);
            if (!entry) {
                throw new DatabaseError('Journal entry not found for validation', { entryId: entryId.toString() });
            }
            const entryUserId = entry.user instanceof Types.ObjectId ? entry.user : (entry.user as IUser)?._id;
            if (!entryUserId || entryUserId.toString() !== userId.toString()) {
                 throw new DatabaseError('Journal entry does not belong to the user', {
                     entryId: entryId.toString(),
                     userId: userId.toString(),
                     entryUserId: entryUserId?.toString() ?? 'undefined'
                 });
            }
            return true;
        }
    );
}

/**
 * Generates and stores analysis for a journal entry using the AI service.
 * @param entryId Entry ID.
 * @param user User object (required by AI service).
 * @returns The generated analysis string.
 * @throws Error if entry not found or analysis fails.
 */
export async function generateAndStoreAnalysis(entryId: Types.ObjectId, user: IUser): Promise<string> {
    const userIdStr = user._id instanceof Types.ObjectId ? user._id.toString() : String(user._id);
    return handleServiceError(
        'generate and store entry analysis',
        { entryId: entryId.toString(), userId: userIdStr },
        async () => {
            const entry = await getEntryById(entryId);
            if (!entry) {
                throw new Error(`Cannot generate analysis for non-existent entry: ${entryId}`);
            }
            await updateEntryFullText(entryId);
            const updatedEntry = await getEntryById(entryId);
             if (!updatedEntry) {
                 throw new Error(`Entry disappeared after full text update: ${entryId}`);
             }

            const analysis = await analyzeJournalEntry(updatedEntry, user);
            await dbUpdateJournalEntryAnalysis(entryId, analysis);
            return analysis;
        }
    );
}

/**
 * Generates and stores reflection questions for a journal entry using the AI service.
 * @param entryId Entry ID.
 * @param user User object (required by AI service).
 * @returns Array of generated questions.
 * @throws Error if entry not found or question generation fails.
 */
export async function generateAndStoreQuestions(entryId: Types.ObjectId, user: IUser): Promise<string[]> {
    const userIdStr = user._id instanceof Types.ObjectId ? user._id.toString() : String(user._id);
    return handleServiceError(
        'generate and store entry questions',
        { entryId: entryId.toString(), userId: userIdStr },
        async () => {
            const entry = await getEntryById(entryId);
            if (!entry) {
                throw new Error(`Cannot generate questions for non-existent entry: ${entryId}`);
            }
            await updateEntryFullText(entryId);
            const updatedEntry = await getEntryById(entryId);
            if (!updatedEntry) {
                throw new Error(`Entry disappeared after full text update: ${entryId}`);
            }

            const questions = await generateJournalQuestions(updatedEntry, user);
            await dbUpdateJournalEntryQuestions(entryId, questions);
            return questions;
        }
    );
}

// Note: Removed the singleton export `journalEntryService = { ... }`
// Consumers should now import the specific functions they need, e.g.:
// import { createEntry, addTextMessage } from './journal-entry.service';
// This promotes better tree-shaking and explicit dependency management.

// Removed original class and its exported instance.
// Removed old internal methods that are now either exported or refactored. 