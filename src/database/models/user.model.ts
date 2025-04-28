import mongoose, { Document, Schema } from 'mongoose';
import { IUser } from '../../types/models'; // Updated import

// User interface
// export interface IUser extends Document { ... } // Removed

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
        },
        // Journal application specific fields
        name: {
            type: String,
            required: false
        },
        age: {
            type: String,
            required: false
        },
        gender: {
            type: String,
            required: false
        },
        occupation: {
            type: String,
            required: false
        },
        bio: {
            type: String,
            required: false
        },
        onboardingCompleted: {
            type: Boolean,
            default: false
        },
        // Notification settings
        notificationsEnabled: {
            type: Boolean,
            default: true
        },
        notificationTime: {
            type: String,
            default: "21:00",
            required: false,
            validate: {
                validator: function(v: string) {
                    if (!v) return true; // Allow empty string
                    return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
                },
                message: props => `${props.value} is not a valid time format! Use HH:mm (24-hour)`
            }
        },
        lastNotificationSent: {
            type: Date,
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
            username,
            onboardingCompleted: false
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

// Journal application specific functions
export async function updateUserProfile(
    telegramId: number,
    updates: Partial<Pick<IUser, 'name' | 'age' | 'gender' | 'occupation' | 'bio' | 'onboardingCompleted' | 'notificationsEnabled' | 'notificationTime'>> // Use Partial<Pick<IUser, ...>> for updates
): Promise<IUser | null> {
    return User.findOneAndUpdate(
        { telegramId },
        { $set: updates },
        { new: true }
    );
}

export async function completeUserOnboarding(
    telegramId: number
): Promise<IUser | null> {
    return User.findOneAndUpdate(
        { telegramId },
        { $set: { onboardingCompleted: true } },
        { new: true }
    );
} 