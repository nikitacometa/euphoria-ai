import { BaseError, ErrorCategory, ErrorCode, ErrorCodeString } from './base-error';

/**
 * Options for creating an infrastructure error
 */
export interface InfrastructureErrorOptions {
  message: string;
  code?: ErrorCodeString;
  component?: string;
  context?: Record<string, any>;
  cause?: Error | unknown;
}

/**
 * Error thrown when there are issues with application infrastructure
 * (configuration, dependencies, etc.)
 */
export class InfrastructureError extends BaseError {
  /**
   * Name of the infrastructure component that failed
   */
  public readonly component?: string;
  
  /**
   * Create a new infrastructure error
   * 
   * @param options Error options
   */
  constructor(options: InfrastructureErrorOptions) {
    const { 
      message, 
      code = ErrorCode.INTERNAL_ERROR,
      component,
      context,
      cause
    } = options;
    
    // Create base error with infrastructure category
    super({
      message,
      code,
      category: ErrorCategory.INFRASTRUCTURE,
      context: {
        ...context,
        component
      },
      cause
    });
    
    this.component = component;
  }
  
  /**
   * Create an error for configuration issues
   * 
   * @param configKey Configuration key that has an issue
   * @param details Details about the configuration problem
   * @param component Optional component name
   * @param cause Optional underlying error
   * @returns InfrastructureError instance
   */
  public static configurationError(
    configKey: string,
    details: string,
    component?: string,
    cause?: Error | unknown
  ): InfrastructureError {
    return new InfrastructureError({
      message: `Configuration error for '${configKey}': ${details}`,
      code: ErrorCode.CONFIGURATION_ERROR,
      component,
      context: { configKey },
      cause
    });
  }
  
  /**
   * Create an error for dependency issues
   * 
   * @param dependencyName Name of the dependency
   * @param details Details about the dependency problem
   * @param component Optional component name
   * @param cause Optional underlying error
   * @returns InfrastructureError instance
   */
  public static dependencyError(
    dependencyName: string,
    details: string,
    component?: string,
    cause?: Error | unknown
  ): InfrastructureError {
    return new InfrastructureError({
      message: `Dependency '${dependencyName}' failed: ${details}`,
      code: ErrorCode.DEPENDENCY_ERROR,
      component,
      context: { dependencyName },
      cause
    });
  }
  
  /**
   * Create an error for resource exhaustion issues
   * 
   * @param resourceType Type of resource (memory, connections, etc.)
   * @param details Details about the resource issue
   * @param component Optional component name
   * @returns InfrastructureError instance
   */
  public static resourceExhausted(
    resourceType: string,
    details: string,
    component?: string
  ): InfrastructureError {
    return new InfrastructureError({
      message: `Resource exhausted (${resourceType}): ${details}`,
      code: ErrorCode.RESOURCE_EXHAUSTED,
      component,
      context: { resourceType }
    });
  }
  
  /**
   * Create an error for unimplemented features
   * 
   * @param feature Name of the unimplemented feature
   * @param component Optional component name
   * @returns InfrastructureError instance
   */
  public static notImplemented(
    feature: string,
    component?: string
  ): InfrastructureError {
    return new InfrastructureError({
      message: `Feature not implemented: ${feature}`,
      code: ErrorCode.NOT_IMPLEMENTED,
      component,
      context: { feature }
    });
  }
} 