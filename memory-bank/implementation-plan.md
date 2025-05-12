# Euphoria Bot - Inline Keyboard Main Menu Implementation Plan

## Task Overview
Convert the main menu from a regular Telegram keyboard to inline keyboard, add a `/menu` command, and refactor associated code for better organization and maintainability.

## Implementation Status: COMPLETED ✅

All planned changes have been successfully implemented:
- Created inline keyboard for main menu buttons
- Added `/menu` command 
- Updated navigation flows to work with inline keyboard
- Added helper functions for creating menu-related keyboards
- Used consistent callback data constants
- Enhanced journal entry flow with status messages and entry summaries
- Converted journal entry action buttons to inline keyboard
- Implemented automatic cleanup of old status messages

## Implementation Phases

### Phase 1: Create Inline Keyboard and Command ✅

#### 1. Create Main Menu Inline Keyboard ✅
**File:** `src/features/core/keyboards.ts`

```typescript
// Callback data constants
export const MAIN_MENU_CALLBACKS = {
  NEW_ENTRY: 'main_new_entry',
  JOURNAL_HISTORY: 'main_journal_history',
  JOURNAL_CHAT: 'main_journal_chat',
  SETTINGS: 'main_settings',
  MAIN_MENU: 'main_menu'
};

/**
 * Creates an inline keyboard for the main menu
 */
export function createMainMenuInlineKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("📝 New Entry", MAIN_MENU_CALLBACKS.NEW_ENTRY)
    .text("📚 Journal History", MAIN_MENU_CALLBACKS.JOURNAL_HISTORY)
    .row()
    .text("🤔 Ask My Journal", MAIN_MENU_CALLBACKS.JOURNAL_CHAT)
    .text("⚙️ Settings", MAIN_MENU_CALLBACKS.SETTINGS);
}
```

#### 2. Update Main Menu Display Function ✅
**File:** `src/features/core/handlers.ts`

```typescript
/**
 * Shows the main menu with inline keyboard
 */
export async function showMainMenu(ctx: JournalBotContext, user: IUser) {
    const greeting = getMainMenuGreeting(user);
    await ctx.reply(greeting.text, {
        reply_markup: createMainMenuInlineKeyboard(),
        parse_mode: greeting.parse_mode 
    });
}

/**
 * Handler for /menu command
 */
export async function handleMenuCommand(ctx: JournalBotContext) {
    if (!ctx.from) return;
    
    const user = await findOrCreateUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
    
    await showMainMenu(ctx, user);
}
```

#### 3. Register Command and Callback Handlers ✅
**File:** `src/features/core/index.ts`

Implemented all callback handlers for the main menu options:
- NEW_ENTRY
- JOURNAL_HISTORY
- JOURNAL_CHAT
- SETTINGS
- MAIN_MENU

### Phase 2: Update Feature Flows ✅

#### 4. Update Journal Entry Handlers ✅
Updated the journal entry completion flows to use the inline keyboard for the "Back to Main Menu" button.

#### 5. Update Journal History Handlers ✅
Updated the journal history navigation to use the MAIN_MENU_CALLBACKS constant.

#### 6. Update Journal Chat Handlers ✅
Converted the journal chat keyboard to an inline keyboard and updated all related handlers.

#### 7. Update Settings Handlers ✅
Updated the settings menu to use the MAIN_MENU_CALLBACKS constant.

### Phase 3: Journal Entry Flow Enhancements ✅

#### 8. Standardize Keyboard Layouts ✅
**File:** `src/features/journal-entry/keyboards/index.ts`

```typescript
// Button text constants
export const ButtonText = {
    SAVE: "✅ Save",
    ANALYZE: "🔍 Analyze & Suggest Questions",
    CANCEL: "❌ Discard",
    CONFIRM_CANCEL: "Yes, discard entry",
    KEEP_WRITING: "No, keep writing"
} as const;

// Callback data constants
export const CALLBACKS = {
    SAVE: "journal_save",
    ANALYZE: "journal_analyze",
    CANCEL: "journal_cancel",
    CONFIRM_CANCEL: "confirm_cancel_entry",
    KEEP_WRITING: "keep_writing"
};

// Journal action keyboard with inline buttons
export const journalActionKeyboard = new InlineKeyboard()
    .text(ButtonText.SAVE, CALLBACKS.SAVE)
    .text(ButtonText.ANALYZE, CALLBACKS.ANALYZE)
    .row()
    .text(ButtonText.CANCEL, CALLBACKS.CANCEL);
```

#### 9. Add Entry Summary Status Messages ✅
**File:** `src/features/journal-entry/utils.ts`

Added utility functions to generate entry summaries:

