import { BaseError, ErrorCategory, ErrorCode } from './base-error';

/**
 * Options for creating an authentication error
 */
export interface AuthErrorOptions {
  message?: string;
  code?: string;
  userId?: string | number;
  username?: string;
  requiredPermissions?: string[];
  context?: Record<string, any>;
  cause?: Error | unknown;
}

/**
 * Error thrown when authentication/authorization operations fail
 */
export class AuthError extends BaseError {
  /**
   * ID of the user involved
   */
  public readonly userId?: string | number;
  
  /**
   * Username of the user involved
   */
  public readonly username?: string;
  
  /**
   * Permissions that were required for the operation
   */
  public readonly requiredPermissions?: string[];
  
  /**
   * Create a new authentication error
   * 
   * @param options Error options
   */
  constructor(options: AuthErrorOptions) {
    const { 
      message = 'Authentication failed', 
      code = ErrorCode.AUTHENTICATION_FAILED,
      userId,
      username,
      requiredPermissions,
      context,
      cause
    } = options;
    
    // Determine if this is an auth or authz error based on code
    const category = code === ErrorCode.INSUFFICIENT_PERMISSIONS || 
                    code === ErrorCode.UNAUTHORIZED
      ? ErrorCategory.AUTHORIZATION
      : ErrorCategory.AUTHENTICATION;
    
    // Create base error
    super({
      message,
      code: code as any, // Type cast since we're using a subset of codes
      category,
      context: {
        ...context,
        userId,
        username,
        requiredPermissions
      },
      cause
    });
    
    this.userId = userId;
    this.username = username;
    this.requiredPermissions = requiredPermissions;
  }
  
  /**
   * Create an error for when authentication credentials are invalid
   * 
   * @param customMessage Optional custom message
   * @param userId Optional user ID
   * @param username Optional username
   * @returns AuthError instance
   */
  public static invalidCredentials(
    customMessage?: string,
    userId?: string | number,
    username?: string
  ): AuthError {
    return new AuthError({
      message: customMessage || 'Invalid credentials provided',
      code: ErrorCode.INVALID_CREDENTIALS,
      userId,
      username
    });
  }
  
  /**
   * Create an error for when an authentication token has expired
   * 
   * @param customMessage Optional custom message
   * @param userId Optional user ID
   * @param username Optional username
   * @returns AuthError instance
   */
  public static tokenExpired(
    customMessage?: string,
    userId?: string | number,
    username?: string
  ): AuthError {
    return new AuthError({
      message: customMessage || 'Authentication token has expired',
      code: ErrorCode.TOKEN_EXPIRED,
      userId,
      username
    });
  }
  
  /**
   * Create an error for when a user lacks sufficient permissions
   * 
   * @param requiredPermissions Permissions required for the operation
   * @param customMessage Optional custom message
   * @param userId Optional user ID
   * @param username Optional username
   * @returns AuthError instance
   */
  public static insufficientPermissions(
    requiredPermissions: string[],
    customMessage?: string,
    userId?: string | number,
    username?: string
  ): AuthError {
    const permissionsText = requiredPermissions.join(', ');
    
    return new AuthError({
      message: customMessage || `Insufficient permissions. Required: ${permissionsText}`,
      code: ErrorCode.INSUFFICIENT_PERMISSIONS,
      userId,
      username,
      requiredPermissions
    });
  }
  
  /**
   * Create an error for when a user is not authenticated
   * 
   * @param customMessage Optional custom message
   * @returns AuthError instance
   */
  public static notAuthenticated(
    customMessage?: string
  ): AuthError {
    return new AuthError({
      message: customMessage || 'Authentication required',
      code: ErrorCode.AUTHENTICATION_FAILED
    });
  }
  
  /**
   * Create an error for when a user is not authorized for an operation
   * 
   * @param operation Operation that was attempted
   * @param customMessage Optional custom message
   * @param userId Optional user ID
   * @param username Optional username
   * @returns AuthError instance
   */
  public static notAuthorized(
    operation: string,
    customMessage?: string,
    userId?: string | number,
    username?: string
  ): AuthError {
    return new AuthError({
      message: customMessage || `Not authorized for operation: ${operation}`,
      code: ErrorCode.UNAUTHORIZED,
      userId,
      username,
      context: { operation }
    });
  }
} 