# Task: Refactor Bot Interactions and Entry Handling

## Complexity
Level: 3
Type: Feature

## Description
This task involves several updates across different features to improve user interaction flow, AI analysis quality and formatting, and journal entry metadata storage and display.

- **Keyboard Changes:** Remove transcription/AI thoughts keyboards, update post-save, AI chat, and history view keyboards.
- **AI Interaction:** Improve AI analysis formatting (both prompt and saving), enhance AI's ability to answer questions about entries.
- **Database:** Add fields to track message types per entry.
- **Display:** Show message type counts in entry history summaries.

## Technology Stack
- Framework: Telegraf
- Language: TypeScript
- AI Service: OpenAI API
- Database: MongoDB/Mongoose

## Technology Validation Checkpoints
- [x] Project initialization command verified (Existing project)
- [x] Required dependencies identified and installed (Existing project)
- [x] Build configuration validated (Existing project)
- [x] Hello world verification completed (Existing project)
- [x] Test build passes successfully

## Status
- [x] Initialization complete
- [x] Planning complete
- [x] Technology validation complete
- [x] Implementation Phase 1: Database Schema & Migration
- [x] Implementation Phase 2: Update Entry Creation/Update Logic
- [x] Implementation Phase 3: Keyboard Removals & Modifications
- [x] Implementation Phase 4: AI Prompt & Formatting Updates
- [x] Implementation Phase 5: Update Entry Summary Display Logic
- [x] Implementation Phase 6: Testing & Verification
- [x] Implementation Complete

## Implementation Details

### 1. Database Schema Update
- [x] Updated `IJournalEntry` interface in `src/types/models.ts`
- [x] Added fields: `textMessages`, `voiceMessages`, `videoMessages`, `fileMessages` to the Mongoose schema
- [x] Implemented counter incrementing in `src/services/journal-entry.service.ts` for each message type

### 2. Entry Logic Update
- [x] Modified message handlers to increment the appropriate counters when messages are added
- [x] Updated `addTextMessage`, `addVoiceMessage`, and `addVideoMessage` functions to track message types

### 3. Keyboard Modifications
- [x] Removed transcription keyboard from replies by updating `sendTranscriptionReply`
- [x] Removed "AI Thoughts" button from the `journalActionKeyboard`
- [x] Removed keyboards from progress messages (sand clock emoji)
- [x] Updated post-save entry keyboard with "📝 One More Entry", "📚 Manage Entries", "💭 Discuss With AI", "⚙️ Settings"
- [x] Updated AI chat keyboard to "✅ Save As New Entry", "🍌 Menu"
- [x] Updated history view keyboard to show 3 buttons per row and changed "Main Menu" to "🍌 Menu"
- [x] Added specialized `aiAnalysisKeyboard` with "✅ Just Save", "💭 More Insights", "❌ Cancel Entry"
- [x] Improved new entry prompt message with better instructions

### 4. AI Interaction & Formatting
- [x] Modified AI prompts to format summaries as single-sentence points separated by double newlines
- [x] Added `formatAsSummaryBullets` function to convert AI responses to bullet points
- [x] Enhanced `insightsSystemPrompt` to better handle entries with minimal data
- [x] Improved formatting for entry completion with entry name, summary, and hashtag keywords
- [x] Modified question formatting to be more concise

### 5. Entry Summary Display
- [x] Implemented concise message count format (e.g., `[T:5 V:1 F:2]`)
- [x] Simplified entry status message to focus on the main prompt

## Challenges & Solutions
- **Challenge:** Identifying all code locations for keyboard generation/handling.
  - **Solution:** Used code search for keyboard-related functions and systematically reviewed feature directories.
- **Challenge:** Ensuring AI prompt changes consistently produce the desired format.
  - **Solution:** Implemented formatting functions that handle AI responses consistently regardless of output format.
- **Challenge:** Tracking message counts efficiently.
  - **Solution:** Added direct database update in the message handling functions to update counters atomically.
- **Challenge:** Making entry summaries concise yet informative.
  - **Solution:** Used abbreviated format for message counts and positioned them at the end of messages.

## Future Considerations
- Fine-tune AI prompts based on user feedback and response quality
- Consider adding analytics on message type distribution
- Explore optimizations for entries with many messages
- Add specialized handling for other message types (stickers, photos, documents)

---
**Status:** Implementation Complete ✅ 