import { BaseError, ErrorCategory, ErrorCode } from '../classes/base-error';
import { ValidationError, ValidationErrorDetail } from '../classes/validation-error';
import { DatabaseError } from '../classes/database-error';
import { ExternalServiceError } from '../classes/external-service-error';
import { BusinessError } from '../classes/business-error';
import { InfrastructureError } from '../classes/infrastructure-error';
import { AuthError } from '../classes/auth-error';
import { AIError, AIModel, AIOperation } from '../ai-error';

import { ILogger } from '../../utils/logger';

/**
 * A collection of helper functions for working with errors
 */
export class ErrorHelper {
  /**
   * Convert unknown error to a BaseError instance
   * 
   * @param error The error to wrap
   * @param defaultMessage Default message if none can be extracted
   * @returns BaseError or subclass instance
   */
  public static normalizeError(
    error: unknown,
    defaultMessage: string = 'An unexpected error occurred'
  ): BaseError {
    // Already a BaseError, return as is
    if (error instanceof BaseError) {
      return error;
    }
    
    // Error object, but not a BaseError - wrap it
    if (error instanceof Error) {
      return new BaseError({
        message: error.message || defaultMessage,
        code: ErrorCode.INTERNAL_ERROR,
        category: ErrorCategory.UNEXPECTED,
        cause: error
      });
    }
    
    // String error - convert to BaseError
    if (typeof error === 'string') {
      return new BaseError({
        message: error || defaultMessage,
        code: ErrorCode.INTERNAL_ERROR,
        category: ErrorCategory.UNEXPECTED
      });
    }
    
    // Object error - try to extract information
    if (error && typeof error === 'object') {
      const errorObj = error as Record<string, any>;
      const message = errorObj.message || defaultMessage;
      
      // Check if it's a known error pattern
      if (errorObj.code && typeof errorObj.code === 'string') {
        // OpenAI-like error
        if (errorObj.type && 
            (errorObj.type.includes('openai') || errorObj.message?.includes('OpenAI'))) {
          return AIError.fromOpenAIError(
            AIOperation.UNKNOWN,
            AIModel.UNKNOWN, 
            errorObj
          );
        }
        
        // Database-like error
        if (errorObj.code.includes('DB_') || 
            errorObj.code.includes('POSTGRES_') || 
            errorObj.code.includes('MONGO_')) {
          return DatabaseError.fromError(
            errorObj.message || 'Database error',
            error
          );
        }
      }
      
      // General object error
      return new BaseError({
        message,
        code: ErrorCode.INTERNAL_ERROR,
        category: ErrorCategory.UNEXPECTED,
        context: errorObj,
        cause: error
      });
    }
    
    // Fallback for null, undefined, or other unexpected values
    return new BaseError({
      message: defaultMessage,
      code: ErrorCode.INTERNAL_ERROR,
      category: ErrorCategory.UNEXPECTED,
      context: { originalError: error }
    });
  }
  
  /**
   * Log an error with appropriate severity and context
   * 
   * @param logger Logger instance
   * @param error Error to log
   * @param context Additional context
   */
  public static logError(
    logger: ILogger,
    error: unknown,
    context?: Record<string, any>
  ): void {
    // Normalize the error
    const normalizedError = ErrorHelper.normalizeError(error);
    
    // Combine contexts
    const combinedContext = {
      ...normalizedError.context,
      ...context
    };
    
    // Determine log level based on error category
    if (normalizedError.category === ErrorCategory.VALIDATION ||
        normalizedError.code === ErrorCode.ENTITY_NOT_FOUND) {
      // Validation errors and not-found are usually not critical
      logger.warn(`${normalizedError.name}: ${normalizedError.message}`, combinedContext);
    } else if (normalizedError.category === ErrorCategory.EXTERNAL_SERVICE && 
               normalizedError.statusCode === 429) {
      // Rate limiting is a warning, not an error
      logger.warn(`${normalizedError.name}: ${normalizedError.message}`, combinedContext);
    } else {
      // All other errors are logged as errors
      logger.error(`${normalizedError.name}: ${normalizedError.message}`, combinedContext);
    }
  }
  
  /**
   * Check if an error is of a specific category
   */
  public static isCategory(error: unknown, category: ErrorCategory): boolean {
    if (error instanceof BaseError) {
      return error.category === category;
    }
    return false;
  }
  
  /**
   * Check if an error is a validation error
   */
  public static isValidationError(error: unknown): error is ValidationError {
    return error instanceof ValidationError || 
           (error instanceof BaseError && error.category === ErrorCategory.VALIDATION);
  }
  
  /**
   * Check if an error is a database error
   */
  public static isDatabaseError(error: unknown): error is DatabaseError {
    return error instanceof DatabaseError || 
           (error instanceof BaseError && error.category === ErrorCategory.DATABASE);
  }
  
  /**
   * Check if an error is a not found error
   */
  public static isNotFoundError(error: unknown): boolean {
    return error instanceof BaseError && error.code === ErrorCode.ENTITY_NOT_FOUND;
  }
  
  /**
   * Check if an error is an external service error
   */
  public static isExternalServiceError(error: unknown): error is ExternalServiceError {
    return error instanceof ExternalServiceError || 
           (error instanceof BaseError && error.category === ErrorCategory.EXTERNAL_SERVICE);
  }
  
  /**
   * Check if an error is an authentication/authorization error
   */
  public static isAuthError(error: unknown): error is AuthError {
    return error instanceof AuthError || 
           (error instanceof BaseError && 
             (error.category === ErrorCategory.AUTHENTICATION || 
              error.category === ErrorCategory.AUTHORIZATION));
  }
  
  /**
   * Check if an error is a business logic error
   */
  public static isBusinessError(error: unknown): error is BusinessError {
    return error instanceof BusinessError || 
           (error instanceof BaseError && error.category === ErrorCategory.BUSINESS_LOGIC);
  }
  
  /**
   * Check if an error is an AI error
   */
  public static isAIError(error: unknown): error is AIError {
    return error instanceof AIError;
  }
} 