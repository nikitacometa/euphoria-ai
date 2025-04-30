import { ValidationError, ValidationErrorDetail } from '../classes/validation-error';
import { BaseError, ErrorCategory, ErrorCode } from '../classes/base-error';

describe('ValidationError', () => {
  it('should extend BaseError', () => {
    const error = new ValidationError({
      message: 'Test error'
    });
    
    expect(error).toBeInstanceOf(BaseError);
    expect(error).toBeInstanceOf(ValidationError);
  });
  
  it('should have correct default properties', () => {
    const error = new ValidationError({});
    
    expect(error.message).toBe('Validation failed');
    expect(error.code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(error.category).toBe(ErrorCategory.VALIDATION);
    expect(error.errors).toEqual([]);
  });
  
  it('should store validation errors', () => {
    const errors: ValidationErrorDetail[] = [
      { field: 'email', message: 'Invalid email format' },
      { field: 'password', message: 'Password too short', value: '123' }
    ];
    
    const error = new ValidationError({
      message: 'Multiple validation errors',
      errors
    });
    
    expect(error.errors).toBe(errors);
    expect(error.context).toEqual(expect.objectContaining({
      validationErrors: errors
    }));
  });
  
  it('should create error with custom context and cause', () => {
    const originalError = new Error('Original error');
    const context = { userId: '123' };
    
    const error = new ValidationError({
      message: 'Validation failed',
      context,
      cause: originalError
    });
    
    expect(error.context).toEqual(expect.objectContaining({
      ...context,
      validationErrors: []
    }));
    expect(error.cause).toBe(originalError);
  });
  
  describe('static factory methods', () => {
    it('should create required field error', () => {
      const error = ValidationError.required('email');
      
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe('Validation failed: missing required fields');
      expect(error.errors).toEqual([{
        field: 'email',
        code: ErrorCode.REQUIRED_FIELD,
        message: "'email' is required"
      }]);
    });
    
    it('should create required field error with custom message', () => {
      const error = ValidationError.required('email', 'Email address is required');
      
      expect(error.message).toBe('Email address is required');
      expect(error.errors[0].message).toBe('Email address is required');
    });
    
    it('should create invalid format error', () => {
      const error = ValidationError.invalidFormat('email', 'not-an-email');
      
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe('Validation failed: invalid format');
      expect(error.errors).toEqual([{
        field: 'email',
        code: ErrorCode.INVALID_FORMAT,
        message: "'email' has invalid format",
        value: 'not-an-email'
      }]);
    });
    
    it('should create invalid value error', () => {
      const error = ValidationError.invalidValue('age', -5, 'Age must be positive');
      
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe('Age must be positive');
      expect(error.errors).toEqual([{
        field: 'age',
        code: ErrorCode.INVALID_VALUE,
        message: 'Age must be positive',
        value: -5
      }]);
    });
    
    it('should create error from multiple validation details', () => {
      const errors: ValidationErrorDetail[] = [
        { field: 'email', message: 'Invalid email', code: ErrorCode.INVALID_FORMAT },
        { field: 'password', message: 'Password too short', code: ErrorCode.INVALID_VALUE }
      ];
      
      const error = ValidationError.fromErrors(errors, 'Form has errors');
      
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe('Form has errors');
      expect(error.errors).toBe(errors);
    });
  });
}); 