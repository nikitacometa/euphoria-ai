import { BaseError, ErrorCategory, ErrorCode } from './base-error';

/**
 * Options for creating a database error
 */
export interface DatabaseErrorOptions {
  message?: string;
  code?: string;
  operation?: string;
  collection?: string;
  query?: Record<string, any>;
  context?: Record<string, any>;
  cause?: Error | unknown;
}

/**
 * Error thrown when database operations fail
 */
export class DatabaseError extends BaseError {
  /**
   * Name of the database operation that failed
   */
  public readonly operation?: string;
  
  /**
   * Name of the collection/table that was being accessed
   */
  public readonly collection?: string;
  
  /**
   * Query that was being executed
   */
  public readonly query?: Record<string, any>;
  
  /**
   * Create a new database error
   * 
   * @param options Error options
   */
  constructor(options: DatabaseErrorOptions) {
    const { 
      message = 'Database operation failed', 
      code = ErrorCode.DATABASE_ERROR,
      operation,
      collection,
      query,
      context,
      cause
    } = options;
    
    // Create base error with database category
    super({
      message,
      code: code as any, // Assuming we're using a subset of valid error codes
      category: ErrorCategory.DATABASE,
      context: {
        ...context,
        operation,
        collection,
        query
      },
      cause
    });
    
    this.operation = operation;
    this.collection = collection;
    this.query = query;
  }
  
  /**
   * Create an error for when an entity cannot be found
   * 
   * @param entityType Type of entity (e.g., 'user', 'post')
   * @param id Identifier that was searched for
   * @param customMessage Optional custom message
   * @returns DatabaseError instance
   */
  public static notFound(
    entityType: string, 
    id?: string | number, 
    customMessage?: string
  ): DatabaseError {
    const message = customMessage || 
      `${entityType}${id ? ` with ID '${id}'` : ''} not found`;
    
    return new DatabaseError({
      message,
      code: ErrorCode.ENTITY_NOT_FOUND,
      operation: 'find',
      collection: entityType,
      query: id ? { id } : undefined
    });
  }
  
  /**
   * Create an error for when a unique constraint is violated
   * 
   * @param entityType Type of entity (e.g., 'user', 'post')
   * @param field Field that has the unique constraint
   * @param value Value that caused the conflict
   * @param customMessage Optional custom message
   * @returns DatabaseError instance
   */
  public static uniqueConstraint(
    entityType: string,
    field: string,
    value: any,
    customMessage?: string
  ): DatabaseError {
    const message = customMessage || 
      `${entityType} with ${field} '${value}' already exists`;
    
    return new DatabaseError({
      message,
      code: ErrorCode.UNIQUE_CONSTRAINT,
      operation: 'create/update',
      collection: entityType,
      query: { [field]: value }
    });
  }
  
  /**
   * Create an error for when a transaction fails
   * 
   * @param operation Operation that was being performed
   * @param cause Original error that caused the failure
   * @param customMessage Optional custom message
   * @returns DatabaseError instance
   */
  public static transactionFailed(
    operation: string,
    cause: Error,
    customMessage?: string
  ): DatabaseError {
    return new DatabaseError({
      message: customMessage || `Transaction failed during ${operation}`,
      code: ErrorCode.TRANSACTION_FAILED,
      operation,
      cause
    });
  }
  
  /**
   * Create a generic database error with a custom message and cause
   * 
   * @param message Custom error message
   * @param cause Original error that caused the failure
   * @param context Additional context information
   * @returns DatabaseError instance
   */
  public static fromError(
    message: string,
    cause: Error | unknown,
    context?: Record<string, any>
  ): DatabaseError {
    return new DatabaseError({
      message,
      cause,
      context
    });
  }
} 