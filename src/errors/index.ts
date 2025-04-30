// Export all error classes and utilities
// Export base error types and constants
export * from './classes/base-error';

// Export specific error classes
export * from './classes/validation-error';
export * from './classes/database-error';
export * from './classes/external-service-error';
export * from './classes/business-error';
export * from './classes/auth-error';
export * from './classes/infrastructure-error';
export * from './classes/ai-error';

// Export error utilities
export * from './utils/error-map';
export * from './utils/error-helper';

// Export error handlers
export * from './handlers/api-error-handler';
export * from './handlers/bot-error-handler';

// Export middleware
export * from './middleware/error-middleware';

// Legacy compatibility exports (to ease transition)
import { BaseError, ErrorCode } from './classes/base-error';
import { ValidationError } from './classes/validation-error';
import { DatabaseError } from './classes/database-error';
import { ExternalServiceError } from './classes/external-service-error';
import { AuthError } from './classes/auth-error';
import { AIError } from './classes/ai-error';

// Legacy AppError compatibility (to ease transition)
export class AppError extends BaseError {
  constructor(
    message: string,
    code: string = ErrorCode.INTERNAL_ERROR,
    context?: Record<string, any>,
    originalError?: Error
  ) {
    super({
      message,
      code: code as any,
      category: determineCategoryFromCode(code),
      context,
      cause: originalError
    });
  }
}

// Helper to map legacy error codes to categories
function determineCategoryFromCode(code: string): string {
  if (code.includes('VALIDATION')) return 'validation';
  if (code.includes('AUTH')) return 'authentication';
  if (code.includes('DB') || code.includes('DATABASE')) return 'database';
  if (code.includes('API') || code.includes('EXTERNAL')) return 'external_service';
  return 'unexpected';
}

// Legacy error class re-exports
export {
  ValidationError as ValidationError,
  DatabaseError as DatabaseError,
  ExternalServiceError as ExternalAPIError,
  AuthError as AuthError,
  AIError as AIError
}; 