import { BaseError } from '../classes/base-error';
import { ValidationError } from '../classes/validation-error';
import { ErrorHelper } from '../utils/error-helper';
import { ILogger } from '../../utils/logger/types';

/**
 * Options for the API error handler
 */
export interface ApiErrorHandlerOptions {
  /**
   * Logger instance
   */
  logger: ILogger;
  
  /**
   * Include stack traces in responses (development only)
   */
  includeStack?: boolean;
  
  /**
   * Include detailed error messages (can leak implementation details)
   */
  includeDetails?: boolean;
  
  /**
   * Environment ('development', 'production', etc.)
   */
  environment?: string;
}

/**
 * API error response structure
 */
export interface ApiErrorResponse {
  /**
   * HTTP status code
   */
  statusCode: number;
  
  /**
   * Error response body
   */
  body: {
    /**
     * Indicates request failed
     */
    success: false;
    
    /**
     * Error details
     */
    error: {
      /**
       * Error code
       */
      code: string;
      
      /**
       * User-friendly error message
       */
      message: string;
      
      /**
       * Additional details for validation errors
       */
      details?: any;
      
      /**
       * Stack trace (development only)
       */
      stack?: string;
    };
  };
}

/**
 * Handler for API errors
 */
export class ApiErrorHandler {
  private readonly logger: ILogger;
  private readonly includeStack: boolean;
  private readonly includeDetails: boolean;
  
  /**
   * Create a new API error handler
   * 
   * @param options Handler options
   */
  constructor(options: ApiErrorHandlerOptions) {
    const {
      logger,
      includeStack = false,
      includeDetails = false,
      environment = 'production'
    } = options;
    
    this.logger = logger;
    
    // Only include stack traces in development
    this.includeStack = includeStack && environment !== 'production';
    
    // Be cautious with detailed error messages in production
    this.includeDetails = includeDetails || environment !== 'production';
  }
  
  /**
   * Handle an API error
   * 
   * @param error The error to handle
   * @param additionalContext Additional context for logging
   * @returns Formatted API error response
   */
  public handleError(
    error: unknown,
    additionalContext?: Record<string, any>
  ): ApiErrorResponse {
    // Log the error
    ErrorHelper.logError(this.logger, error, additionalContext);
    
    // Normalize to base error
    const normalizedError = ErrorHelper.normalizeError(error);
    
    // Default response body
    const responseBody: ApiErrorResponse['body'] = {
      success: false,
      error: {
        code: normalizedError.code,
        message: this.getErrorMessage(normalizedError)
      }
    };
    
    // Add validation error details if applicable
    if (normalizedError instanceof ValidationError && normalizedError.errors?.length) {
      responseBody.error.details = normalizedError.errors;
    }
    
    // Add stack trace if enabled
    if (this.includeStack && normalizedError.stack) {
      responseBody.error.stack = normalizedError.stack;
    }
    
    // Use the error's status code or default to 500
    const statusCode = normalizedError.statusCode || 500;
    
    return {
      statusCode,
      body: responseBody
    };
  }
  
  /**
   * Get an appropriate error message based on settings
   * 
   * @param error The error to get a message for
   * @returns Appropriate error message
   */
  private getErrorMessage(error: BaseError): string {
    if (this.includeDetails) {
      // Return the actual error message
      return error.message;
    }
    
    // Use generic messages in production
    // We could also use a mapping here like in error-map.ts
    switch (error.category) {
      case 'validation':
        return 'The request contains invalid data';
      case 'authentication':
        return 'Authentication failed';
      case 'authorization':
        return 'You do not have permission to perform this action';
      case 'database':
        return error.code === 'entity_not_found' 
          ? 'The requested resource was not found' 
          : 'Database operation failed';
      case 'external_service':
        return 'External service request failed';
      case 'business_logic':
        return 'The operation could not be completed due to a business rule violation';
      default:
        return 'An internal server error occurred';
    }
  }
} 