# Euphoria Bot - System Patterns

## Coding Patterns and Conventions

### Feature Organization
- Features are organized in dedicated directories under `src/features/`
- Each feature typically includes:
  - `index.ts`: Exports the feature registration function
  - `handlers.ts`: Contains the bot handlers for the feature
  - `keyboards.ts`: Defines keyboard layouts for the feature
  - `utils.ts`: Feature-specific utility functions
  - Subdirectories for complex features (handlers/, utils/, etc.)

### Message Formatting
- All bot messages use HTML parse mode for consistency (`parse_mode: 'HTML'`)
- HTML tags supported by Telegram API: `<b>`, `<i>`, `<u>`, `<s>`, `<a>`, `<code>`, `<pre>`
- Using a consistent format avoids issues with special character escaping
- Standardized greeting messages with randomized content but consistent format
- HTML formatting allows for rich text presentation while maintaining compatibility

### Handler Registration
```typescript
// Pattern used to register feature handlers
export function registerFeatureHandlers(bot: Bot<JournalBotContext>): void {
  // Command handlers
  bot.command('commandname', handlerFunction);
  
  // Message handlers
  bot.on('message:text', handlerFunction);
  
  // Callback query handlers
  bot.callbackQuery('callback_pattern', handlerFunction);
  
  // Inline query handlers
  bot.on('inline_query', handlerFunction);
}
```

### State Management
- Session-based state management for multi-step processes
- State is stored in `ctx.session` using Grammy's sessions middleware
- Feature-specific session properties (e.g., `ctx.session.onboardingStep`)
- Clear session state when flows complete

### Navigation System
- Main menu uses inline keyboard pattern
- Consistent callback data patterns for menu options
- Navigation helpers used across features
- `/menu` command to show main menu from anywhere

```typescript
// Main menu inline keyboard pattern
export function createMainMenuInlineKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("📝 New Entry", MAIN_MENU_CALLBACKS.NEW_ENTRY)
    .text("📚 Journal History", MAIN_MENU_CALLBACKS.JOURNAL_HISTORY)
    .row()
    .text("🤔 Ask My Journal", MAIN_MENU_CALLBACKS.JOURNAL_CHAT)
    .text("⚙️ Settings", MAIN_MENU_CALLBACKS.SETTINGS);
}

// Callback constants for navigation
export const MAIN_MENU_CALLBACKS = {
  NEW_ENTRY: 'main_new_entry',
  JOURNAL_HISTORY: 'main_journal_history',
  JOURNAL_CHAT: 'main_journal_chat',
  SETTINGS: 'main_settings',
  MAIN_MENU: 'main_menu'
};
```

### Database Operations
- MongoDB models defined in `src/database/models/`
- Mongoose schema definitions with TypeScript interfaces
- CRUD operations exported as functions
- Validation rules defined at the schema level
- Index definitions for performance optimization

### Error Handling
- Central error handlers registered as middleware
- Custom error classes for different error types
- Try/catch blocks with specific error handling
- Logging of errors with context information
- User-friendly error messages for common scenarios

### Logging
- Structured logging using a custom logger
- Different log levels for different environments
- Context-aware logging with component/feature identifiers
- Performance monitoring via timestamped logs

### Command System
- Bot commands registered with Telegram
- Command handlers organized by feature
- Help text and descriptions for commands
- Command middleware for authentication and validation
- Core navigation commands (e.g., `/start`, `/menu`)

### Keyboard Patterns
```typescript
// Inline keyboard pattern
export function createFeatureKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('Option 1', 'feature_option1')
    .text('Option 2', 'feature_option2')
    .row()
    .text('Back', 'main_menu');
}

// Reply keyboard pattern
export function createFeatureMenu(): Keyboard {
  return new Keyboard()
    .text('Option A')
    .text('Option B')
    .row()
    .text('Main Menu')
    .resized();
}
```

### Middleware Pattern
```typescript
// Middleware function pattern
export function authenticationMiddleware(ctx: JournalBotContext, next: NextFunction) {
  // Check authentication
  if (!ctx.from) {
    return ctx.reply('Authentication required');
  }
  
  // Continue to next middleware or handler
  return next();
}
```

### Service Pattern
```typescript
// Service class pattern
export class FeatureService {
  private logger: Logger;
  
  constructor() {
    this.logger = createLogger('FeatureService');
  }
  
  public async performOperation(params: OperationParams): Promise<OperationResult> {
    try {
      // Operation logic
      return result;
    } catch (error) {
      this.logger.error('Error in performOperation:', error);
      throw error;
    }
  }
}
```

## Common Patterns in Features

### Onboarding Flow
- Step-based progression using session state
- Validation of user inputs at each step
- Consistent navigation options
- Final completion and profile storage

### Journal Entry Creation
- Multi-message collection into a single entry
- Support for different input types (text, voice, video)
- AI analysis of content
- Saving and finalizing entries

### Notification System
- Scheduled notifications based on user preferences
- User-specific notification management
- Health checking and monitoring
- Rate limiting to prevent spam

### Human Design Integration
- API service wrapper for external service
- Caching of frequently used data
- User-friendly command interface
- Error handling for API failures 