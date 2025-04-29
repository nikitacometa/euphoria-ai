import * as dotenv from 'dotenv';
import { LogLevel } from './utils/logger';

dotenv.config();

export const TELEGRAM_API_TOKEN = process.env.TELEGRAM_API_TOKEN as string;
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY as string;
export const GPT_VERSION = process.env.GPT_VERSION as string;
export const MONGODB_HOST = process.env.MONGODB_HOST;
export const MONGODB_PORT = process.env.MONGODB_PORT;
export const MONGODB_USER = process.env.MONGODB_USER;
export const MONGODB_PASSWORD = process.env.MONGODB_PASSWORD;
export const MONGODB_DATABASE = process.env.MONGODB_DATABASE;
export const MONGO_EXPRESS_PORT = process.env.MONGO_EXPRESS_PORT;
export const MONGODB_URI = MONGODB_PASSWORD ? 
    `mongodb://${MONGODB_USER}:${MONGODB_PASSWORD}@${MONGODB_HOST}:${MONGODB_PORT}/${MONGODB_DATABASE}?authSource=admin` 
  : `mongodb://${MONGODB_HOST}:${MONGODB_PORT}/${MONGODB_DATABASE}`;
export const LOG_LEVEL = process.env.LOG_LEVEL ?
    parseInt(process.env.LOG_LEVEL) as LogLevel :
    LogLevel.INFO;
export const MAX_VOICE_MESSAGE_LENGTH_SECONDS = process.env.MAX_VOICE_MESSAGE_LENGTH_SECONDS ?
    parseInt(process.env.MAX_VOICE_MESSAGE_LENGTH_SECONDS) : 300; // 5 minutes