import { AIError, AIModel, AIOperation } from '../errors/classes/ai-error';
import { bot } from '../app';

// Skip loading config that requires environment variables 
process.env.SKIP_ENV_VALIDATION = 'true';

// Check if ADMIN_CHAT_ID is set
const adminChatId = process.env.ADMIN_CHAT_ID;

if (!adminChatId) {
  console.error('Error: ADMIN_CHAT_ID environment variable is not set');
  process.exit(1);
}

async function sendTestAlert() {
  try {
    // Create a test error message
    const errorMessage = `🚨 *TEST Admin Alert* 🚨\n\n*Error Type:* AIError\n*Message:* This is a test admin alert\n\n*Stack Trace:*\n\`\`\`\nTest stack trace\n\`\`\`\n\n*Context:*\n\`\`\`json\n{"testDetails":"This is from the direct test script","timestamp":"${new Date().toISOString()}"}\n\`\`\``;
    
    // Escape characters for MarkdownV2
    let escapedMessage = errorMessage.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
    
    console.log('Sending test alert to admin chat...');
    await bot.api.sendMessage(adminChatId as string, escapedMessage, { parse_mode: 'MarkdownV2' });
    console.log('Test alert sent successfully!');
  } catch (error) {
    console.error('Failed to send test alert:', error);
  } finally {
    process.exit(0);
  }
}

sendTestAlert(); 