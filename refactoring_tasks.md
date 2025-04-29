# Euphoria Telegram Bot Refactoring Tasks

## Problem Statement
The current codebase has made good progress toward modularization with features, services, and database directories, but `journal-bot.ts` remains a monolithic file (445 lines) that mixes initialization logic, command handling, callback processing, and feature-specific implementations. This makes the code harder to maintain, test, and extend.

## Refactoring Goals
1. Complete the modularization of the codebase
2. Enforce single responsibility principle for all files
3. Improve maintainability and testability
4. Ensure consistent patterns across the codebase

## Task 1: Refactor `journal-bot.ts` into a Clean Entry Point
**Priority: High**
- Move all command handlers to appropriate feature modules
- Remove direct implementation logic, keeping only wiring/initialization
- Create clean registration pattern for all handlers

Specifically:
- [x] Move `/start` command handler to `features/core/handlers.ts`
- [x] Move `/cancel`, `/reset`, `/stop` command handlers to `features/core/handlers.ts`
- [x] Move "📚 Journal History" handler to `features/journal-history/handlers.ts`
- [x] Extract the large `handleGoDeeper` function to `features/journal-entry/handlers.ts`
- [ ] Remove duplicate user lookup logic (appears in multiple handlers)

## Task 2: Standardize Callback Query Handling
**Priority: High**
- [x] Replace the generic callback query handler with feature-specific handlers
- [x] Move all callback query handlers to appropriate feature modules
- [x] Ensure consistent callback query handling pattern across all features
- [x] Update callback registration in each feature's `index.ts` file

## Task 3: Create Consistent Error Handling Strategy
**Priority: Medium**
- [x] Implement a centralized error handling service in `services/error.service.ts`
- [x] Replace direct error logging with calls to the error service
- [x] Add structured error types in `types/errors.ts`
- [x] Ensure user-friendly error messages with appropriate fallback behaviors

## Task 4: Improve Type Definitions
**Priority: Medium**
- [x] Move `ChatMessage` interface from `journal-bot.ts` to `types/models.ts` as `IChatMessage`
- [ ] Audit all type definitions to ensure they're in the correct files
- [ ] Create consistent naming conventions for types (e.g., interfaces prefixed with 'I')
- [ ] Add proper JSDoc comments to type definitions

## Task 5: Refactor AI Integration
**Priority: Medium**
- [ ] Create dedicated service methods for all OpenAI interactions
- [ ] Move AI-related prompt templates to a separate config file
- [ ] Add retry logic and error handling for AI service calls
- [ ] Implement proper response validation for AI responses

## Task 6: Add Service Layer for Business Logic
**Priority: Low**
- [ ] Create service files for each feature domain (e.g., `journal-entry.service.ts`)
- [ ] Move business logic from handlers to service files
- [ ] Ensure handlers only handle bot interaction, delegating business logic to services
- [ ] Add proper error handling and logging in service methods

## Task 7: Improve Configuration Management
**Priority: Low**
- [ ] Create a robust configuration system with environment variable validation
- [ ] Centralize all configuration values in `config.ts`
- [ ] Add support for different environments (dev, test, prod)
- [ ] Document all configuration options

## Implementation Approach
1. Start with high-priority tasks (1-2) to address the most critical issues
2. Test thoroughly after each refactoring step
3. Document changes as you go to maintain understanding of the system
4. Consider adding automated tests as part of the refactoring 