import { Logger } from '../../utils/logger';

/**
 * Configuration for the Human Design API Service.
 */
export interface IHumanDesignServiceConfig {
  apiKey: string;
  baseUrl: string;
  timeout?: number; // Timeout in milliseconds
  logger?: Logger; // Optional logger instance
}

/**
 * Service class for interacting with a Human Design API.
 * Handles configuration, basic request structure, and logging.
 */
export class HumanDesignService {
  private readonly config: IHumanDesignServiceConfig;
  private readonly logger: Logger;

  constructor(config: IHumanDesignServiceConfig) {
    // Basic validation
    if (!config.apiKey) {
      throw new Error('Human Design API key is required.');
    }
    if (!config.baseUrl) {
      throw new Error('Human Design API base URL is required.');
    }

    this.config = {
      ...config,
      timeout: config.timeout ?? 10000, // Default timeout 10s
    };

    // Use provided logger or default logger
    this.logger = config.logger ?? new Logger('HumanDesignService');
    this.logger.info('HumanDesignService initialized.');
    // Log config without sensitive details like API key
    this.logger.debug('Configuration:', { baseUrl: this.config.baseUrl, timeout: this.config.timeout });
  }

  /**
   * Placeholder for making API requests.
   * Actual implementation will be in subtask 2.2.
   */
  protected async request<T>(/* parameters will go here */): Promise<T> {
    this.logger.debug('Making API request...');
    // TODO: Implement actual HTTP request logic (subtask 2.2)
    // TODO: Implement rate limiting and retry logic (subtask 2.3)
    return Promise.reject(new Error('Request method not implemented.'));
  }

  // TODO: Implement concrete methods for API endpoints (subtask 2.4)
  // Example:
  // public async getChart(birthData: any): Promise<IHumanDesignChartResponse> {
  //   // ... call this.request() ...
  // }
} 