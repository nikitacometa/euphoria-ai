import { Document, Schema, Types } from 'mongoose';

// --- User Model ---
export interface IUser extends Document {
    telegramId: number;
    firstName: string;
    lastName?: string;
    username?: string;
    name?: string; // Preferred name
    age?: string;
    gender?: string;
    occupation?: string;
    bio?: string;
    onboardingCompleted?: boolean;
    notificationsEnabled?: boolean;
    notificationTime?: string; // Format: "HH:mm" (24-hour) in UTC timezone
    timezone?: string; // IANA timezone format, e.g., 'America/New_York'
    lastNotificationSent?: Date;
    lastNotificationAttempt?: Date; // Tracks when notification was last attempted
    lastNotificationError?: string; // Stores error message from last failed notification
    nextNotificationScheduledAt?: Date; // Stores the timestamp for the next scheduled notification
    showTranscriptions?: boolean; // Whether to show transcription texts to the user
    aiLanguage?: string; // 'en' or 'ru' for AI interactions
    createdAt: Date;
    updatedAt: Date;
}

// --- OpenAI Chat Interface ---
export interface IChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

// --- Message Model ---
export enum MessageType {
    TEXT = 'text',
    VOICE = 'voice',
    IMAGE = 'image',
    VIDEO = 'video'
}

export enum MessageRole {
    USER = 'user',
    ASSISTANT = 'assistant'
}

// Forward declaration needed if IConversation is also moved here later
// For now, keep it simple and assume IConversation stays in its file or is imported where needed
// If IConversation is frequently used alongside these, consider moving it here too.
// import { IConversation } from '../database/models/conversation.model'; // Example if needed

export interface IMessage extends Document {
    user: Types.ObjectId | IUser;
    // conversation: Types.ObjectId | IConversation; // Keep if IConversation not moved
    conversation: Types.ObjectId | any; // Use any for now, replace if IConversation is moved/imported
    telegramMessageId: number;
    type: MessageType;
    role: MessageRole;
    text?: string;
    transcription?: string;
    imageUrl?: string;
    imagePrompt?: string;
    fileId?: string;
    filePath?: string;
    createdAt: Date;
    updatedAt: Date;
}


// --- Journal Model ---
export enum JournalEntryStatus {
    IN_PROGRESS = 'in_progress',
    ANALYZING = 'analyzing',
    ASKING_QUESTIONS = 'asking_questions',
    COMPLETED = 'completed'
}

export interface IJournalEntry extends Document {
    user: Types.ObjectId | IUser;
    title?: string;
    name?: string; // New field: catchy name for the entry (max 20 chars)
    keywords?: string[]; // New field: keywords/tags for the entry
    messages: Types.ObjectId[] | IMessage[];
    status: JournalEntryStatus;
    analysis?: string;
    aiQuestions?: string[];
    aiInsights?: string;
    fullText?: string;
    textMessages?: number; // Count of text messages
    voiceMessages?: number; // Count of voice messages
    videoMessages?: number; // Count of video messages
    fileMessages?: number; // Count of file messages
    createdAt: Date;
    updatedAt: Date;
}

// --- Conversation Model ---
// If you decide to move IConversation here, add it below:
export interface IConversation extends Document {
    user: Types.ObjectId | IUser;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
} 