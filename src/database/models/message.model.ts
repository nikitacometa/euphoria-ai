import mongoose, { Document, Schema, Types } from 'mongoose';
import { IUser } from './user.model';
import { IConversation } from './conversation.model';

// Message type enum
export enum MessageType {
    TEXT = 'text',
    VOICE = 'voice',
    IMAGE = 'image',
    VIDEO = 'video'
}

// Message role enum
export enum MessageRole {
    USER = 'user',
    ASSISTANT = 'assistant'
}

// Message interface
export interface IMessage extends Document {
    user: Types.ObjectId | IUser;
    conversation: Types.ObjectId | IConversation;
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

// Message schema
const messageSchema = new Schema<IMessage>(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        conversation: {
            type: Schema.Types.ObjectId,
            ref: 'Conversation',
            required: true,
            index: true
        },
        telegramMessageId: {
            type: Number,
            required: true
        },
        type: {
            type: String,
            enum: Object.values(MessageType),
            required: true
        },
        role: {
            type: String,
            enum: Object.values(MessageRole),
            required: true
        },
        text: {
            type: String,
            required: false
        },
        transcription: {
            type: String,
            required: false
        },
        imageUrl: {
            type: String,
            required: false
        },
        imagePrompt: {
            type: String,
            required: false
        },
        fileId: {
            type: String,
            required: false
        },
        filePath: {
            type: String,
            required: false
        }
    },
    {
        timestamps: true
    }
);

// Create a compound index for user and telegramMessageId
messageSchema.index({ user: 1, telegramMessageId: 1 }, { unique: true });

// Message model
export const Message = mongoose.model<IMessage>('Message', messageSchema);

// Message service functions
export async function saveTextMessage(
    userId: Types.ObjectId,
    conversationId: Types.ObjectId,
    telegramMessageId: number,
    text: string,
    role: MessageRole = MessageRole.USER
): Promise<IMessage> {
    return Message.create({
        user: userId,
        conversation: conversationId,
        telegramMessageId,
        type: MessageType.TEXT,
        role,
        text
    });
}

export async function saveVoiceMessage(
    userId: Types.ObjectId,
    conversationId: Types.ObjectId,
    telegramMessageId: number,
    fileId: string,
    filePath: string,
    transcription: string,
    role: MessageRole = MessageRole.USER
): Promise<IMessage> {
    return Message.create({
        user: userId,
        conversation: conversationId,
        telegramMessageId,
        type: MessageType.VOICE,
        role,
        fileId,
        filePath,
        transcription
    });
}

export async function saveImageMessage(
    userId: Types.ObjectId,
    conversationId: Types.ObjectId,
    telegramMessageId: number,
    imageUrl: string,
    imagePrompt: string,
    role: MessageRole = MessageRole.ASSISTANT
): Promise<IMessage> {
    return Message.create({
        user: userId,
        conversation: conversationId,
        telegramMessageId,
        type: MessageType.IMAGE,
        role,
        imageUrl,
        imagePrompt
    });
}

export async function saveVideoMessage(
    userId: Types.ObjectId,
    conversationId: Types.ObjectId,
    telegramMessageId: number,
    fileId: string,
    filePath: string,
    transcription: string,
    role: MessageRole = MessageRole.USER
): Promise<IMessage> {
    return Message.create({
        user: userId,
        conversation: conversationId,
        telegramMessageId,
        type: MessageType.VIDEO,
        role,
        fileId,
        filePath,
        transcription
    });
}

export async function getMessagesByUser(userId: Types.ObjectId): Promise<IMessage[]> {
    return Message.find({ user: userId }).sort({ createdAt: -1 }).populate('user');
}

export async function getMessagesByConversation(conversationId: Types.ObjectId): Promise<IMessage[]> {
    return Message.find({ conversation: conversationId }).sort({ createdAt: 1 });
}

export async function getLastImageMessageByConversation(conversationId: Types.ObjectId): Promise<IMessage | null> {
    return Message.findOne({ 
        conversation: conversationId, 
        type: MessageType.IMAGE 
    }).sort({ createdAt: -1 });
}

export async function getMessageById(messageId: string): Promise<IMessage | null> {
    return Message.findById(messageId).populate('user');
}

export async function getAllMessages(): Promise<IMessage[]> {
    return Message.find().sort({ createdAt: -1 }).populate('user');
} 