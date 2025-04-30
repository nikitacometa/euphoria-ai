import { BaseError, ErrorCategory, ErrorCode, ErrorCodeString } from './base-error';

/**
 * Options for creating an external service error
 */
export interface ExternalServiceErrorOptions {
  message?: string;
  code?: ErrorCodeString;
  service: string;
  endpoint?: string;
  requestId?: string;
  statusCode?: number;
  responseData?: any;
  context?: Record<string, any>;
  cause?: Error | unknown;
}

/**
 * Error thrown when external service calls fail
 */
export class ExternalServiceError extends BaseError {
  /**
   * Name of the external service
   */
  public readonly service: string;
  
  /**
   * Endpoint that was called
   */
  public readonly endpoint?: string;
  
  /**
   * External request identifier
   */
  public readonly requestId?: string;
  
  /**
   * HTTP status code from the response
   */
  public readonly externalStatusCode?: number;
  
  /**
   * Response data from the external service
   */
  public readonly responseData?: any;
  
  /**
   * Create a new external service error
   * 
   * @param options Error options
   */
  constructor(options: ExternalServiceErrorOptions) {
    const { 
      message = 'External service request failed', 
      code = ErrorCode.API_ERROR,
      service,
      endpoint,
      requestId,
      statusCode,
      responseData,
      context,
      cause
    } = options;
    
    // Create base error with external service category
    super({
      message,
      code,
      category: ErrorCategory.EXTERNAL_SERVICE,
      context: {
        ...context,
        service,
        endpoint,
        requestId,
        statusCode,
        responseData
      },
      cause,
      // Use the status code from options or map from the error code
      statusCode
    });
    
    this.service = service;
    this.endpoint = endpoint;
    this.requestId = requestId;
    this.externalStatusCode = statusCode;
    this.responseData = responseData;
  }
  
  /**
   * Create an error for when a service is unavailable
   * 
   * @param service Name of the service
   * @param endpoint Endpoint that was called
   * @param cause Original error that caused the failure
   * @param customMessage Optional custom message
   * @returns ExternalServiceError instance
   */
  public static serviceUnavailable(
    service: string,
    endpoint?: string,
    cause?: Error | unknown,
    customMessage?: string
  ): ExternalServiceError {
    return new ExternalServiceError({
      message: customMessage || `${service} service is unavailable`,
      code: ErrorCode.SERVICE_UNAVAILABLE,
      service,
      endpoint,
      statusCode: 503,
      cause
    });
  }
  
  /**
   * Create an error for when a request is rate limited
   * 
   * @param service Name of the service
   * @param endpoint Endpoint that was called
   * @param retryAfter Seconds to wait before retrying
   * @param customMessage Optional custom message
   * @returns ExternalServiceError instance
   */
  public static rateLimited(
    service: string,
    endpoint?: string,
    retryAfter?: number,
    customMessage?: string
  ): ExternalServiceError {
    return new ExternalServiceError({
      message: customMessage || `${service} rate limit exceeded`,
      code: ErrorCode.RATE_LIMITED,
      service,
      endpoint,
      statusCode: 429,
      context: retryAfter ? { retryAfter } : undefined
    });
  }
  
  /**
   * Create an error for when a network error occurs
   * 
   * @param service Name of the service
   * @param cause Original error that caused the failure
   * @param customMessage Optional custom message
   * @returns ExternalServiceError instance
   */
  public static networkError(
    service: string,
    cause: Error | unknown,
    customMessage?: string
  ): ExternalServiceError {
    return new ExternalServiceError({
      message: customMessage || `Network error communicating with ${service}`,
      code: ErrorCode.NETWORK_ERROR,
      service,
      cause
    });
  }
  
  /**
   * Create an error from an HTTP response
   * 
   * @param service Name of the service
   * @param endpoint Endpoint that was called
   * @param statusCode HTTP status code
   * @param responseData Response data or error
   * @param customMessage Optional custom message
   * @returns ExternalServiceError instance
   */
  public static fromResponse(
    service: string,
    endpoint: string,
    statusCode: number,
    responseData?: any,
    customMessage?: string
  ): ExternalServiceError {
    let code: ErrorCodeString = ErrorCode.API_ERROR;
    
    // Map status code to appropriate error code
    if (statusCode >= 500) {
      code = ErrorCode.SERVICE_UNAVAILABLE;
    } else if (statusCode === 429) {
      code = ErrorCode.RATE_LIMITED;
    } else if (statusCode === 401 || statusCode === 403) {
      code = ErrorCode.AUTHENTICATION_FAILED;
    }
    
    // Extract request ID if available in response
    const requestId = responseData?.requestId || 
                      responseData?.request_id ||
                      responseData?.id;
    
    return new ExternalServiceError({
      message: customMessage || `${service} API error: ${statusCode}`,
      code,
      service,
      endpoint,
      statusCode,
      requestId: requestId?.toString(),
      responseData
    });
  }
  
  /**
   * Create a specific error for the OpenAI API
   * 
   * @param endpoint OpenAI API endpoint 
   * @param statusCode HTTP status code
   * @param responseData Response data
   * @param customMessage Optional custom message
   * @returns ExternalServiceError instance for OpenAI
   */
  public static openAI(
    endpoint: string,
    statusCode?: number,
    responseData?: any,
    customMessage?: string
  ): ExternalServiceError {
    return ExternalServiceError.fromResponse(
      'OpenAI',
      endpoint,
      statusCode || 500,
      responseData,
      customMessage || 'OpenAI API error'
    );
  }
} 