```typescript
export async function createEntrySummary(entry: IJournalEntry): Promise<string> {
    // Count message types and generate summary
    const messages = entry.messages as IMessage[];
    
    const textCount = messages.filter(m => m.type === MessageType.TEXT).length;
    const voiceCount = messages.filter(m => m.type === MessageType.VOICE).length;
    const videoCount = messages.filter(m => m.type === MessageType.VIDEO).length;
    
    // Create summary text
    const parts = [];
    if (textCount > 0) parts.push(`${textCount} text${textCount !== 1 ? 's' : ''}`);
    if (voiceCount > 0) parts.push(`${voiceCount} voice${voiceCount !== 1 ? 's' : ''}`);
    if (videoCount > 0) parts.push(`${videoCount} video${videoCount !== 1 ? 's' : ''}`);
    
    return parts.join(', ') || 'No messages yet.';
}

export async function createEntryStatusMessage(entry: IJournalEntry): Promise<string> {
    const summary = await createEntrySummary(entry);
    return `<b>Current journal entry</b>\n${summary}\n\n<i>Send more messages or use the buttons below.</i>`;
}
```

#### 10. Implement Status Message Management ✅
**File:** `src/types/session.ts`

Added status message tracking to the session:

```typescript
export interface JournalBotSession {
    // Other session properties
    lastStatusMessageId?: number; // Track status message for deletion
}
```

**File:** `src/features/journal-entry/handlers.ts`

Updated handlers to manage status messages:

```typescript
// In handleJournalEntryInput function
// Delete previous status message if it exists
if (ctx.session.lastStatusMessageId && ctx.chat) {
    try {
        await ctx.api.deleteMessage(ctx.chat.id, ctx.session.lastStatusMessageId)
            .catch(e => logger.warn("Failed to delete previous status message", e));
        ctx.session.lastStatusMessageId = undefined;
    } catch (error) {
        logger.warn("Error deleting previous status message", error);
    }
}

// After processing the message
// If a message was saved, send a status message with entry summary and action buttons
if (messageSaved) {
    // Refetch entry to get updated message count
    const updatedEntry = await getEntryById(entryId);
    if (updatedEntry) {
        const statusMessage = await createEntryStatusMessage(updatedEntry);
        const sentMsg = await ctx.reply(statusMessage, {
            parse_mode: 'HTML',
            reply_markup: journalActionKeyboard
        });
        // Store the message ID so we can delete it when the next message arrives
        ctx.session.lastStatusMessageId = sentMsg.message_id;
    }
}
```

#### 11. Update Import Structure ✅

Fixed all imports to consistently use the inline keyboards:

```typescript
// Remove old keyboard.ts imports
import { journalActionKeyboard, confirmCancelKeyboard } from './keyboards/index';
```

### Phase 4: Code Cleanup ✅

#### 12. Remove Legacy Keyboard Files ✅
Deleted the old `keyboards.ts` file and ensured all code uses the inline keyboard definitions from `keyboards/index.ts`.

#### 13. Update All Imported References ✅
Fixed imports in handlers, utils, and other files to use the new keyboards.

#### 14. Navigation Helpers ✅
Standardized the navigation helpers:

```typescript
/**
 * Helper to add a "Back to Main Menu" button to any inline keyboard
 */
export function addMainMenuButton(keyboard: InlineKeyboard): InlineKeyboard {
  return keyboard.row().text('Back to Main Menu', MAIN_MENU_CALLBACKS.MAIN_MENU);
}

/**
 * Creates a simple "Back to Main Menu" inline keyboard
 */
export function createBackToMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text('Back to Main Menu', MAIN_MENU_CALLBACKS.MAIN_MENU);
}
```

## Code Improvements

1. **Consistent Navigation:** All features now use inline keyboards with the same pattern for navigation.

2. **Improved UX:** The inline keyboard provides a better user experience with clickable buttons directly attached to messages.

3. **Entry Summaries:** Users now see a summary of their journal entries after each message.

4. **Automatic Cleanup:** Old status messages are automatically deleted when new messages arrive.

5. **Clean Structure:** Eliminated outdated code and standardized keyboard definitions.

## Implementation Checklist

### Phase 1: Core Implementation
- [x] Create callback data constants
- [x] Implement inline keyboard function
- [x] Update main menu display function
- [x] Create `/menu` command handler
- [x] Register command and callbacks

### Phase 2: Feature Updates
- [x] Update Journal Entry navigation
- [x] Update Journal History navigation
- [x] Update Journal Chat navigation
- [x] Update Settings navigation
- [x] Update Onboarding completion flow

### Phase 3: Journal Entry Enhancements
- [x] Create entry summary functions
- [x] Add status message tracking to session
- [x] Implement status message deletion
- [x] Convert action buttons to inline keyboard

