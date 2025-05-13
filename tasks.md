# Task: Multi-Feature Update: Notifications, Main Menu & Admin Broadcast

## Complexity
Level: 3
Type: Feature

## Description
This task involves three main feature updates:
1.  **Enhanced Notification Service:** Refactor the notification service to store user-specific notification settings (preferred time, next notification timestamp, last notification timestamp) in the database. The service will poll users, send notifications if the `next_notification_timestamp` is past and doesn't match `last_notification_timestamp`, and then schedule the subsequent notification.
2.  **Smart Main Menu:** Modify the main menu (keyboard interface) so that any user message (text, voice, video) received while the main menu is active triggers the "new journal entry" command flow.
3.  **Admin Broadcast Command:** Implement a new slash command `/notifyusers` (admin-only). Upon execution, the bot will await the admin's next message, then broadcast this message content to all users.

## Technology Stack
- Framework: Telegraf
- Language: TypeScript
- Database: MongoDB/Mongoose

## Technology Validation Checkpoints
- [ ] Project initialization command verified (Existing project)
- [ ] Required dependencies identified and installed (Existing project)
- [ ] Build configuration validated (Existing project)
- [ ] Hello world verification completed (Existing project)
- [ ] Test build passes successfully

## Status
- [x] Initialization complete
- [x] Planning complete
- [ ] Technology validation complete
- [x] Implementation Phase 1: Notification Service & DB Schema
- [x] Implementation Phase 2: Main Menu Smart Input
- [x] Implementation Phase 3: Admin Broadcast Command
- [x] Implementation Phase 4: Testing & Refinement
- [x] Implementation Complete

## Implementation Plan

