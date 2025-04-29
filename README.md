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

Run the bot using Docker:

```
docker-compose up -d
```

This setup includes:
- Hot-reloading for development (local files are mounted into the container)
- MongoDB database
- Mongo Express web interface for database management

For production deployment, you can simply remove the volume mounts from the docker-compose.yml file or use:

```
docker-compose up -d --build bot
```

## Usage

1. Start a chat with your bot on Telegram
2. Use the `/start` command to begin
3. Complete the onboarding process by providing your information
4. Use the main menu to create entries, view history, or chat about your journal

## Project Structure

The project follows a modular architecture with clear separation of concerns:

- `src/index.ts`: Entry point for the application
- `src/app/`: Core application components
  - `index.ts`: Application initialization and bot setup
  - `bot.ts`: Bot instance creation and configuration
  - `feature-registry.ts`: Registration of all feature handlers
- `src/features/`: Feature modules
  - `core/`: Core bot functionality (start, cancel commands)
  - `journal-entry/`: Journal entry creation and management
  - `journal-history/`: Browsing and viewing past entries
  - `journal-chat/`: AI chat about journal insights
  - `settings/`: User preferences and notification settings
  - `onboarding/`: User onboarding process
- `src/services/`: Business logic services
  - `ai/`: AI services for text generation and analysis
    - `openai-client.service.ts`: OpenAI API client with retry logic
    - `journal-ai.service.ts`: Journal-specific AI functions
    - `openai.service.ts`: General OpenAI service functions
  - `error.service.ts`: Centralized error handling 
  - `journal-entry.service.ts`: Journal entry business logic
  - `notification.service.ts`: Scheduled notifications
- `src/config/`: Configuration management
  - `index.ts`: Environment variables and app configuration
  - `ai-prompts.ts`: AI system prompts and templates
- `src/database/`: Database models and connection logic
  - `models/`: Mongoose schemas and models
  - `index.ts`: Database connection and operations
- `src/types/`: TypeScript type definitions
  - `session.ts`: Bot session types
  - `models.ts`: Database model interfaces
  - `errors.ts`: Error type definitions
- `src/utils/`: Utility functions and helpers

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Grammy.js](https://grammy.dev/) for the Telegram bot framework
- [OpenAI](https://openai.com/) for the AI capabilities
- [Mongoose](https://mongoosejs.com/) for MongoDB object modeling

# Environment Variables

The following environment variables need to be set:

## Required Variables
- `TELEGRAM_API_TOKEN`: Your Telegram Bot API token
- `OPENAI_API_KEY`: Your OpenAI API key
- `GPT_VERSION`: GPT model version to use (e.g., "gpt-4")

## MongoDB Configuration
- `MONGODB_HOST`: MongoDB host (default: "mongodb")
- `MONGODB_PORT`: MongoDB port (default: "27017")
- `MONGODB_USER`: MongoDB username (default: "admin")
- `MONGODB_PASSWORD`: MongoDB password (default: "password")
- `MONGODB_DATABASE`: MongoDB database name (default: "euphoria")
- `MONGO_EXPRESS_PORT`: Mongo Express web interface port (default: "8081")

## Optional Variables
- `LOG_LEVEL`: Logging level (default: INFO)