### Phase 4: Refinement
- [x] Create navigation helper functions
- [x] Clean up deprecated code
- [x] Fix import structure
- [x] Manual testing of all flows

## Potential Challenges and Solutions

### Challenge: User Experience Changes
**Solution:** Ensure inline keyboards are consistently used throughout the app to maintain a cohesive experience. For recurring interactions, consider sending new messages with fresh inline keyboards.

### Challenge: Multiple Entry Points
**Solution:** Centralize the main menu display logic in the `showMainMenu` function to ensure consistent behavior across all entry points.

### Challenge: Session Management
**Solution:** Ensure session state is properly cleared when navigating between features to prevent state leakage or unexpected behavior.

### Challenge: Backward Compatibility
**Solution:** If needed, implement a gradual rollout where both keyboard types are supported temporarily until all users have transitioned to the new UI.

## Testing Strategy

### Unit Tests
- Test keyboard creation functions return expected structures
- Test command and callback handlers produce expected responses
- Test navigation helper functions

### Integration Tests
- Test navigation between features using inline buttons
- Test the `/menu` command in various contexts
- Test full user journeys with the new navigation

### Manual Testing
- Test all user flows with the new inline keyboard
- Verify the UX is intuitive and works as expected
- Test edge cases and error scenarios 

# Implementation Plan: Inline Keyboard Handling Update

## Overview

This implementation updates the way the bot handles inline keyboards after a user clicks on a button. The primary goal is to improve UX by removing outdated keyboards while preserving the original message text.

## Approach

1. **Centralized Utility Function**: 
   Created a reusable utility to handle keyboard removal across all callback handlers.

2. **Error Handling**:
   Added robust error handling for cases where messages were already deleted.

3. **Consistency**:
   Updated all callback handlers throughout the codebase to use the new utility.

## Implementation Details

### 1. Utility Function (`src/utils/inline-keyboard.ts`)

```typescript
/**
 * Removes the inline keyboard from a message after a button has been pressed.
 * Keeps the original message text unchanged.
 * 
 * @param ctx The Grammy context
 * @returns Promise that resolves when the keyboard has been removed or when an error has been handled
 */
export async function removeInlineKeyboard(ctx: Context): Promise<void> {
  // Only proceed if the callback query has a message
  if (!ctx.callbackQuery?.message) {
    return;
  }

  try {
    // Remove the inline keyboard by setting it to an empty array
    await ctx.editMessageReplyMarkup({
      reply_markup: { inline_keyboard: [] },
    });
  } catch (error) {
    // Check if it's a message not found error, which means the message was already deleted
    if (
      error instanceof Error &&
      (error.message.includes('message to edit not found') ||
       error.message.includes('message is not modified'))
    ) {
      // Message was already deleted or not modified, this is fine
      logger.debug('Cannot remove keyboard: message was deleted or not modified');
    } else {
      // Log other errors but don't throw them to avoid interrupting the normal flow
      logger.warn('Failed to remove inline keyboard', error);
    }
  }
}
```

The utility also includes a higher-order function wrapper for possible future use:

```typescript
export function withKeyboardRemoval<T extends Context>(
  handler: (ctx: T) => Promise<void>
): (ctx: T) => Promise<void> {
  return async (ctx: T) => {
    try {
      // Execute the original handler first
      await handler(ctx);
    } finally {
      // Always try to remove the keyboard, even if the handler fails
      await removeInlineKeyboard(ctx);
    }
  };
}
```

### 2. Updated Callback Handlers

All callback handlers were modified using this pattern:

```typescript
bot.callbackQuery(CALLBACK_NAME, async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!ctx.from) return;
  
  try {
    // Remove the keyboard first to prevent multiple clicks
    await removeInlineKeyboard(ctx);
    
    // Original handler code
    const user = await findOrCreateUser(/*...*/);
    await originalHandlerFunction(ctx, user);
  } catch (error) {
    logger.error('Error in callback handler', error);
  }
});
```

### 3. Files Updated

1. `src/utils/inline-keyboard.ts` (new file)
2. `src/features/core/index.ts`
3. `src/features/journal-entry/index.ts`
4. `src/features/journal-history/index.ts`
5. `src/features/journal-chat/handlers.ts`
6. `src/features/settings/index.ts`

## Benefits

1. **Improved UX**: Users no longer see disabled buttons that they can't use anymore
2. **Error Prevention**: Users can't press buttons multiple times, preventing potential errors
3. **Maintainability**: Centralized error handling for keyboard removal
4. **Consistent Behavior**: All inline keyboards now behave the same way across the app

## Future Considerations

- The withKeyboardRemoval wrapper could be used more extensively to further simplify callback handlers
- Additional error types could be handled more specifically if needed
- Performance impact should be monitored if the bot handles a large number of concurrent users 