### 1. Phase 1: Notification Service & DB Schema Update
- **Subtask 1.1: Database Schema for Notifications**
    - Modify the User model/schema (e.g., `IUser` in `src/types/models.ts` or similar, and the Mongoose schema in `src/database/models/user.model.ts` or equivalent).
    - Add fields:
        - `notificationSettings.time`: String (e.g., "HH:MM" format for user's preferred notification time).
        - `notificationSettings.nextNotificationTimestamp`: Date.
        - `notificationSettings.lastNotificationTimestamp`: Date.
    - Consider default values and migration for existing users.
- **Subtask 1.2: Notification Service Logic**
    - Locate or create the notification service (likely in `src/services/` or `src/features/`).
    - Implement an infinite loop or scheduled job (e.g., `node-cron`).
    - Inside the loop/job:
        - Fetch users with notification settings.
        - For each user, check if `Date.now() >= user.notificationSettings.nextNotificationTimestamp` AND `user.notificationSettings.lastNotificationTimestamp !== user.notificationSettings.nextNotificationTimestamp`.
        - If true: Send notification, update `lastNotificationTimestamp`, calculate and set new `nextNotificationTimestamp`.
- **Subtask 1.3: User Settings for Notifications (Basic)**
    - Implement a basic command or settings option for users to set their preferred notification time.

### 2. Phase 2: Main Menu Smart Input
- **Subtask 2.1: Identify Main Menu Handler**
    - Locate code for main menu interactions (e.g., `src/features/onboarding/handlers.ts`).
- **Subtask 2.2: Modify Message Handler**
    - Update handler to capture generic `on('text')`, `on('voice')`, `on('video_note')` in "main menu state".
    - Redirect to "new journal entry" flow.
    - Ensure no conflict with explicit menu button presses.

### 3. Phase 3: Admin Broadcast Command (`/notifyusers`)
- **Subtask 3.1: Create New Command**
    - Register `/notifyusers` (e.g., in `src/commands/index.ts`).
    - Implement admin check middleware.
- **Subtask 3.2: Await Next Message Logic**
    - Set session state for admin indicating bot awaits broadcast message.
    - Reply to admin: "Please send the message you want to broadcast."
- **Subtask 3.3: Broadcast Logic**
    - Handle admin's next message if in "awaiting broadcast" state.
    - Fetch all user IDs.
    - Loop and send message (`ctx.telegram.sendMessage(userId, adminMessageText)`).
    - Handle errors (e.g., user blocked bot).
    - Clear admin's "awaiting broadcast" state.
    - Confirm to admin: "Message broadcasted to X users."

### 4. Phase 4: Testing & Refinement
- **Subtask 4.1: Unit/Integration Tests**
    - Test notification scheduling.
    - Test main menu input behavior.
    - Test admin broadcast command.
- **Subtask 4.2: Manual End-to-End Testing**
    - Test notification settings and reception.
    - Test various message types in main menu.
    - Test admin broadcast flow.

## Creative Phases Required
- [ ] **UI/UX Design (Minor):** For notification time settings.
- [ ] **Algorithm Design (Minor):** For notification scheduling (especially if timezones become a complex factor).

## Dependencies
- User database.
- Telegram API.
- Session management (for admin broadcast).

## Challenges & Mitigations
- **Challenge 1:** Efficiently querying/updating notification timestamps.
    - **Mitigation:** Indexed queries, batch processing if necessary.
- **Challenge 2:** Handling timezones accurately.
    - **Mitigation (Current):** Assume consistent timezone. If full support needed, complexity increases (potential creative phase).
- **Challenge 3:** Main menu "catch-all" conflicting with other commands/buttons.
    - **Mitigation:** Careful handler ordering and state management.
- **Challenge 4:** Rate limiting/errors during broadcast.
    - **Mitigation:** Delays between sends, error handling.

---
**Status:** Implementation Complete ✅ 

# Task: Multi-Feature Enhancement: Timezone Handling, Entry List View, Re-Analysis, and Localization

## Complexity
Level: 3
Type: Feature

## Description
This task involves four main feature enhancements:

1. **Improved Timezone Handling:** Refactor the notification service to better handle timezones using a simplified approach with UTC offsets. Users will select a UTC offset (e.g., UTC+2) during onboarding, which will be stored and used for scheduling notifications, addressing previous timezone inconsistencies.

2. **Entry Message List View:** Enhance the journal entry creation flow to display a list of messages contributed to the current entry. For text messages, show the message type plus first 20 characters; for voice/video messages, show the message type plus duration.

3. **Admin Re-Analysis Commands:** Implement two admin-only slash commands: `/reanalyzeme` to reanalyze the current user's entries, and `/reanalyzeall` to reanalyze all users' entries. This includes refactoring analysis code to be reusable and updating entry schema as needed.

4. **Russian Language Localization:** Implement full Russian language support using a localization library. Apply localization to all UI elements based on user's language preference settings.

## Technology Stack
- Framework: Telegraf
- Language: TypeScript
- Database: MongoDB/Mongoose
- Localization: i18next

## Technology Validation Checkpoints
- [x] Project initialization command verified (Existing project)
- [x] Required dependencies identified and installed (Existing project) 
- [x] Build configuration validated (Existing project)
- [x] Hello world verification completed (Existing project)
- [ ] Test build passes successfully with new features

## Status
- [x] Initialization complete
- [x] Planning complete
- [ ] Technology validation complete
- [ ] Implementation Phase 1: Timezone Handling Improvement
- [ ] Implementation Phase 2: Entry Message List View
- [ ] Implementation Phase 3: Admin Re-Analysis Commands
- [ ] Implementation Phase 4: Russian Language Localization
- [ ] Implementation Phase 5: Testing & Refinement
- [ ] Implementation Complete

## Implementation Plan

### 1. Phase 1: Timezone Handling Improvement
- **Subtask 1.1: User Model Update**
  - Update the User model to change `timezone` field to store UTC offset as a string (e.g., "+2", "-5")
  - Add a migration utility to convert existing timezone strings to UTC offsets
  - Update type definitions in `src/types/models.ts`

- **Subtask 1.2: Timezone Utility Refactoring**
  - Refactor `src/utils/timezone.ts` to:
    - Add new functions for UTC offset conversion vs. IANA timezone handling
    - Modify `convertToUTC` and `convertFromUTC` functions to work with simple UTC offsets
    - Add a function to generate a keyboard with UTC offset options (e.g., UTC-12 to UTC+14)
    - Write tests to verify timezone conversion functions

- **Subtask 1.3: Notification Service Modification**
  - Update `src/services/notification.service.ts` to use the new timezone handling logic:
    - Modify `calculateAndSetNextNotification` to use UTC offsets
    - Update `sendNotification` to display times correctly based on user's UTC offset
    - Add a new method to simplify the scheduling algorithm
  - Write tests for the updated notification service

- **Subtask 1.4: Onboarding Flow Update**
  - Modify timezone selection in onboarding flow to use UTC offset buttons
  - Update the settings UI to display and allow changing the UTC offset

### 2. Phase 2: Entry Message List View
- **Subtask 2.1: Message Metadata Functions**
  - Create utility functions in `src/features/journal-entry/utils.ts`:
    - `getMessagePreview(message)`: Format preview text based on message type
    - `getMessageDuration(message)`: Format voice/video duration in human-readable format
    - `formatMessageList(messages)`: Generate a formatted list of all messages

- **Subtask 2.2: Update Entry Handler Logic**
  - Modify the message handler in `src/features/journal-entry/handlers.ts`:
    - Keep track of all messages in the current entry
    - Generate and include a formatted message list in the reply
    - Update reply template to include the message list
  - Create a template function to generate the message list HTML

- **Subtask 2.3: UI Integration**
  - Update reply messages to display the list of entry contributions
  - Ensure proper formatting and readability
  - Add a separator between the message list and the prompt

### 3. Phase 3: Admin Re-Analysis Commands
- **Subtask 3.1: Analysis Code Refactoring**
  - Extract core analysis logic from `src/services/ai/journal-ai.service.ts` into reusable functions:
    - `performEntryAnalysis(entry, user)`: Core analysis function
    - `updateEntryWithAnalysis(entry, analysisResults)`: Updates entry with results

- **Subtask 3.2: Re-Analysis Command Implementation**
  - Create new command handlers in `src/commands/reanalyze.ts`:
    - `/reanalyzeme`: Re-analyze the current user's entries
    - `/reanalyzeall`: Re-analyze all users' entries (admin only)
  - Implement admin check middleware
  - Add progress reporting for long-running analysis tasks

- **Subtask 3.3: Database Interaction**
  - Create functions to fetch and update entries efficiently
  - Implement batched processing to avoid timeouts
  - Add error handling and resilience for large datasets

- **Subtask 3.4: Command Registration**
  - Register commands in `src/commands/index.ts`
  - Add help text and descriptions

### 4. Phase 4: Russian Language Localization
- **Subtask 4.1: Localization Setup**
  - Add i18next library and related dependencies
  - Create localization structure:
    - `src/locales/en/` for English translations
    - `src/locales/ru/` for Russian translations
  - Set up localization initialization in `src/config/i18n.ts`

- **Subtask 4.2: Translation Files Creation**
  - Create translation files for different feature domains:
    - `common.json`: Common UI elements
    - `onboarding.json`: Onboarding flow
    - `journal.json`: Journal-related messages
    - `settings.json`: Settings-related messages
    - `errors.json`: Error messages
  - Translate all strings into Russian with attention to natural phrasing

- **Subtask 4.3: Localization Integration**
  - Refactor UI message code to use localization:
    - Create a utility function `t(key, params, user)` in `src/utils/localization.ts`
    - Replace hardcoded strings with localization keys
    - Update templates to use localization
  - Ensure dynamic content is properly handled

- **Subtask 4.4: Language Toggle Enhancement**
  - Update the language toggle in settings to affect both AI and UI language
  - Ensure immediate feedback when language is changed
  - Update help text to mention UI localization

### 5. Phase 5: Testing & Refinement
- **Subtask 5.1: Unit Tests Creation**
  - Create tests for timezone utilities
  - Create tests for message formatting
  - Create tests for localization loading
  - Create tests for analysis functions

- **Subtask 5.2: Integration Tests**
  - Test timezone handling end-to-end
  - Test message list view
  - Test re-analysis commands
  - Test localization switching

- **Subtask 5.3: Localization Testing**
  - Verify all UI elements are properly translated
  - Check for untranslated strings
  - Ensure proper formatting in both languages

- **Subtask 5.4: Notification Testing**
  - Test notification scheduling with various UTC offsets
  - Verify correct time display
  - Test timezone changes affect notifications correctly

## Creative Phases Required
- [ ] **Algorithm Design (Minor):** For simplified timezone handling with UTC offsets
- [ ] **UI/UX Design (Minor):** For message list view formatting and Russian language adaptation

## Dependencies
- User database schema (for timezone and language settings)
- Telegram API for command handling and message formatting
- OpenAI API for re-analysis functionality
- i18next library for localization

## Challenges & Mitigations
- **Challenge 1:** Timezone handling complexity
  - **Mitigation:** Simplify by using UTC offset approach rather than full IANA timezone handling
- **Challenge 2:** Processing large numbers of entries during re-analysis
  - **Mitigation:** Implement batched processing with progress updates
- **Challenge 3:** Ensuring complete localization coverage
  - **Mitigation:** Create a comprehensive string extraction process and manual verification
- **Challenge 4:** Maintaining performance with additional message list processing
  - **Mitigation:** Optimize message storage and retrieval, cache formatted messages where appropriate

---
**Status:** Planning Complete ✅ 