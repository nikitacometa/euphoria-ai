# Journal Bot

A Telegram bot that serves as a personal journal application, allowing users to create entries with text, voice, and video messages, and receive AI-powered insights and analysis.

## Features

- **User Onboarding**: Collects user information (age, gender, religion, occupation) to personalize the journaling experience
- **Journal Entry Creation**: Users can create entries using text, voice messages, and videos
- **Voice Transcription**: Automatically transcribes voice messages for easy reference
- **AI Analysis**: Analyzes journal entries and provides personalized insights
- **Follow-up Questions**: Generates thoughtful questions based on journal entries to encourage deeper reflection
- **Journal History**: View past journal entries with their content and analysis
- **Journal Chat**: Ask questions about your journal entries and receive AI-powered insights

## Technical Stack

- **Framework**: [Grammy.js](https://grammy.dev/) for Telegram bot development
- **Database**: MongoDB with Mongoose for data storage
- **AI Integration**: OpenAI API for text generation, analysis, and audio transcription
- **Language**: TypeScript

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- MongoDB database
- Telegram Bot Token (from [@BotFather](https://t.me/BotFather))
- OpenAI API Key

### Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd journal-bot
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```
   TELEGRAM_API_TOKEN=your_telegram_bot_token
   OPENAI_API_KEY=your_openai_api_key
   MONGODB_URI=your_mongodb_connection_string
   GPT_VERSION=gpt-4o
   LOG_LEVEL=3
   ```

4. Start the bot:
   ```
   npm start
   ```

### Docker Deployment

You can also run the bot using Docker:

```
docker-compose up -d
```

## Usage

1. Start a chat with your bot on Telegram
2. Use the `/start` command to begin
3. Complete the onboarding process by providing your information
4. Use the main menu to create entries, view history, or chat about your journal

## Project Structure

- `src/main.ts`: Entry point for the application
- `src/journal-bot.ts`: Main bot implementation with handlers for all commands and messages
- `src/journal-ai.ts`: AI functions for analyzing journal entries and generating insights
- `src/database/`: Database models and connection logic
  - `models/user.model.ts`: User data model
  - `models/journal.model.ts`: Journal entry data model
  - `models/message.model.ts`: Message data model
- `src/utils/`: Utility functions for logging and command handling

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Grammy.js](https://grammy.dev/) for the Telegram bot framework
- [OpenAI](https://openai.com/) for the AI capabilities
- [Mongoose](https://mongoosejs.com/) for MongoDB object modeling
