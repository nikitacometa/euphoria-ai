import { Telegram } from 'grammy';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables manually
const envPath = process.env.NODE_ENV === 'production' ? '.env.prod' : '.env';
const envFilePath = path.resolve(process.cwd(), envPath);

if (fs.existsSync(envFilePath)) {
  dotenv.config({ path: envFilePath });
  console.log(`Loaded env from ${envFilePath}`);
} else {
  console.warn(`Environment file ${envFilePath} not found`);
}

// Get Telegram token from environment
const telegramToken = process.env.TELEGRAM_API_TOKEN;
const adminChatId = process.env.ADMIN_CHAT_ID;

if (!telegramToken) {
  console.error('TELEGRAM_API_TOKEN is not set in environment variables');
  process.exit(1);
}

if (!adminChatId) {
  console.error('ADMIN_CHAT_ID is not set in environment variables');
  process.exit(1);
}

console.log(`Using admin chat ID: ${adminChatId}`);

// Create a Telegram API client directly
const telegram = new Telegram(telegramToken);

async function sendTestAlert() {
  try {
    // Create a test error message
    const errorMessage = `🚨 *TEST Admin Alert* 🚨\n\n*Error Type:* AIError\n*Message:* This is a direct test admin alert\n\n*Stack Trace:*\n\`\`\`\nTest stack trace\n\`\`\`\n\n*Context:*\n\`\`\`json\n{"testDetails":"This is from the direct test script","timestamp":"${new Date().toISOString()}"}\n\`\`\``;
    
    // Escape characters for MarkdownV2
    let escapedMessage = errorMessage.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
    
    console.log('Sending test alert to admin chat...');
    const result = await telegram.sendMessage(adminChatId, escapedMessage, { parse_mode: 'MarkdownV2' });
    console.log('Test alert sent successfully!', result.message_id);
  } catch (error) {
    console.error('Failed to send test alert:', error);
  } finally {
    process.exit(0);
  }
}

sendTestAlert(); 