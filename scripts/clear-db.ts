import { MongoClient } from 'mongodb';
import { createLogger, LogLevel } from '../src/utils/logger';

const logger = createLogger('ClearDB', LogLevel.INFO);

async function clearDatabase() {
    const url = 'mongodb://localhost:27017';
    const dbName = 'journal_bot';
    
    try {
        logger.info('Connecting to MongoDB...');
        const client = await MongoClient.connect(url);
        const db = client.db(dbName);
        
        logger.info('Getting collections...');
        const collections = await db.listCollections().toArray();
        
        logger.info('Collections found:', collections.map(c => c.name).join(', '));
        
        // Clear each collection
        for (const collection of collections) {
            logger.info(`Clearing collection: ${collection.name}`);
            await db.collection(collection.name).deleteMany({});
        }
        
        logger.info('✨ Database cleared successfully! ✨');
        await client.close();
        process.exit(0);
    } catch (error) {
        logger.error('Failed to clear database:', error);
        process.exit(1);
    }
}

// Run the script
clearDatabase(); 