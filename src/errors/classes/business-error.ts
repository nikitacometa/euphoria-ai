import { BaseError, ErrorCategory, ErrorCode, ErrorCodeString } from './base-error';

/**
 * Options for creating a business error
 */
export interface BusinessErrorOptions {
  message: string;
  code?: ErrorCodeString;
  operation?: string;
  entityType?: string;
  entityId?: string | number;
  context?: Record<string, any>;
  cause?: Error | unknown;
}

/**
 * Error thrown when business rules or logic constraints are violated
 */
export class BusinessError extends BaseError {
  /**
   * Name of the business operation that failed
   */
  public readonly operation?: string;
  
  /**
   * Type of entity involved in the operation
   */
  public readonly entityType?: string;
  
  /**
   * ID of the entity involved in the operation
   */
  public readonly entityId?: string | number;
  
  /**
   * Create a new business error
   * 
   * @param options Error options
   */
  constructor(options: BusinessErrorOptions) {
    const { 
      message, 
      code = ErrorCode.BUSINESS_RULE_VIOLATION,
      operation,
      entityType,
      entityId,
      context,
      cause
    } = options;
    
    // Create base error with business logic category
    super({
      message,
      code,
      category: ErrorCategory.BUSINESS_LOGIC,
      context: {
        ...context,
        operation,
        entityType,
        entityId
      },
      cause
    });
    
    this.operation = operation;
    this.entityType = entityType;
    this.entityId = entityId;
  }
  
  /**
   * Create an error for when an operation is not allowed
   * 
   * @param operation Name of the operation
   * @param reason Reason why the operation is not allowed
   * @param entityType Optional entity type
   * @param entityId Optional entity ID
   * @returns BusinessError instance
   */
  public static operationNotAllowed(
    operation: string,
    reason: string,
    entityType?: string,
    entityId?: string | number
  ): BusinessError {
    const entity = entityType 
      ? `${entityType}${entityId ? ` (${entityId})` : ''}`
      : 'resource';
    
    return new BusinessError({
      message: `Operation ${operation} not allowed on ${entity}: ${reason}`,
      code: ErrorCode.OPERATION_NOT_ALLOWED,
      operation,
      entityType,
      entityId
    });
  }
  
  /**
   * Create an error for when there's a state conflict
   * 
   * @param entityType Type of entity
   * @param entityId Entity ID
   * @param currentState Current state of the entity
   * @param expectedState Expected state of the entity
   * @param operation Optional operation that caused the conflict
   * @returns BusinessError instance
   */
  public static stateConflict(
    entityType: string,
    entityId: string | number,
    currentState: string,
    expectedState: string,
    operation?: string
  ): BusinessError {
    return new BusinessError({
      message: `${entityType} (${entityId}) is in state '${currentState}', expected '${expectedState}'`,
      code: ErrorCode.STATE_CONFLICT,
      operation,
      entityType,
      entityId,
      context: {
        currentState,
        expectedState
      }
    });
  }
  
  /**
   * Create an error for when a business rule is violated
   * 
   * @param rule Name or description of the rule
   * @param details Details about the violation
   * @param entityType Optional entity type
   * @param entityId Optional entity ID
   * @returns BusinessError instance
   */
  public static ruleViolation(
    rule: string,
    details: string,
    entityType?: string,
    entityId?: string | number
  ): BusinessError {
    const entity = entityType 
      ? `for ${entityType}${entityId ? ` (${entityId})` : ''}`
      : '';
    
    return new BusinessError({
      message: `Business rule '${rule}' violated ${entity}: ${details}`,
      code: ErrorCode.BUSINESS_RULE_VIOLATION,
      entityType,
      entityId,
      context: {
        rule,
        violationDetails: details
      }
    });
  }
} 