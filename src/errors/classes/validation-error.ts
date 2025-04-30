import { BaseError, ErrorCategory, ErrorCode } from './base-error';

/**
 * Interface for validation errors
 */
export interface ValidationErrorDetail {
  field: string;
  message: string;
  code?: string;
  value?: any;
}

/**
 * Options for creating a validation error
 */
export interface ValidationErrorOptions {
  message?: string;
  errors?: ValidationErrorDetail[];
  context?: Record<string, any>;
  cause?: Error | unknown;
}

/**
 * Error thrown when input validation fails
 */
export class ValidationError extends BaseError {
  /**
   * List of specific validation errors
   */
  public readonly errors: ValidationErrorDetail[];

  /**
   * Create a new validation error
   * 
   * @param options Error options
   */
  constructor(options: ValidationErrorOptions) {
    const { 
      message = 'Validation failed', 
      errors = [],
      context = {},
      cause
    } = options;

    // Create base error with validation category
    super({
      message,
      code: ErrorCode.VALIDATION_FAILED,
      category: ErrorCategory.VALIDATION,
      context: {
        ...context,
        validationErrors: errors
      },
      cause
    });

    this.errors = errors;
  }

  /**
   * Create a validation error for a required field
   * 
   * @param field Name of the required field
   * @param customMessage Optional custom message
   * @returns ValidationError instance
   */
  public static required(field: string, customMessage?: string): ValidationError {
    return new ValidationError({
      message: customMessage || 'Validation failed: missing required fields',
      errors: [{
        field,
        code: ErrorCode.REQUIRED_FIELD,
        message: customMessage || `'${field}' is required`
      }]
    });
  }

  /**
   * Create a validation error for an invalid field format
   * 
   * @param field Name of the field with invalid format
   * @param value Invalid value
   * @param customMessage Optional custom message
   * @returns ValidationError instance
   */
  public static invalidFormat(field: string, value: any, customMessage?: string): ValidationError {
    return new ValidationError({
      message: customMessage || 'Validation failed: invalid format',
      errors: [{
        field,
        code: ErrorCode.INVALID_FORMAT,
        message: customMessage || `'${field}' has invalid format`,
        value
      }]
    });
  }

  /**
   * Create a validation error for an invalid field value
   * 
   * @param field Name of the field with invalid value
   * @param value Invalid value
   * @param customMessage Optional custom message
   * @returns ValidationError instance
   */
  public static invalidValue(field: string, value: any, customMessage?: string): ValidationError {
    return new ValidationError({
      message: customMessage || 'Validation failed: invalid value',
      errors: [{
        field,
        code: ErrorCode.INVALID_VALUE,
        message: customMessage || `'${field}' has invalid value`,
        value
      }]
    });
  }

  /**
   * Create a validation error from multiple error details
   * 
   * @param errors List of validation error details
   * @param customMessage Optional custom message
   * @returns ValidationError instance
   */
  public static fromErrors(errors: ValidationErrorDetail[], customMessage?: string): ValidationError {
    return new ValidationError({
      message: customMessage || 'Validation failed: multiple errors',
      errors
    });
  }
} 