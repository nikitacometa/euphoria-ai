import mongoose, { Document, Schema, Types } from 'mongoose';
// import { IUser } from './user.model'; // Removed
import { IConversation, IUser } from '../../types/models'; // Added import

// Conversation interface
// export interface IConversation extends Document { ... } // Removed

// Conversation schema
const conversationSchema = new Schema<IConversation>(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        isActive: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true
    }
);

// Conversation model
export const Conversation = mongoose.model<IConversation>('Conversation', conversationSchema);

// Conversation service functions
export async function createConversation(userId: Types.ObjectId): Promise<IConversation> {
    return Conversation.create({
        user: userId,
        isActive: true
    });
}

export async function getActiveConversation(userId: Types.ObjectId): Promise<IConversation | null> {
    return Conversation.findOne({ user: userId, isActive: true }).sort({ createdAt: -1 });
}

export async function endConversation(conversationId: Types.ObjectId): Promise<IConversation | null> {
    return Conversation.findByIdAndUpdate(
        conversationId,
        { isActive: false },
        { new: true }
    );
}

export async function endAllUserConversations(userId: Types.ObjectId): Promise<void> {
    await Conversation.updateMany(
        { user: userId, isActive: true },
        { isActive: false }
    );
}

export async function getConversationsByUser(userId: Types.ObjectId): Promise<IConversation[]> {
    return Conversation.find({ user: userId }).sort({ createdAt: -1 });
} 