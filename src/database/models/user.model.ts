import mongoose, { Document, Schema } from 'mongoose';

// User interface
export interface IUser extends Document {
    telegramId: number;
    firstName: string;
    lastName?: string;
    username?: string;
    createdAt: Date;
    updatedAt: Date;
}

// User schema
const userSchema = new Schema<IUser>(
    {
        telegramId: {
            type: Number,
            required: true,
            unique: true,
            index: true
        },
        firstName: {
            type: String,
            required: true
        },
        lastName: {
            type: String,
            required: false
        },
        username: {
            type: String,
            required: false
        }
    },
    {
        timestamps: true
    }
);

// User model
export const User = mongoose.model<IUser>('User', userSchema);

// User service functions
export async function findOrCreateUser(
    telegramId: number,
    firstName: string,
    lastName?: string,
    username?: string
): Promise<IUser> {
    let user = await User.findOne({ telegramId });
    
    if (!user) {
        user = await User.create({
            telegramId,
            firstName,
            lastName,
            username
        });
    }
    
    return user;
}

export async function getUserById(telegramId: number): Promise<IUser | null> {
    return User.findOne({ telegramId });
}

export async function getAllUsers(): Promise<IUser[]> {
    return User.find();
} 