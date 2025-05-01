/**
 * Base class for API-related errors.
 */
export class ApiError extends Error {
  public readonly statusCode?: number;
  public readonly details?: unknown;

  constructor(message: string, statusCode?: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
    // Maintains proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }
}

/**
 * Error for non-2xx API responses.
 */
export class ApiHttpError extends ApiError {
  constructor(statusCode: number, message: string, details?: unknown) {
    super(`API request failed with status ${statusCode}: ${message}`, statusCode, details);
    this.name = 'ApiHttpError';
  }
}

/**
 * Error for network issues or timeouts during API requests.
 */
export class ApiNetworkError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(`API network error: ${message}`, undefined, details);
    this.name = 'ApiNetworkError';
  }
}

// Add more specific error types as needed, e.g., ApiRateLimitError, ApiAuthenticationError 