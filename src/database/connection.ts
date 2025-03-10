import mongoose from 'mongoose';
import { MONGODB_URI } from '../config';

// Function to connect to MongoDB
export async function connectToDatabase(): Promise<void> {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB successfully');
    } catch (error) {
        console.error('Failed to connect to MongoDB:', error);
        process.exit(1);
    }
}

// Function to disconnect from MongoDB
export async function disconnectFromDatabase(): Promise<void> {
    try {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB successfully');
    } catch (error) {
        console.error('Failed to disconnect from MongoDB:', error);
    }
}

// Handle application termination
process.on('SIGINT', async () => {
    await disconnectFromDatabase();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await disconnectFromDatabase();
    process.exit(0);
}); 