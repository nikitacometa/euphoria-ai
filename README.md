# Euphoria Telegram Bot

A Telegram bot that can transcribe voice messages and save user messages to a MongoDB database.

## Features

- Transcribe voice messages using OpenAI's Whisper API
- Transcribe audio from video messages using OpenAI's Whisper API
- Save all user messages (text, voice, video, and images) to MongoDB
- View message history with the `/history` command
- Generate images with DALL-E 3 using the `/image` command
- Comprehensive logging system with configurable log levels

## Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file with your Telegram API token and OpenAI API key (see `.env.example`)
4. Start the bot:
   ```
   npm run dev
   ```

## Docker Setup

1. Clone the repository
2. Create a `.env` file with your Telegram API token and OpenAI API key
3. Start the services:
   ```
   docker-compose up -d
   ```

## Database

The bot uses MongoDB to store user data and messages. The database is accessible through:

- MongoDB: `mongodb://admin:password@localhost:27017/euphoria?authSource=admin`
- Mongo Express (web interface): http://localhost:8081

### Database Structure

- **Users**: Stores information about users who interact with the bot
  - `telegramId`: Telegram user ID
  - `firstName`: User's first name
  - `lastName`: User's last name (optional)
  - `username`: User's Telegram username (optional)
  - `createdAt`: When the user was first seen
  - `updatedAt`: When the user was last updated

- **Messages**: Stores all messages sent by users
  - `user`: Reference to the User who sent the message
  - `conversation`: Reference to the Conversation this message belongs to
  - `telegramMessageId`: Telegram message ID
  - `type`: Message type (text, voice, video, or image)
  - `role`: Message role (user or assistant)
  - `text`: Text content (for text messages)
  - `transcription`: Transcribed text (for voice and video messages)
  - `imageUrl`: URL of the generated image (for image messages)
  - `imagePrompt`: Prompt used to generate the image (for image messages)
  - `fileId`: Telegram file ID (for voice and video messages)
  - `filePath`: Telegram file path (for voice and video messages)
  - `createdAt`: When the message was sent
  - `updatedAt`: When the message was last updated

## Commands

- `/start`: Start the bot
- `/chat_id`: Get your chat ID
- `/history`: View your message history
- `/image [prompt]`: Generate an image based on the prompt
- `/log_level [0-5]`: Set the logging level (admin only)

## Logging System

The bot includes a comprehensive logging system with different verbosity levels:

- **0 (NONE)**: No logging
- **1 (ERROR)**: Only errors
- **2 (WARN)**: Errors and warnings
- **3 (INFO)**: Normal logging (default)
- **4 (DEBUG)**: Verbose logging
- **5 (TRACE)**: Most verbose logging

You can set the default log level in the `.env` file:

```
LOG_LEVEL="3"  # INFO level
```

You can also change the log level at runtime using the `/log_level` command:

```
/log_level 4  # Set to DEBUG level
```

The logging system tracks command execution times and provides detailed information about each command's execution.
