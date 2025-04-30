// Export base error types and constants
export * from './base-error';

// Export specific error classes
export * from './validation-error';
export * from './database-error';
export * from './external-service-error';

// Note: Don't export AIError here to avoid circular dependencies
// It will be exported from the main errors/index.ts file 