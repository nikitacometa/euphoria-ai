import { Types } from 'mongoose';
import { IUser, IJournalEntry, IMessage, MessageType, MessageRole } from '../types/models';
import { logger } from '../utils/logger';
import { errorService } from './error.service';
import { DatabaseError } from '../types/errors';
import {
    saveTextMessage,
    saveVoiceMessage,
    saveVideoMessage,
    addMessageToJournalEntry,
    getActiveJournalEntry,
    getJournalEntryById,
    updateJournalEntryFullText,
    completeJournalEntry,
    updateJournalEntryQuestions,
    createJournalEntry,
    updateJournalEntryAnalysis
} from '../database';
import { generateJournalQuestions, analyzeJournalEntry } from './ai/journal-ai.service';

/**
 * Service handling all business logic related to journal entries.
 */
class JournalEntryService {
    /**
     * Creates a new journal entry for a user
     * @param userId User ID
     * @returns The created journal entry
     */
    async createEntry(userId: Types.ObjectId): Promise<IJournalEntry> {
        try {
            return await createJournalEntry(userId);
        } catch (error) {
            errorService.logError(
                new DatabaseError(
                    'Failed to create journal entry',
                    { userId: userId.toString() },
                    error instanceof Error ? error : undefined
                ),
                {},
                'error'
            );
            throw error;
        }
    }

    /**
     * Gets the active journal entry for a user, or creates one if none exists
     * @param userId User ID
     * @returns The active journal entry
     */
    async getOrCreateActiveEntry(userId: Types.ObjectId): Promise<IJournalEntry> {
        try {
            const activeEntry = await getActiveJournalEntry(userId);
            
            if (activeEntry) {
                return activeEntry;
            }
            
            return await this.createEntry(userId);
        } catch (error) {
            errorService.logError(
                new DatabaseError(
                    'Failed to get or create active journal entry',
                    { userId: userId.toString() },
                    error instanceof Error ? error : undefined
                ),
                {},
                'error'
            );
            throw error;
        }
    }

    /**
     * Gets a journal entry by ID
     * @param entryId Entry ID
     * @returns The journal entry or null if not found
     */
    async getEntryById(entryId: Types.ObjectId): Promise<IJournalEntry | null> {
        try {
            return await getJournalEntryById(entryId);
        } catch (error) {
            errorService.logError(
                new DatabaseError(
                    'Failed to get journal entry by ID',
                    { entryId: entryId.toString() },
                    error instanceof Error ? error : undefined
                ),
                {},
                'error'
            );
            throw error;
        }
    }

