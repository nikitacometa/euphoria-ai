/**
 * Error category for grouping errors by domain
 */
export enum ErrorCategory {
  VALIDATION = 'validation',
  DATABASE = 'database',
  EXTERNAL_SERVICE = 'external_service',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  BUSINESS_LOGIC = 'business_logic',
  INFRASTRUCTURE = 'infrastructure',
  UNEXPECTED = 'unexpected'
}

/**
 * Standard error code dictionary for consistent error handling
 */
export const ErrorCode = {
  // General errors
  INTERNAL_ERROR: 'internal_error',
  NOT_IMPLEMENTED: 'not_implemented',
  INVALID_OPERATION: 'invalid_operation',
  TIMEOUT: 'timeout',
  
  // Validation errors
  VALIDATION_FAILED: 'validation_failed',
  REQUIRED_FIELD: 'required_field',
  INVALID_FORMAT: 'invalid_format',
  INVALID_VALUE: 'invalid_value',
  
  // Authentication errors
  AUTHENTICATION_FAILED: 'authentication_failed',
  INVALID_CREDENTIALS: 'invalid_credentials',
  TOKEN_EXPIRED: 'token_expired',
  
  // Authorization errors
  UNAUTHORIZED: 'unauthorized',
  INSUFFICIENT_PERMISSIONS: 'insufficient_permissions',
  
  // Database errors
  DATABASE_ERROR: 'database_error',
  ENTITY_NOT_FOUND: 'entity_not_found',
  UNIQUE_CONSTRAINT: 'unique_constraint',
  FOREIGN_KEY_CONSTRAINT: 'foreign_key_constraint',
  TRANSACTION_FAILED: 'transaction_failed',
  
  // External service errors
  SERVICE_UNAVAILABLE: 'service_unavailable',
  API_ERROR: 'api_error',
  NETWORK_ERROR: 'network_error',
  RATE_LIMITED: 'rate_limited',
  
  // Business logic errors
  BUSINESS_RULE_VIOLATION: 'business_rule_violation',
  OPERATION_NOT_ALLOWED: 'operation_not_allowed',
  STATE_CONFLICT: 'state_conflict',
  
  // Infrastructure errors
  CONFIGURATION_ERROR: 'configuration_error',
  DEPENDENCY_ERROR: 'dependency_error',
  RESOURCE_EXHAUSTED: 'resource_exhausted'
} as const;

export type ErrorCodeString = typeof ErrorCode[keyof typeof ErrorCode];

/**
 * HTTP status codes that can be mapped to error codes
 */
export const HttpStatusCode = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
} as const;

/**
 * Maps error codes to HTTP status codes for API responses
 */
