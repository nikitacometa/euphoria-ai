// Simple test script to send admin alerts directly via the Telegram API
// Run with: node test-admin-alert.js

const https = require('https');

// Configuration
// Get token from env and strip any quotes
let API_TOKEN = process.env.TELEGRAM_API_TOKEN || '';
API_TOKEN = API_TOKEN.replace(/["']/g, ''); // Remove quotes if present

const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '-4752628212'; // Admin chat ID

if (!API_TOKEN) {
  console.error('❌ Error: TELEGRAM_API_TOKEN not set');
  console.error('Run with: TELEGRAM_API_TOKEN=your_token node test-admin-alert.js');
  process.exit(1);
}

console.log(`🔄 Sending test alert to chat ID: ${ADMIN_CHAT_ID}`);
console.log(`🔄 Using token: ${API_TOKEN.substring(0, 10)}...`);

// Prepare message data
const message = {
  chat_id: ADMIN_CHAT_ID,
  text: `🚨 *TEST Admin Alert* 🚨\n\nThis is a test admin alert to verify the alerting system.\n\n*Timestamp:* ${new Date().toISOString()}`,
  parse_mode: 'Markdown'
};

const data = JSON.stringify(message);

// Prepare request options
const options = {
  hostname: 'api.telegram.org',
  port: 443,
  path: `/bot${API_TOKEN}/sendMessage`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

console.log(`🔄 Sending request to: https://${options.hostname}${options.path}`);

// Send request
const req = https.request(options, (res) => {
  console.log(`🔄 Response status: ${res.statusCode}`);
  
  let responseData = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    try {
      const parsedData = JSON.parse(responseData);
      if (parsedData.ok) {
        console.log('✅ Test alert sent successfully!');
      } else {
        console.error('❌ Error sending alert:', parsedData.description);
      }
    } catch (e) {
      console.error('❌ Error parsing response:', e.message);
      console.log('Raw response:', responseData);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error sending request:', error.message);
});

// Send the data
req.write(data);
req.end(); 