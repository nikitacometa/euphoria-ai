import mongoose, { Document, Schema, Types } from 'mongoose';
import { IUser } from './user.model';

// Message type enum
export enum MessageType {
    TEXT = 'text',
    VOICE = 'voice'
}

// Message interface
export interface IMessage extends Document {
    user: Types.ObjectId | IUser;
    telegramMessageId: number;
    type: MessageType;
    text?: string;
    transcription?: string;
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
        telegramMessageId: {
            type: Number,
            required: true
        },
        type: {
            type: String,
            enum: Object.values(MessageType),
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
    telegramMessageId: number,
    text: string
): Promise<IMessage> {
    return Message.create({
        user: userId,
        telegramMessageId,
        type: MessageType.TEXT,
        text
    });
}

export async function saveVoiceMessage(
    userId: Types.ObjectId,
    telegramMessageId: number,
    fileId: string,
    filePath: string,
    transcription: string
): Promise<IMessage> {
    return Message.create({
        user: userId,
        telegramMessageId,
        type: MessageType.VOICE,
        fileId,
        filePath,
        transcription
    });
}

export async function getMessagesByUser(userId: Types.ObjectId): Promise<IMessage[]> {
    return Message.find({ user: userId }).sort({ createdAt: -1 }).populate('user');
}

export async function getMessageById(messageId: string): Promise<IMessage | null> {
    return Message.findById(messageId).populate('user');
}

export async function getAllMessages(): Promise<IMessage[]> {
    return Message.find().sort({ createdAt: -1 }).populate('user');
} 