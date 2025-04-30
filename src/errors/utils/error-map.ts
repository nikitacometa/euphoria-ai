import { BaseError, ErrorCode } from '../classes/base-error';

/**
 * Map of friendly error messages for end users
 */
export const USER_FRIENDLY_MESSAGES: Record<string, string> = {
  // General errors
  [ErrorCode.INTERNAL_ERROR]: 'Sorry, something went wrong on our end. We\'re working on it!',
  [ErrorCode.INVALID_OPERATION]: 'Sorry, that operation is not valid right now.',
  [ErrorCode.TIMEOUT]: 'The operation timed out. Please try again later.',
  
  // Validation errors
  [ErrorCode.VALIDATION_FAILED]: 'Some information you provided is invalid.',
  [ErrorCode.REQUIRED_FIELD]: 'Some required information is missing.',
  [ErrorCode.INVALID_FORMAT]: 'Some information you provided has an invalid format.',
  [ErrorCode.INVALID_VALUE]: 'Some information you provided has an invalid value.',
  
  // Authentication errors
  [ErrorCode.AUTHENTICATION_FAILED]: 'Authentication failed. Please try again.',
  [ErrorCode.INVALID_CREDENTIALS]: 'The credentials you provided are invalid.',
  [ErrorCode.TOKEN_EXPIRED]: 'Your session has expired. Please log in again.',
  
  // Authorization errors
  [ErrorCode.UNAUTHORIZED]: 'You don\'t have permission to perform this action.',
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: 'You don\'t have sufficient permissions for this action.',
  
  // Database errors
  [ErrorCode.DATABASE_ERROR]: 'We\'re having trouble with our database. Please try again later.',
  [ErrorCode.ENTITY_NOT_FOUND]: 'The requested item could not be found.',
  [ErrorCode.UNIQUE_CONSTRAINT]: 'This item already exists.',
  
  // External service errors
  [ErrorCode.SERVICE_UNAVAILABLE]: 'One of our services is currently unavailable. Please try again later.',
  [ErrorCode.API_ERROR]: 'We\'re having trouble communicating with an external service.',
  [ErrorCode.NETWORK_ERROR]: 'There was a network error. Please check your connection and try again.',
  [ErrorCode.RATE_LIMITED]: 'You\'ve made too many requests. Please wait a moment and try again.',
  
  // Business logic errors
  [ErrorCode.BUSINESS_RULE_VIOLATION]: 'This operation violates a business rule.',
  [ErrorCode.OPERATION_NOT_ALLOWED]: 'This operation is not allowed in the current context.',
  [ErrorCode.STATE_CONFLICT]: 'The current state prevents this operation.',
};

/**
 * Map of telegram-styled error messages (with emojis)
 */
export const TELEGRAM_FRIENDLY_MESSAGES: Record<string, string> = {
  // General errors
  [ErrorCode.INTERNAL_ERROR]: '✨ Oops! Something went wrong on our end. We\'re looking into it!',
  [ErrorCode.INVALID_OPERATION]: '✨ Hmm, that doesn\'t seem like a valid action right now.',
  [ErrorCode.TIMEOUT]: '✨ The operation took too long. Please try again in a moment.',
  [ErrorCode.NOT_IMPLEMENTED]: '✨ This feature isn\'t available yet, but we\'re working on it!',
  
  // Validation errors
  [ErrorCode.VALIDATION_FAILED]: '✨ Some of the information you provided doesn\'t seem right.',
  [ErrorCode.REQUIRED_FIELD]: '✨ Looks like some required information is missing.',
  [ErrorCode.INVALID_FORMAT]: '✨ Something you entered isn\'t in the right format.',
  [ErrorCode.INVALID_VALUE]: '✨ One of your entries has an invalid value.',
  
  // Authentication errors
  [ErrorCode.AUTHENTICATION_FAILED]: '✨ I couldn\'t authenticate you. Let\'s try again?',
  [ErrorCode.INVALID_CREDENTIALS]: '✨ The credentials you provided don\'t match our records.',
  [ErrorCode.TOKEN_EXPIRED]: '✨ Your session has expired. Please start again with /start.',
  
  // Authorization errors
  [ErrorCode.UNAUTHORIZED]: '✨ You don\'t have permission to do this action.',
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: '✨ You need additional permissions for this action.',
  
  // Database errors
  [ErrorCode.DATABASE_ERROR]: '✨ I\'m having trouble with my memory right now. Let\'s try again soon!',
  [ErrorCode.ENTITY_NOT_FOUND]: '✨ I couldn\'t find what you\'re looking for.',
  [ErrorCode.UNIQUE_CONSTRAINT]: '✨ This already exists! Let\'s try something different.',
  
  // External service errors
  [ErrorCode.SERVICE_UNAVAILABLE]: '✨ One of our magical services is taking a break. Please try again later!',
  [ErrorCode.API_ERROR]: '✨ I\'m having trouble communicating with the universe right now.',
  [ErrorCode.NETWORK_ERROR]: '✨ The cosmic connection seems unstable. Please try again.',
  [ErrorCode.RATE_LIMITED]: '✨ Whoa there! You\'re moving too fast for me. Let\'s slow down a bit.',
  
  // Business logic errors
  [ErrorCode.BUSINESS_RULE_VIOLATION]: '✨ That breaks one of our mystical rules.',
  [ErrorCode.OPERATION_NOT_ALLOWED]: '✨ I can\'t do that in the current situation.',
  [ErrorCode.STATE_CONFLICT]: '✨ The stars aren\'t aligned correctly for this action.',
  
  // AI-related errors
  'AI_ERROR': '✨ My crystal ball is cloudy right now. Let\'s try again in a moment.',
};

/**
 * Get a user-friendly error message for an error
 * 
 * @param error Error to get friendly message for
 * @param defaultMessage Default message if no mapping exists
 * @returns User-friendly error message
 */
export function getUserFriendlyMessage(
  error: unknown,
  defaultMessage: string = 'An unexpected error occurred. Please try again.'
): string {
  if (error instanceof BaseError) {
    return USER_FRIENDLY_MESSAGES[error.code] || error.message || defaultMessage;
  }
  
  if (error instanceof Error) {
    return error.message || defaultMessage;
  }
  
  if (typeof error === 'string') {
    return error || defaultMessage;
  }
  
  return defaultMessage;
}

/**
 * Get a Telegram-styled error message for an error
 * 
 * @param error Error to get friendly message for
 * @param defaultMessage Default message if no mapping exists
 * @returns Telegram-styled error message
 */
export function getTelegramFriendlyMessage(
  error: unknown,
  defaultMessage: string = '✨ Oops! Something unexpected happened. Please try again later.'
): string {
  if (error instanceof BaseError) {
    return TELEGRAM_FRIENDLY_MESSAGES[error.code] || 
           `✨ ${error.message}` || 
           defaultMessage;
  }
  
  if (error instanceof Error) {
    return `✨ ${error.message}` || defaultMessage;
  }
  
  if (typeof error === 'string') {
    return `✨ ${error}` || defaultMessage;
  }
  
  return defaultMessage;
} 