# Euphoria Bot - Inline Keyboard Main Menu Implementation Plan

## Task Overview
Convert the main menu from a regular Telegram keyboard to inline keyboard, add a `/menu` command, and refactor associated code for better organization and maintainability.

## Implementation Phases

### Phase 1: Create Inline Keyboard and Command

#### 1. Create Main Menu Inline Keyboard
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

#### 2. Update Main Menu Display Function
**File:** `src/features/core/handlers.ts`

```typescript
/**
 * Shows the main menu with inline keyboard
 */
export async function showMainMenu(ctx: JournalBotContext, user?: User): Promise<void> {
  // Get user if not provided
  if (!user && ctx.from) {
    user = await getUserById(ctx.from.id);
  }

  const greeting = user?.name 
    ? `Welcome back, ${user.name}! What would you like to do?` 
    : 'Welcome! What would you like to do?';

  await ctx.reply(greeting, { 
    reply_markup: createMainMenuInlineKeyboard()
  });
}

/**
 * Handler for /menu command
 */
export async function handleMenuCommand(ctx: JournalBotContext): Promise<void> {
  await showMainMenu(ctx);
}
```

#### 3. Register Command and Callback Handlers
**File:** `src/features/core/index.ts`

```typescript
export function registerCoreHandlers(bot: Bot<JournalBotContext>): void {
  // Register existing handlers
  // ...

  // Register menu command
  bot.command('menu', handleMenuCommand);
  
  // Register main menu callbacks
  bot.callbackQuery(MAIN_MENU_CALLBACKS.NEW_ENTRY, async (ctx) => {
    await ctx.answerCallbackQuery();
    // Forward to journal entry handler
    return handleNewEntryRequest(ctx);
  });
  
  bot.callbackQuery(MAIN_MENU_CALLBACKS.JOURNAL_HISTORY, async (ctx) => {
    await ctx.answerCallbackQuery();
    // Forward to journal history handler
    return handleJournalHistoryRequest(ctx);
  });
  
  bot.callbackQuery(MAIN_MENU_CALLBACKS.JOURNAL_CHAT, async (ctx) => {
    await ctx.answerCallbackQuery();
    // Forward to journal chat handler
    return handleJournalChatRequest(ctx);
  });
  
  bot.callbackQuery(MAIN_MENU_CALLBACKS.SETTINGS, async (ctx) => {
    await ctx.answerCallbackQuery();
    // Forward to settings handler
    return handleSettingsRequest(ctx);
  });
}
```

### Phase 2: Update Feature Flows

#### 4. Update Journal Entry Handlers
**File:** `src/features/journal-entry/handlers.ts`

```typescript
// Add "Back to Main Menu" inline button to relevant responses
export async function finishJournalEntry(ctx: JournalBotContext): Promise<void> {
  // Existing code to finish the entry
  // ...
  
  // Show completion message with option to go back to main menu
  await ctx.reply('Your journal entry has been saved!', {
    reply_markup: new InlineKeyboard()
      .text('Back to Main Menu', MAIN_MENU_CALLBACKS.MAIN_MENU)
  });
}
```

#### 5. Update Journal History Handlers
**File:** `src/features/journal-history/handlers.ts`

```typescript
// Add main menu button to history list
export async function showJournalHistory(ctx: JournalBotContext): Promise<void> {
  // Existing code to fetch and display entries
  // ...
  
  // Add Main Menu button at the bottom of history list
  keyboard.row().text('Back to Main Menu', MAIN_MENU_CALLBACKS.MAIN_MENU);
  
  await ctx.reply('Your journal entries:', {
    reply_markup: keyboard
  });
}
```

#### 6. Update Journal Chat Handlers
**File:** `src/features/journal-chat/handlers.ts`

```typescript
// Update exit chat flow
export async function exitJournalChatMode(ctx: JournalBotContext): Promise<void> {
  // Reset chat mode flags
  ctx.session.journalChatMode = false;
  ctx.session.waitingForJournalQuestion = false;
  
  await ctx.reply('Exiting journal chat mode.');
  
  // Show main menu
  return showMainMenu(ctx);
}
```

#### 7. Update Settings Handlers
**File:** `src/features/settings/handlers.ts`

```typescript
// Add main menu button to settings menu
export async function showSettingsMenu(ctx: JournalBotContext, user: User): Promise<void> {
  // Create settings keyboard
  const keyboard = new InlineKeyboard()
    // Existing settings buttons
    // ...
    
    // Add main menu button
    .row()
    .text('Back to Main Menu', MAIN_MENU_CALLBACKS.MAIN_MENU);
  
  await ctx.reply('Settings:', { reply_markup: keyboard });
}
```

#### 8. Update Onboarding Handlers
**File:** `src/features/onboarding/handlers.ts`

```typescript
// Update completion flow to use inline menu
export async function completeOnboarding(ctx: JournalBotContext, user: User): Promise<void> {
  // Mark onboarding as complete
  await completeUserOnboarding(user.id);
  
  await ctx.reply('All set! Your profile is complete.');
  
  // Show main menu with inline keyboard
  return showMainMenu(ctx);
}
```

### Phase 3: Code Cleanup and Testing

#### 9. Remove Deprecated Code
- Remove the old regular keyboard implementation
- Clean up any redundant navigation functions
- Update comments and documentation

#### 10. Create Navigation Helpers
**File:** `src/features/core/utils.ts`

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

#### 11. Update Testing
- Update existing tests to work with inline keyboards
- Add tests for the new `/menu` command
- Add tests for callback query handlers

## Implementation Checklist

### Phase 1: Core Implementation
- [ ] Create callback data constants
- [ ] Implement inline keyboard function
- [ ] Update main menu display function
- [ ] Create `/menu` command handler
- [ ] Register command and callbacks

### Phase 2: Feature Updates
- [ ] Update Journal Entry navigation
- [ ] Update Journal History navigation
- [ ] Update Journal Chat navigation
- [ ] Update Settings navigation
- [ ] Update Onboarding completion flow

### Phase 3: Refinement
- [ ] Create navigation helper functions
- [ ] Clean up deprecated code
- [ ] Update tests
- [ ] Update documentation
- [ ] Manual testing of all flows

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