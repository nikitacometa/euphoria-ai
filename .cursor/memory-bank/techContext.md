# Technical Context

## Stack Overview
- TypeScript: Main language for development
- Node.js: Runtime environment
- MongoDB: Database with Mongoose ODM
- Telegram Bot API: Core platform for user interaction
- OpenAI API: Used for AI-powered features (transcription, analysis, insights)

## Project Structure
- Feature-based organization with separate directories for different functional areas
- Service-oriented architecture for business logic
- Model-based data access layer
- Error handling architecture with dedicated error classes and middleware
- Configuration management system
- Logging system
- Admin functionality

## Database Models
- User: Stores user profiles, preferences, and notification settings
- JournalEntry: Manages journal entries with their status and metadata
- Message: Handles various message types (text, voice, video)
- Conversation: Manages conversation state and context

## Service Layer
- AI Services:
  - OpenAI integration for text generation, transcription, and analysis
  - Journal-specific AI functionality for entry analysis and question generation
- Journal Entry Service: Manages creation, updating, and retrieval of journal entries
- Notification Service: Handles user notifications and reminders
- Error Service: Centralized error handling and logging

## Feature Modules
- Journal Entry: Handles creation and management of journal entries
- Journal Chat: Manages interactive chat with AI about journal entries
- Journal History: Provides access to past journal entries
- Onboarding: Manages user onboarding process
- Settings: Handles user settings and preferences
- Support: Provides user assistance functionality

## Environment
- Docker support (Dockerfile and docker-compose.yml present)
- Environment variables (.env files)
- Jest for testing

## Key Interfaces
- JournalBotContext: Extended Telegram context with session support
- IUser: User model interface with profile and settings
- IJournalEntry: Journal entry model with messages and metadata
- IMessage: Message model supporting different content types

## Conventions
- Modular feature-based architecture
- Separation of handlers, keyboards, and utilities within features
- Dedicated error handling system
- Service-based business logic
- Model-based data access patterns

---
*This technical context will be updated as more information is gathered about the project's architecture and technologies.* 