import mongoose from 'mongoose';
import { HumanDesignChart } from '../models/human-design-chart.model';
import { User } from '../models/user.model';
import { connectToDatabase, disconnectFromDatabase } from '../connection';
import { logger } from '../../utils/logger';

/**
 * Migration script to create the Human Design charts collection
 * and update the User schema with a reference field
 */
async function migrateDatabase(): Promise<void> {
  try {
    // Connect to the database
    await connectToDatabase();
    logger.info('Connected to database for Human Design migration');

    // Verify Human Design Charts collection
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not established');
    }
    
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    if (!collectionNames.includes('humandesigncharts')) {
      logger.info('Creating Human Design Charts collection');
      
      // Create the collection
      await db.createCollection('humandesigncharts');
      
      // Create the compound index for efficient lookups
      await db.collection('humandesigncharts').createIndex(
        { birthDate: 1, birthTime: 1, birthLocation: 1 },
        { unique: true }
      );
      
      // Create individual indexes for common lookup patterns
      await db.collection('humandesigncharts').createIndex({ birthDate: 1 });
      await db.collection('humandesigncharts').createIndex({ birthLocation: 1 });
      await db.collection('humandesigncharts').createIndex({ profile: 1 });
      await db.collection('humandesigncharts').createIndex({ type: 1 });

      logger.info('Human Design Charts collection created successfully with indexes');
    } else {
      logger.info('Human Design Charts collection already exists');
    }

    logger.info('Migration completed successfully');
  } catch (error) {
    logger.error('Error during Human Design migration:', error);
    throw error;
  } finally {
    // Close the database connection
    await disconnectFromDatabase();
    logger.info('Database connection closed');
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  migrateDatabase()
    .then(() => {
      logger.info('Human Design migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Human Design migration script failed:', error);
      process.exit(1);
    });
}

export default migrateDatabase; 