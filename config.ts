import * as dotenv from 'dotenv';

dotenv.config();

const TELEGRAM_API_TOKEN = process.env.BOT_TOKEN as string;

export { TELEGRAM_API_TOKEN };
