# Euphoria Bot - Technical Context

## Architecture Overview
The Euphoria bot is built with a modular architecture featuring:
- A core bot framework built on Grammy
- Feature-specific modules for different bot capabilities
- Service-oriented design for cross-cutting concerns
- Database models for persistent storage
- Error handling and logging infrastructure

## Codebase Organization
- `src/app`: Bot initialization and configuration
- `src/features`: Feature-specific handlers and logic
  - `core`: Core bot functionality
  - `journal-entry`: Journal creation and management
  - `journal-history`: Journal browsing and search
  - `journal-chat`: AI-powered chat about journals
  - `onboarding`: User registration and setup
  - `settings`: User preferences management
- `src/database`: Database connection and models
- `src/services`: Cross-cutting services (AI, notifications)
- `src/utils`: Utility functions and helpers
- `src/commands`: Bot command handlers
- `src/errors`: Error handling and reporting
- `src/admin`: Admin panel functionality

## Key Features Technical Implementation

### Bot Framework
- Uses Grammy as the Telegram bot framework
- Implements context-based session management
- Features middleware for request handling and logging

### Database Models
- User model: Stores user profiles and preferences
- Journal model: Stores journal entries and metadata
- Message model: Stores individual messages within entries
- Human Design model: Stores Human Design chart data

### AI Integration
- Transcription service for voice and video messages
- Journal analysis for insights and suggested questions
- Conversation capabilities for journal-based chat
- Human Design interpretation

### Feature Implementation
- Feature-specific handlers registered with the bot
- Each feature has dedicated handlers, keyboards, and utilities
- Command system for user interaction
- Session-based state management for multi-step processes

### Human Design Integration
- API service for Human Design chart generation
- Timezone lookup by location
- Caching mechanism for chart data
- Command interfaces for user interaction

## Technical Challenges
- Managing complex conversation flows
- Integrating with external APIs
- Handling voice and video transcription
- Providing personalized AI analysis
- Efficient database queries for journal history
- Rate limiting and error handling
- Notification scheduling and delivery

## Future Technical Considerations
- Scaling the notification system
- Enhancing AI prompt engineering
- Implementing advanced search capabilities
- Optimizing database queries
- Adding analytics and usage metrics
- Supporting additional languages
- Implementing advanced security features 