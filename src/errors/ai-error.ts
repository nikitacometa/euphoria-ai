import { ErrorCategory, ErrorCode, ErrorCodeString } from './classes/base-error';
import { ExternalServiceError } from './classes/external-service-error';

/**
 * AI model type
 */
export enum AIModel {
  GPT_3_5 = 'gpt-3.5-turbo',
  GPT_4 = 'gpt-4',
  GPT_4_TURBO = 'gpt-4-turbo',
  CLAUDE_INSTANT = 'claude-instant',
  CLAUDE_2 = 'claude-2',
  UNKNOWN = 'unknown'
}

/**
 * AI operation type
 */
export enum AIOperation {
  TEXT_GENERATION = 'text-generation',
  CHAT_COMPLETION = 'chat-completion',
  EMBEDDINGS = 'embeddings',
  TRANSCRIPTION = 'transcription',
  TRANSLATION = 'translation',
  ANALYSIS = 'analysis'
}

/**
 * Options for creating an AI error
 */
export interface AIErrorOptions {
  message?: string;
  operation?: AIOperation;
  model?: AIModel;
  prompt?: string;
  maxTokens?: number;
  temperature?: number;
  statusCode?: number;
  responseData?: any;
  tokenUsage?: {
    prompt?: number;
    completion?: number;
    total?: number;
  };
  context?: Record<string, any>;
  cause?: Error | unknown;
}

/**
 * Error thrown when AI operations fail
 */
export class AIError extends ExternalServiceError {
  /**
   * Type of AI operation that failed
   */
  public readonly operation?: AIOperation;
  
  /**
   * AI model that was used
   */
  public readonly model?: AIModel;
  
  /**
   * Prompt that was sent (typically truncated)
   */
  public readonly prompt?: string;
  
  /**
   * Maximum tokens that were requested
   */
  public readonly maxTokens?: number;
  
  /**
   * Temperature that was used
   */
  public readonly temperature?: number;
  
  /**
   * Token usage information
   */
  public readonly tokenUsage?: {
    prompt?: number;
    completion?: number;
    total?: number;
  };
  
  /**
   * Create a new AI error
   * 
   * @param options Error options
   */
  constructor(options: AIErrorOptions) {
    const {
      message = 'AI operation failed',
      operation,
      model,
      prompt,
      maxTokens,
      temperature,
      statusCode,
      responseData,
      tokenUsage,
      context,
      cause
    } = options;
    
    // Get the service name from the model
    const service = model ? getServiceFromModel(model) : 'AI';
    
    // Call parent constructor with external service details
    super({
      message,
      code: ErrorCode.API_ERROR,
      service,
      endpoint: operation,
      statusCode,
      responseData,
      context: {
        ...context,
        operation,
        model,
        prompt: prompt ? truncatePrompt(prompt) : undefined,
        maxTokens,
        temperature,
        tokenUsage
      },
      cause
    });
    
    this.operation = operation;
    this.model = model;
    this.prompt = prompt ? truncatePrompt(prompt) : undefined;
    this.maxTokens = maxTokens;
    this.temperature = temperature;
    this.tokenUsage = tokenUsage;
  }
  
  /**
   * Create an error for context length exceeded
   * 
   * @param model AI model
   * @param tokenCount Number of tokens that exceeded the limit
   * @param maxTokens Maximum allowed tokens
   * @param customMessage Optional custom message
   * @returns AIError instance
   */
  public static contextLengthExceeded(
    model: AIModel,
    tokenCount: number,
    maxTokens: number,
    customMessage?: string
  ): AIError {
    return new AIError({
      message: customMessage || 
        `Context length exceeded: ${tokenCount} tokens exceeds the limit of ${maxTokens}`,
      model,
      maxTokens,
      context: { tokenCount }
    });
  }
  
  /**
   * Create an error for content filter triggered
   * 
   * @param model AI model
   * @param prompt Prompt that triggered the filter
   * @param customMessage Optional custom message
   * @returns AIError instance
   */
  public static contentFilterTriggered(
    model: AIModel,
    prompt?: string,
    customMessage?: string
  ): AIError {
    return new AIError({
      message: customMessage || 'Content filter triggered',
      model,
      prompt,
      statusCode: 400
    });
  }
  
  /**
   * Create an error for rate limiting
   * 
   * @param model AI model
   * @param retryAfter Seconds before retry is allowed
   * @param customMessage Optional custom message
   * @returns AIError instance
   */
  public static rateLimited(
    model: AIModel,
    retryAfter?: number,
    customMessage?: string
  ): AIError {
    return new AIError({
      message: customMessage || 'Rate limit exceeded for AI requests',
      model,
      statusCode: 429,
      context: retryAfter ? { retryAfter } : undefined
    });
  }
  
  /**
   * Create an error from OpenAI API response
   * 
   * @param operation AI operation being performed
   * @param model AI model being used
   * @param error Error from OpenAI
   * @param customMessage Optional custom message
   * @returns AIError instance
   */
  public static fromOpenAIError(
    operation: AIOperation,
    model: AIModel,
    error: any,
    customMessage?: string
  ): AIError {
    // Extract error details from OpenAI response
    const statusCode = error.status || error.statusCode || 500;
    const errorMessage = error.message || error.error?.message || 'Unknown OpenAI error';
    const errorType = error.type || error.error?.type;
    const errorCode = error.code || error.error?.code;
    
    // Format a clear error message
    const message = customMessage || `OpenAI API error: ${errorMessage}`;
    
    return new AIError({
      message,
      operation,
      model,
      statusCode,
      responseData: error,
      context: {
        errorType,
        errorCode
      },
      cause: error
    });
  }
}

/**
 * Truncate a prompt to a reasonable length for logging
 * 
 * @param prompt The prompt to truncate
 * @param maxLength Maximum length to keep
 * @returns Truncated prompt string
 */
function truncatePrompt(prompt: string, maxLength: number = 100): string {
  if (prompt.length <= maxLength) {
    return prompt;
  }
  return `${prompt.substring(0, maxLength)}... [truncated ${prompt.length - maxLength} chars]`;
}

/**
 * Get service name from AI model
 * 
 * @param model AI model
 * @returns Service name
 */
function getServiceFromModel(model: AIModel): string {
  if (model.startsWith('gpt-')) {
    return 'OpenAI';
  } else if (model.startsWith('claude-')) {
    return 'Anthropic';
  } else {
    return 'AI Service';
  }
} 