# Euphoria Telegram Bot

A Telegram bot that can transcribe voice messages and save user messages to a MongoDB database.

## Features

- Transcribe voice messages using OpenAI's Whisper API
- Save all user messages (text and voice) to MongoDB
- View message history with the `/history` command

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
  - `telegramMessageId`: Telegram message ID
  - `type`: Message type (text or voice)
  - `text`: Text content (for text messages)
  - `transcription`: Transcribed text (for voice messages)
  - `fileId`: Telegram file ID (for voice messages)
  - `filePath`: Telegram file path (for voice messages)
  - `createdAt`: When the message was sent
  - `updatedAt`: When the message was last updated

## Commands

- `/start`: Start the bot
- `/chat_id`: Get your chat ID
- `/history`: View your message history
