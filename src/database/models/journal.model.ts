import mongoose, { Document, Schema, Types } from 'mongoose';
import { 
    IJournalEntry, 
    JournalEntryStatus, 
    IMessage, 
    IUser 
} from '../../types/models';

// Journal entry status enum
// export enum JournalEntryStatus { ... } // Removed

// Journal entry interface
// export interface IJournalEntry extends Document { ... } // Removed

// Journal entry schema
const journalEntrySchema = new Schema<IJournalEntry>(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        title: {
            type: String,
            required: false
        },
        name: {
            type: String,
            required: false
        },
        keywords: [{
            type: String,
            required: false
        }],
        messages: [{
            type: Schema.Types.ObjectId,
            ref: 'Message'
        }],
        status: {
            type: String,
            enum: Object.values(JournalEntryStatus),
            default: JournalEntryStatus.IN_PROGRESS,
            required: true
        },
        analysis: {
            type: String,
            required: false
        },
        aiQuestions: [{
            type: String,
            required: false
        }],
        aiInsights: {
            type: String,
            required: false
        },
        fullText: {
            type: String,
            required: false
        },
        textMessages: {
            type: Number,
            default: 0,
            required: false
        },
        voiceMessages: {
            type: Number,
            default: 0,
            required: false
        },
        videoMessages: {
            type: Number,
            default: 0,
            required: false
        },
        fileMessages: {
            type: Number,
            default: 0,
            required: false
        },
        // Mood report fields
        isMoodReport: {
            type: Boolean,
            default: false,
            required: false
        },
        moodRating: {
            type: Number,
            min: 1,
            max: 5,
            required: false
        },
        daySuccess: {
            type: String,
            required: false
        },
        sleepHours: {
            type: String,
            required: false
        }
    },
    {
        timestamps: true
    }
);

// Journal entry model
export const JournalEntry = mongoose.model<IJournalEntry>('JournalEntry', journalEntrySchema);

// Journal entry service functions
export async function createJournalEntry(userId: Types.ObjectId): Promise<IJournalEntry> {
    return JournalEntry.create({
        user: userId,
        status: JournalEntryStatus.IN_PROGRESS,
        messages: []
    });
}

export async function getJournalEntryById(entryId: Types.ObjectId): Promise<IJournalEntry | null> {
    return JournalEntry.findById(entryId).populate('user').populate('messages');
}

export async function getActiveJournalEntry(userId: Types.ObjectId): Promise<IJournalEntry | null> {
    return JournalEntry.findOne({ 
        user: userId, 
        status: { $in: [JournalEntryStatus.IN_PROGRESS, JournalEntryStatus.ANALYZING, JournalEntryStatus.ASKING_QUESTIONS] } 
    }).sort({ createdAt: -1 }).populate('messages');
}

export async function addMessageToJournalEntry(
    entryId: Types.ObjectId,
    messageId: Types.ObjectId
): Promise<IJournalEntry | null> {
    return JournalEntry.findByIdAndUpdate(
        entryId,
        { $push: { messages: messageId } },
        { new: true }
    );
}

export async function updateJournalEntryStatus(
    entryId: Types.ObjectId,
    status: JournalEntryStatus
): Promise<IJournalEntry | null> {
    return JournalEntry.findByIdAndUpdate(
        entryId,
        { $set: { status } },
        { new: true }
    );
}

export async function updateJournalEntryAnalysis(
    entryId: Types.ObjectId,
    analysis: string
): Promise<IJournalEntry | null> {
    return JournalEntry.findByIdAndUpdate(
        entryId,
        { $set: { analysis } },
        { new: true }
    );
}

export async function updateJournalEntryQuestions(
    entryId: Types.ObjectId,
    questions: string[]
): Promise<IJournalEntry | null> {
    return JournalEntry.findByIdAndUpdate(
        entryId,
        { $set: { aiQuestions: questions } },
        { new: true }
    );
}

export async function updateJournalEntryInsights(
    entryId: Types.ObjectId,
    insights: string
): Promise<IJournalEntry | null> {
    return JournalEntry.findByIdAndUpdate(
        entryId,
        { $set: { aiInsights: insights } },
        { new: true }
    );
}

export async function completeJournalEntry(
    entryId: Types.ObjectId,
    analysis: string,
    insights: string,
    name?: string,
    keywords?: string[]
): Promise<IJournalEntry | null> {
    const updateData: any = { 
        status: JournalEntryStatus.COMPLETED,
        analysis,
        aiInsights: insights
    };
    
    if (name) {
        updateData.name = name;
    }
    
    if (keywords && keywords.length > 0) {
        updateData.keywords = keywords;
    }
    
    return JournalEntry.findByIdAndUpdate(
        entryId,
        { $set: updateData },
        { new: true }
    );
}

export async function getUserJournalEntries(userId: Types.ObjectId): Promise<IJournalEntry[]> {
    return JournalEntry.find({ 
        user: userId,
        status: JournalEntryStatus.COMPLETED
    }).sort({ createdAt: -1 });
}

export async function getAllJournalEntries(): Promise<IJournalEntry[]> {
    return JournalEntry.find().sort({ createdAt: -1 }).populate('user');
}

export async function updateJournalEntryFullText(
    entryId: Types.ObjectId,
    fullText: string
): Promise<IJournalEntry | null> {
    return JournalEntry.findByIdAndUpdate(
        entryId,
        { $set: { fullText } },
        { new: true }
    );
}

/**
 * Deletes a specific journal entry by its ID.
 * @param entryId - The ID of the journal entry to delete.
 * @returns True if the entry was deleted, false otherwise.
 */
export async function deleteJournalEntry(entryId: Types.ObjectId): Promise<boolean> {
    const result = await JournalEntry.deleteOne({ _id: entryId });
    return result.deletedCount === 1;
} 