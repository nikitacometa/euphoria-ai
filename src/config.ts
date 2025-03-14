import * as dotenv from 'dotenv';
import { LogLevel } from './utils/logger';

dotenv.config();

// MongoDB Configuration
const MONGODB_HOST = process.env.MONGODB_HOST || 'mongodb';
const MONGODB_PORT = process.env.MONGODB_PORT || '27017';
const MONGODB_USER = process.env.MONGODB_USER || 'admin';
const MONGODB_PASSWORD = process.env.MONGODB_PASSWORD || 'password';
const MONGODB_DATABASE = process.env.MONGODB_DATABASE || 'euphoria';

export const MONGODB_URI = process.env.MONGODB_URI || 
    `mongodb://${MONGODB_USER}:${MONGODB_PASSWORD}@${MONGODB_HOST}:${MONGODB_PORT}/${MONGODB_DATABASE}?authSource=admin`;

export const TELEGRAM_API_TOKEN = process.env.TELEGRAM_API_TOKEN as string;
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY as string;
export const GPT_VERSION = process.env.GPT_VERSION as string;
export const LOG_LEVEL = process.env.LOG_LEVEL ? 
    parseInt(process.env.LOG_LEVEL) as LogLevel : 
    LogLevel.INFO;