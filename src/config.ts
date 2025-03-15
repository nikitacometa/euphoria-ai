import * as dotenv from 'dotenv';
import { LogLevel } from './utils/logger';

dotenv.config();

export const TELEGRAM_API_TOKEN = process.env.TELEGRAM_API_TOKEN as string;
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY as string;
export const GPT_VERSION = process.env.GPT_VERSION as string;
export const MONGODB_HOST = process.env.MONGODB_HOST || 'mongodb';
export const MONGODB_PORT = process.env.MONGODB_PORT || '27017';
export const MONGODB_USER = process.env.MONGODB_USER || 'admin';
export const MONGODB_PASSWORD = process.env.MONGODB_PASSWORD || 'password';
export const MONGODB_DATABASE = process.env.MONGODB_DATABASE || 'euphoria';
export const MONGO_EXPRESS_PORT = process.env.MONGO_EXPRESS_PORT || '8081';
export const MONGODB_URI = `mongodb://${MONGODB_USER}:${MONGODB_PASSWORD}@${MONGODB_HOST}:${MONGODB_PORT}/${MONGODB_DATABASE}?authSource=admin`;
export const LOG_LEVEL = process.env.LOG_LEVEL ? 
    parseInt(process.env.LOG_LEVEL) as LogLevel : 
    LogLevel.INFO;