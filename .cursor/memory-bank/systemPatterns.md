# System Patterns

## Code Organization
- Feature-based structure in `/src/features/`:
  - Each feature module contains related functionality (e.g., journal-entry, journal-chat)
  - Features are independent and focused on specific domain concerns
- Utilities in `/src/utils/`:
  - Common helpers and utility functions
  - Logging functionality
- Configuration in `/src/config/`:
  - Environment variables
  - AI prompts and constants
- Database models in `/src/database/models/`:
  - MongoDB schema definitions
  - Database access functions (find, create, update)
- Error handling in `/src/errors/`:
  - Custom error classes
  - Error handlers and middleware
  - Utility functions for error management
- Services in `/src/services/`:
  - Business logic implementation
  - External API integrations (OpenAI)
  - Cross-cutting concerns

## Feature Structure
- Each feature generally contains:
  - **Handlers**: Process incoming messages and callbacks
    - `message-handlers.ts`: Handle text and media messages
    - `callback-handlers.ts`: Handle callback queries
    - `button-handlers.ts`: Handle button interactions
  - **Keyboards**: Define UI elements for Telegram
    - Custom keyboards for feature-specific interactions
    - Inline keyboards for rich interactions
  - **Utils**: Feature-specific utility functions
    - Helper functions for message formatting
    - Feature-specific business logic

## Message Handling Pattern
- Messages are processed through handler functions
- Handlers extract data from Telegram context
- Data is passed to appropriate service functions
- Services update database and return results
- Handlers format responses and send to users

## AI Integration Pattern
- AI functionality is abstracted in services
- `openai-client.service.ts`: Low-level API client
- `openai.service.ts`: OpenAI-specific implementation
- `journal-ai.service.ts`: Domain-specific AI functionality
- Error handling for AI service failures
- Message formatting and prompt engineering

## Data Access Pattern
- MongoDB with Mongoose for data modeling
- Models define schemas and validation
- Model files include related service functions
- Functions follow patterns like:
  - `findOrCreate...`
  - `getXById`
  - `updateX`
  - `addYToX`

## Error Handling Pattern
- Dedicated error classes in `/src/errors/classes/`:
  - Type-specific error classes extending base Error
  - Additional context and metadata
- Error handlers in `/src/errors/handlers/`:
  - Process errors based on type
  - Format appropriate error responses
- Error middleware in `/src/errors/middleware/`:
  - Intercept and process errors
  - Logging and reporting
- Error utilities in `/src/errors/utils/`:
  - Helper functions for error creation
  - Error formatting
- Centralized error service for logging and tracking

## Bot Interaction Pattern
- Context-based request handling
- Session management for stateful interactions
- Keyboard-based user interfaces
- Command handlers for specific commands
- Callback query handlers for inline buttons

## Admin Functionality
- Separate admin module in `/src/admin/`
- Administrative interfaces and dashboards
- Monitoring and management functionality

## Testing
- Jest testing framework (jest.config.js present)
- Tests often in `__tests__` directories within modules
- Service-level testing for business logic
- Mocking of external dependencies

---
*These observed patterns will be expanded as code is further explored and understood.* 