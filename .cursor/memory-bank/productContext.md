# Product Context

## Application Purpose
Euphoria (also referred to as Infinity Bot) is a Telegram bot that acts as a personal journaling companion. It facilitates self-reflection through text, voice, and video inputs, guided by AI analysis and prompts.

## Core Features
- **Journal Entry System**: Create and manage text, voice, and video journal entries with AI transcription and analysis
- **Journal Chat**: Interactive "Ask My Journal" functionality using AI to analyze past entries and patterns
- **Journal History**: View and browse past journal entries chronologically
- **Onboarding**: Personalized user onboarding process collecting name, age range, gender, etc.
- **Settings**: User preference management including notification settings
- **Support**: Help and support system for users

## Implementation Details

### Journal Entry Creation
- Supports multiple input formats:
  - Text messages: stored directly
  - Voice messages: transcribed using OpenAI and stored with metadata
  - Video messages: audio extracted, transcribed using OpenAI, and stored with metadata
- Messages are collected into journal entries
- Each entry has a status flow: IN_PROGRESS → ANALYZING → COMPLETED
- AI analysis provides insights and suggested follow-up questions
- Users can save entries or request AI-generated questions for further reflection

### Journal AI Features
- Entry analysis: Examines individual journal entries for insights
- Question generation: Creates personalized follow-up questions based on entry content
- Journal pattern analysis: Analyzes multiple entries to identify patterns and provide insights
- Language flexibility: Supports English and Russian responses based on user preference

### User Experience
- Custom keyboards for main navigation
- Inline keyboards for specific actions
- Voice and video transcription with optional display
- Notification system for journaling reminders
- Stateful interactions with session management

## User Flow
1. **Onboarding** (`/start` command for new users):
   - Greeting, name collection (defaults to Telegram first name)
   - Age range collection using `AGE_RANGES` keyboard
   - Gender selection using `GENDER_OPTIONS` keyboard
   - Additional profile information (occupation, bio)
   - Completes onboarding and shows Main Menu

2. **Main Menu**:
   - "📝 New Entry"
   - "📚 Journal History"
   - "🤔 Ask My Journal"
   - "⚙️ Settings"

3. **Journal Entry Creation**:
   - Check for active entry or create new one
   - Accept text, voice, or video input
   - For voice/video: transcribe using AI (OpenAI)
   - Options to save, analyze for questions, or cancel
   - AI processes entry for insights upon completion

4. **Journal History**:
   - Display list of past entries (date + snippet)
   - View full content of selected entries

5. **Journal Chat ("Ask My Journal")**:
   - AI-powered analysis of past journal entries
   - User asks questions about patterns, growth, insights
   - AI generates answers based on journal content

6. **Settings Management**:
   - Toggle notifications on/off
   - Set notification time
   - Return to Main Menu
   - Language selection (English/Russian) for AI responses

7. **Notifications**:
   - Send reminders at user's configured time
   - Include "✅ Share" button to create new entry

## Key Technical Components
- Telegram Bot API for user interaction
- OpenAI API for transcription and AI analysis
- MongoDB for data storage
- Session-based state management for conversation flow
- Prompt engineering for AI interactions

## Technical Context
- Uses session-based state management
- Implements AI services for transcription and analysis
- Database storage for user profiles and journal entries

---
*This product context is based on code examination and app_functionality.md.* 