export const errorCodeToStatusCode: Record<ErrorCodeString, number> = {
  // General errors
  [ErrorCode.INTERNAL_ERROR]: HttpStatusCode.INTERNAL_SERVER_ERROR,
  [ErrorCode.NOT_IMPLEMENTED]: HttpStatusCode.NOT_IMPLEMENTED,
  [ErrorCode.INVALID_OPERATION]: HttpStatusCode.BAD_REQUEST,
  [ErrorCode.TIMEOUT]: HttpStatusCode.GATEWAY_TIMEOUT,
  
  // Validation errors
  [ErrorCode.VALIDATION_FAILED]: HttpStatusCode.UNPROCESSABLE_ENTITY,
  [ErrorCode.REQUIRED_FIELD]: HttpStatusCode.UNPROCESSABLE_ENTITY,
  [ErrorCode.INVALID_FORMAT]: HttpStatusCode.UNPROCESSABLE_ENTITY,
  [ErrorCode.INVALID_VALUE]: HttpStatusCode.UNPROCESSABLE_ENTITY,
  
  // Authentication errors
  [ErrorCode.AUTHENTICATION_FAILED]: HttpStatusCode.UNAUTHORIZED,
  [ErrorCode.INVALID_CREDENTIALS]: HttpStatusCode.UNAUTHORIZED,
  [ErrorCode.TOKEN_EXPIRED]: HttpStatusCode.UNAUTHORIZED,
  
  // Authorization errors
  [ErrorCode.UNAUTHORIZED]: HttpStatusCode.FORBIDDEN,
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: HttpStatusCode.FORBIDDEN,
  
  // Database errors
  [ErrorCode.DATABASE_ERROR]: HttpStatusCode.INTERNAL_SERVER_ERROR,
  [ErrorCode.ENTITY_NOT_FOUND]: HttpStatusCode.NOT_FOUND,
  [ErrorCode.UNIQUE_CONSTRAINT]: HttpStatusCode.CONFLICT,
  [ErrorCode.FOREIGN_KEY_CONSTRAINT]: HttpStatusCode.BAD_REQUEST,
  [ErrorCode.TRANSACTION_FAILED]: HttpStatusCode.INTERNAL_SERVER_ERROR,
  
  // External service errors
  [ErrorCode.SERVICE_UNAVAILABLE]: HttpStatusCode.SERVICE_UNAVAILABLE,
  [ErrorCode.API_ERROR]: HttpStatusCode.BAD_GATEWAY,
  [ErrorCode.NETWORK_ERROR]: HttpStatusCode.BAD_GATEWAY,
  [ErrorCode.RATE_LIMITED]: HttpStatusCode.TOO_MANY_REQUESTS,
  
  // Business logic errors
  [ErrorCode.BUSINESS_RULE_VIOLATION]: HttpStatusCode.UNPROCESSABLE_ENTITY,
  [ErrorCode.OPERATION_NOT_ALLOWED]: HttpStatusCode.FORBIDDEN,
  [ErrorCode.STATE_CONFLICT]: HttpStatusCode.CONFLICT,
  
  // Infrastructure errors
  [ErrorCode.CONFIGURATION_ERROR]: HttpStatusCode.INTERNAL_SERVER_ERROR,
  [ErrorCode.DEPENDENCY_ERROR]: HttpStatusCode.INTERNAL_SERVER_ERROR,
  [ErrorCode.RESOURCE_EXHAUSTED]: HttpStatusCode.SERVICE_UNAVAILABLE
};

/**
 * Options for creating a new BaseError
 */
export interface BaseErrorOptions {
  message: string;
  code: ErrorCodeString;
  category: ErrorCategory;
  context?: Record<string, any>;
  cause?: Error | unknown;
  statusCode?: number;
}

/**
 * Base error class for all application errors
 * Extends the native Error class with additional properties
 */
export class BaseError extends Error {
  /**
   * Unique error code
   */
  public readonly code: ErrorCodeString;
  
  /**
   * Error category for grouping
   */
  public readonly category: ErrorCategory;
  
  /**
   * Additional context information about the error
   */
  public readonly context?: Record<string, any>;
  
  /**
   * Original error that caused this error (if any)
   */
  public readonly cause?: Error | unknown;
  
  /**
   * HTTP status code for this error
   */
  public readonly statusCode: number;
  
  /**
   * Timestamp when this error was created
   */
  public readonly timestamp: Date;
  
  /**
   * Create a new BaseError
   */
  constructor(options: BaseErrorOptions) {
    const { 
      message, 
      code, 
      category, 
      context, 
      cause,
      statusCode 
    } = options;
    
    super(message);
    
    // Set error properties
    this.name = this.constructor.name;
    this.code = code;
    this.category = category;
    this.context = context;
    this.cause = cause;
    this.timestamp = new Date();
    
    // Set status code, either explicitly or from the mapping
    this.statusCode = statusCode ?? errorCodeToStatusCode[code];
    
    // Ensure prototype chain is correctly maintained
    Object.setPrototypeOf(this, new.target.prototype);
    
    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
    
    // Enhance stack trace with cause if available
    if (cause instanceof Error && cause.stack) {
      this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
    }
  }
  
  /**
   * Convert the error to a plain object suitable for logging or serialization
   */
  public toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      category: this.category,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
      cause: this.cause instanceof Error 
        ? {
            name: this.cause.name,
            message: this.cause.message,
            stack: this.cause.stack
          }
        : this.cause
    };
  }
  
  /**
   * Check if this error is of a specific category
   */
  public isCategory(category: ErrorCategory): boolean {
    return this.category === category;
  }
} 