    /**
     * Adds a text message to a journal entry
     * @param userId User ID
     * @param entryId Entry ID
     * @param messageId Telegram message ID
     * @param text Message text
     * @returns Updated journal entry
     */
    async addTextMessage(
        userId: Types.ObjectId, 
        entryId: Types.ObjectId, 
        messageId: number, 
        text: string
    ): Promise<IMessage> {
        try {
            const message = await saveTextMessage(
                userId,
                entryId,
                messageId,
                text,
                MessageRole.USER
            );
            
            await addMessageToJournalEntry(entryId, message._id as Types.ObjectId);
            
            // Update full text after adding a message
            await this.updateEntryFullText(entryId);
            
            return message;
        } catch (error) {
            errorService.logError(
                new DatabaseError(
                    'Failed to add text message to journal entry',
                    { 
                        userId: userId.toString(),
                        entryId: entryId.toString(),
                        messageId
                    },
                    error instanceof Error ? error : undefined
                ),
                {},
                'error'
            );
            throw error;
        }
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
    async addVoiceMessage(
        userId: Types.ObjectId, 
        entryId: Types.ObjectId, 
        messageId: number,
        fileId: string,
        filePath: string,
        transcription: string
    ): Promise<IMessage> {
        try {
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
            
            // Update full text after adding a message
            await this.updateEntryFullText(entryId);
            
            return message;
        } catch (error) {
            errorService.logError(
                new DatabaseError(
                    'Failed to add voice message to journal entry',
                    { 
                        userId: userId.toString(),
                        entryId: entryId.toString(),
                        messageId
                    },
                    error instanceof Error ? error : undefined
                ),
                {},
                'error'
            );
            throw error;
        }
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
    async addVideoMessage(
        userId: Types.ObjectId, 
        entryId: Types.ObjectId, 
        messageId: number,
        fileId: string,
        filePath: string,
        transcription: string
    ): Promise<IMessage> {
        try {
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
            
            // Update full text after adding a message
            await this.updateEntryFullText(entryId);
            
            return message;
        } catch (error) {
            errorService.logError(
                new DatabaseError(
                    'Failed to add video message to journal entry',
                    { 
                        userId: userId.toString(),
                        entryId: entryId.toString(),
                        messageId
                    },
                    error instanceof Error ? error : undefined
                ),
                {},
                'error'
            );
            throw error;
        }
    }

    /**
     * Updates the full text content of a journal entry based on all its messages
     * @param entryId Entry ID
     * @returns Success status
     */
    async updateEntryFullText(entryId: Types.ObjectId): Promise<boolean> {
        try {
            const entry = await getJournalEntryById(entryId);
            if (!entry) {
                return false;
            }
            
            const messages = entry.messages as IMessage[];
            const fullText = messages.map(message => {
                if (message.type === MessageType.TEXT) {
                    return message.text || '';
                } else if (message.type === MessageType.VOICE || message.type === MessageType.VIDEO) {
                    return message.transcription || '';
                }
                return '';
            }).filter(text => text.length > 0).join('\n\n');
            
            await updateJournalEntryFullText(entryId, fullText);
            return true;
        } catch (error) {
            errorService.logError(
                new DatabaseError(
                    'Failed to update journal entry full text',
                    { entryId: entryId.toString() },
                    error instanceof Error ? error : undefined
                ),
                {},
                'error'
            );
            return false;
        }
    }

    /**
     * Completes a journal entry with summary and follow-up question
     * @param entryId Entry ID
     * @param summary Summary text
     * @param question Follow-up question
     * @returns Success status
     */
    async completeEntry(
        entryId: Types.ObjectId,
        summary: string,
        question: string
    ): Promise<boolean> {
        try {
            await completeJournalEntry(entryId, summary, question);
            return true;
        } catch (error) {
            errorService.logError(
                new DatabaseError(
                    'Failed to complete journal entry',
                    { 
                        entryId: entryId.toString(),
                        summary,
                        question
                    },
                    error instanceof Error ? error : undefined
                ),
                {},
                'error'
            );
            return false;
        }
    }

    /**
     * Generates follow-up questions for a journal entry
     * @param entryId Entry ID 
     * @param user User object
     * @returns Generated questions
     */
    async generateQuestionsForEntry(
        entryId: Types.ObjectId,
        user: IUser
    ): Promise<string[]> {
        try {
            const entry = await getJournalEntryById(entryId);
            if (!entry) {
                return ["What would you like to write about?"];
            }
            
            const questions = await generateJournalQuestions(entry, user);
            await updateJournalEntryQuestions(entryId, questions);
            
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
    async updateEntryAnalysisAndQuestions(
        entryId: Types.ObjectId,
        analysis: string,
        questions: string[]
    ): Promise<boolean> {
        try {
            await updateJournalEntryAnalysis(entryId, analysis);
            await updateJournalEntryQuestions(entryId, questions);
            return true;
        } catch (error) {
            errorService.logError(
                new DatabaseError(
                    'Failed to update journal entry analysis and questions',
                    { 
                        entryId: entryId.toString(),
                        analysisLength: analysis.length,
                        questionsCount: questions.length
                    },
                    error instanceof Error ? error : undefined
                ),
                {},
                'error'
            );
            return false;
        }
    }

    /**
     * Checks if an entry exists and belongs to a user
     * @param entryId Entry ID
     * @param userId User ID
     * @returns True if entry exists and belongs to user
     */
    async validateEntryBelongsToUser(
        entryId: Types.ObjectId,
        userId: Types.ObjectId
    ): Promise<boolean> {
        try {
            const entry = await getJournalEntryById(entryId);
            if (!entry) {
                return false;
            }
            
            // Check if the entry belongs to the user
            const entryUserId = entry.user instanceof Types.ObjectId 
                ? entry.user.toString() 
                : (entry.user as any)._id?.toString();
                
            return entryUserId === userId.toString();
        } catch (error) {
            errorService.logError(
                new DatabaseError(
                    'Failed to validate journal entry ownership',
                    { 
                        entryId: entryId.toString(),
                        userId: userId.toString()
                    },
                    error instanceof Error ? error : undefined
                ),
                {},
                'error'
            );
            return false;
        }
    }
}

// Export singleton instance
export const journalEntryService = new JournalEntryService(); 