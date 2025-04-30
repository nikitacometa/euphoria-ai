import { BaseError, ErrorCategory, ErrorCode, HttpStatusCode } from '../classes/base-error';

describe('BaseError', () => {
  it('should create error with default properties', () => {
    const error = new BaseError({
      message: 'Test error',
      code: ErrorCode.INTERNAL_ERROR,
      category: ErrorCategory.UNEXPECTED
    });
    
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(BaseError);
    expect(error.message).toBe('Test error');
    expect(error.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(error.category).toBe(ErrorCategory.UNEXPECTED);
    expect(error.statusCode).toBe(HttpStatusCode.INTERNAL_SERVER_ERROR);
    expect(error.timestamp).toBeInstanceOf(Date);
    expect(error.context).toBeUndefined();
    expect(error.cause).toBeUndefined();
  });
  
  it('should create error with all provided properties', () => {
    const originalError = new Error('Original error');
    const context = { userId: '123', action: 'test' };
    
    const error = new BaseError({
      message: 'Test error',
      code: ErrorCode.VALIDATION_FAILED,
      category: ErrorCategory.VALIDATION,
      context,
      cause: originalError,
      statusCode: 422
    });
    
    expect(error.message).toBe('Test error');
    expect(error.code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(error.category).toBe(ErrorCategory.VALIDATION);
    expect(error.statusCode).toBe(422);
    expect(error.context).toBe(context);
    expect(error.cause).toBe(originalError);
  });
  
  it('should derive status code from error code if not explicitly provided', () => {
    // Create errors with different codes and check the derived status codes
    const validationError = new BaseError({
      message: 'Validation error',
      code: ErrorCode.VALIDATION_FAILED,
      category: ErrorCategory.VALIDATION
    });
    
    const notFoundError = new BaseError({
      message: 'Not found',
      code: ErrorCode.ENTITY_NOT_FOUND,
      category: ErrorCategory.DATABASE
    });
    
    const authError = new BaseError({
      message: 'Unauthorized',
      code: ErrorCode.UNAUTHORIZED,
      category: ErrorCategory.AUTHORIZATION
    });
    
    expect(validationError.statusCode).toBe(HttpStatusCode.UNPROCESSABLE_ENTITY);
    expect(notFoundError.statusCode).toBe(HttpStatusCode.NOT_FOUND);
    expect(authError.statusCode).toBe(HttpStatusCode.FORBIDDEN);
  });
  
  it('should maintain proper prototype chain and stack trace', () => {
    const error = new BaseError({
      message: 'Test error',
      code: ErrorCode.INTERNAL_ERROR,
      category: ErrorCategory.UNEXPECTED
    });
    
    // Check prototype chain
    expect(Object.getPrototypeOf(error)).toBe(BaseError.prototype);
    expect(error instanceof BaseError).toBe(true);
    expect(error instanceof Error).toBe(true);
    
    // Stack trace should exist
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('BaseError');
  });
  
  it('should include cause in stack trace when provided', () => {
    const originalError = new Error('Original error');
    originalError.stack = 'Error: Original error\n    at someFunction (file.js:123:45)';
    
    const error = new BaseError({
      message: 'Wrapper error',
      code: ErrorCode.INTERNAL_ERROR,
      category: ErrorCategory.UNEXPECTED,
      cause: originalError
    });
    
    expect(error.stack).toContain('Caused by: Error: Original error');
    expect(error.stack).toContain('at someFunction (file.js:123:45)');
  });
  
  it('should convert to JSON with all properties', () => {
    const originalError = new Error('Original error');
    const context = { userId: '123', action: 'test' };
    
    const error = new BaseError({
      message: 'Test error',
      code: ErrorCode.VALIDATION_FAILED,
      category: ErrorCategory.VALIDATION,
      context,
      cause: originalError
    });
    
    const json = error.toJSON();
    
    expect(json).toEqual(expect.objectContaining({
      name: 'BaseError',
      message: 'Test error',
      code: ErrorCode.VALIDATION_FAILED,
      category: ErrorCategory.VALIDATION,
      context,
      timestamp: expect.any(String),
      stack: expect.any(String),
      cause: {
        name: 'Error',
        message: 'Original error',
        stack: expect.any(String)
      }
    }));
    
    // Timestamp should be formatted as ISO string
    expect(new Date(json.timestamp).toISOString()).toBe(json.timestamp);
  });
  
  it('should properly check category with isCategory method', () => {
    const error = new BaseError({
      message: 'Test error',
      code: ErrorCode.VALIDATION_FAILED,
      category: ErrorCategory.VALIDATION
    });
    
    expect(error.isCategory(ErrorCategory.VALIDATION)).toBe(true);
    expect(error.isCategory(ErrorCategory.DATABASE)).toBe(false);
    expect(error.isCategory(ErrorCategory.UNEXPECTED)).toBe(false);
  });
}); 