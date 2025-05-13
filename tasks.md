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
- [ ] Implementation Phase 4: Testing & Refinement
- [ ] Implementation Complete

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