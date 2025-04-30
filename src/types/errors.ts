/**
 * Base error class for all application errors.
 * Provides error code and context information capabilities.
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly context?: Record<string, any>;
  public readonly originalError?: Error;

  constructor(
    message: string, 
    code: string = 'INTERNAL_ERROR', 
    context?: Record<string, any>,
    originalError?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.context = context;
    this.originalError = originalError;

    // Maintain proper stack trace in Node.js
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error thrown when a required resource is not found
 */
export class NotFoundError extends AppError {
  constructor(
    message: string = 'Resource not found', 
    context?: Record<string, any>
  ) {
    super(message, 'NOT_FOUND', context);
  }
}

/**
 * Error thrown during authentication/authorization
 */
export class AuthError extends AppError {
  constructor(
    message: string = 'Authentication error', 
    context?: Record<string, any>
  ) {
    super(message, 'AUTH_ERROR', context);
  }
}

/**
 * Error thrown when external API calls fail
 */
export class ExternalAPIError extends AppError {
  constructor(
    message: string = 'External API error', 
    code: string = 'EXTERNAL_API_ERROR',
    context?: Record<string, any>,
    originalError?: Error
  ) {
    super(message, code, context, originalError);
  }
}

/**
 * Error thrown for invalid user input
 */
export class ValidationError extends AppError {
  constructor(
    message: string = 'Validation error', 
    context?: Record<string, any>
  ) {
    super(message, 'VALIDATION_ERROR', context);
  }
}

/**
 * Error thrown when an AI operation fails
 */
export class AIError extends Error {
    public readonly context: Record<string, string>;
    public readonly originalError?: Error;

    constructor(
        message: string,
        context: Record<string, string> = {},
        originalError?: Error
    ) {
        super(message);
        this.name = 'AIError';
        this.context = context;
        this.originalError = originalError;
    }
}

/**
 * Error thrown when database operations fail
 */
export class DatabaseError extends AppError {
  constructor(
    message: string = 'Database operation failed', 
    context?: Record<string, any>,
    originalError?: Error
  ) {
    super(message, 'DATABASE_ERROR', context, originalError);
  }
}

/**
 * Error codes dictionary for consistent error handling
 */
export const ErrorCodes = {
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  AUTH_ERROR: 'AUTH_ERROR',
  EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AI_ERROR: 'AI_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  // Add more error codes as needed
} as const;

export type ErrorCode = keyof typeof ErrorCodes;

export class TranscriptionError extends Error {
    constructor(
        message: string,
        public readonly fileId: string,
        public readonly mediaType: 'voice' | 'video',
        public readonly originalError?: Error
    ) {
        super(message);
        this.name = 'TranscriptionError';
    }
}

export class JournalError extends Error {
    constructor(
        message: string,
        public readonly userId: string,
        public readonly entryId?: string,
        public readonly originalError?: Error
    ) {
        super(message);
        this.name = 'JournalError';
    }
}

export type KnownError = AIError | TranscriptionError | JournalError;

export function isKnownError(error: unknown): error is KnownError {
    return error instanceof AIError ||
           error instanceof TranscriptionError ||
           error instanceof JournalError;
} 