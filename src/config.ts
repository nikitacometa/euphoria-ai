import * as dotenv from 'dotenv';

dotenv.config();

export const TELEGRAM_API_TOKEN = process.env.TELEGRAM_API_TOKEN as string;
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY as string;
export const GPT_VERSION = process.env.GPT_VERSION as string;
export const MONGODB_URI = process.env.MONGODB_URI as string;