# Infinity Bot - Functional Overview

**Core Purpose:** A Telegram bot acting as a personal journaling companion, facilitating self-reflection through text, voice, and video inputs, guided by AI analysis and prompts.

**Key Features & Flows:**

1.  **Onboarding (`/start` command for new users):**
    *   **Trigger:** User sends `/start` for the first time.
    *   **Flow:**
        *   Greets the user.
        *   Prompts for preferred name (defaults to Telegram first name, provides button).
        *   Prompts for age range (uses `AGE_RANGES` keyboard).
        *   Prompts for gender (uses `GENDER_OPTIONS` keyboard).
        *   (Likely prompts for occupation & bio based on session steps mentioned: `'occupation'`, `'bio'`).
        *   Saves profile information (`updateUserProfile`).
        *   Marks onboarding as complete (`completeUserOnboarding`).
        *   Shows the Main Menu.
    *   **Mechanism:** Uses `ctx.session.onboardingStep` to track progress. Validates input using `isValidAgeRange`, `isValidGender`.

2.  **Main Menu (Post-Onboarding / `/start` for existing users):**
    *   **Trigger:** Onboarding completion, `/start` command (if onboarded), navigating back from other sections (e.g., via "Back to Main Menu" inline button or "❌ Cancel" in certain contexts).
    *   **Interface:** Presents a persistent keyboard with main options:
        *   "📝 New Entry"
        *   "📚 Journal History"
        *   "🤔 Ask My Journal"
        *   "⚙️ Settings"
    *   **Function:** `showMainMenu(ctx, user)` displays this.

3.  **Journal Entry Creation & Interaction:**
    *   **Trigger:** User presses "📝 New Entry" or "✅ Share" (from a notification context, apparently).
    *   **Flow:**
        *   Checks for an existing *active* entry (`getActiveJournalEntry`).
        *   **If active entry exists:** Asks user to continue with it, showing "✅ Save", "🔍 Analyze & Suggest Questions", "❌ Cancel" keyboard. Sets `ctx.session.journalEntryId`.
        *   **If no active entry:** Creates a new entry (`createJournalEntry`), sets `ctx.session.journalEntryId`, prompts user to share thoughts (text, voice, video), showing the same keyboard.
        *   **User Input (Text/Voice/Video):**
            *   **Text:** Saved directly (`saveTextMessage`, `addMessageToJournalEntry`).
            *   **Voice/Video:** (Likely) Downloads file, transcribes using AI (`transcribeAudio` via `chatgpt.ts`/OpenAI), saves transcription (`saveVoiceMessage`/`saveVideoMessage`, `addMessageToJournalEntry`), replies with transcription (`sendTranscriptionReply`).
        *   **"✅ Save":** Finalizes the entry (`finishJournalEntry`). This likely involves:
            *   Compiling full text (`extractFullText`).
            *   Saving full text (`updateJournalEntryFullText`).
            *   Performing final AI analysis (`analyzeJournalEntry`, `generateJournalInsights`).
            *   Updating entry status (`completeJournalEntry`).
            *   Clearing `ctx.session.journalEntryId`.
            *   Returning user to Main Menu.
        *   **"🔍 Analyze & Suggest Questions":**
            *   Triggers AI analysis (`generateJournalQuestions` via `journal-ai.ts`).
            *   Sends suggested questions back to the user.
            *   Keeps the entry active, showing the same interaction keyboard.
        *   **"❌ Cancel":** Discards the current active entry, clears `ctx.session.journalEntryId`, returns to Main Menu.
    *   **Mechanism:** Relies heavily on `ctx.session.journalEntryId` to track the active entry state. Uses database functions (`createJournalEntry`, `addMessageToJournalEntry`, `getJournalEntryById`, etc.) and AI services (`journal-ai.ts`, `chatgpt.ts`).

4.  **Journal History Viewing:**
    *   **Trigger:** User presses "📚 Journal History".
    *   **Flow:**
        *   Fetches past entries (`getUserJournalEntries`).
        *   If no entries, informs user and shows Main Menu.
        *   If entries exist, displays a list (max 10?) as inline keyboard buttons. Each button shows date and a snippet (`formattedDate} ${textSnippet`).
        *   Button callback `view_entry:{entry_id}` (presumably) displays the full content of the selected entry.
        *   Includes a "Back to Main Menu" (`main_menu`) inline button.
    *   **Mechanism:** Database query (`getUserJournalEntries`), inline keyboard generation.

5.  **Journal Chat ("Ask My Journal"):**
    *   **Trigger:** User presses "🤔 Ask My Journal".
    *   **Flow:**
        *   Checks if entries exist. If not, prompts user to create some.
        *   Enters "Journal Chat Mode" (`ctx.session.journalChatMode = true`, `ctx.session.waitingForJournalQuestion = true`).
        *   Shows a keyboard with "❌ Exit Chat Mode".
        *   Prompts user to ask questions about their entries (patterns, growth, insights).
        *   (Likely) User sends a text question.
        *   (Likely) Bot uses AI (`handleJournalChat` function?) to analyze *all* user entries (`getUserJournalEntries`, then perhaps passing concatenated text to an AI model) based on the user's question.
        *   Replies with the AI-generated answer.
        *   Stays in chat mode until user presses "❌ Exit Chat Mode".
    *   **Mechanism:** Session flags (`journalChatMode`, `waitingForJournalQuestion`), database access (`getUserJournalEntries`), AI interaction (details inferred).

6.  **Settings Management:**
    *   **Trigger:** User presses "⚙️ Settings".
    *   **Flow:**
        *   Displays current notification status (enabled/disabled) and time (if set).
        *   Provides inline keyboard buttons:
            *   "🔔 Enable/Disable Notifications" (`toggle_notifications`): Toggles `user.notificationsEnabled` in the database.
            *   "⏰ Set Notification Time" (`set_notification_time`): (Likely) Prompts user for a time, sets `ctx.session.waitingForNotificationTime = true`, validates input, saves `user.notificationTime`.
            *   "↩️ Back to Main Menu" (`main_menu`).
    *   **Mechanism:** Database (`updateUserProfile`), session flag (`waitingForNotificationTime`), inline keyboards.

7.  **Notifications (Implicit):**
    *   **Mechanism:** Uses `notificationService` (likely a cron job or scheduler) to send reminders at `user.notificationTime` if `user.notificationsEnabled` is true. The notification message seems to include a "✅ Share" button that triggers the "New Entry" flow. 