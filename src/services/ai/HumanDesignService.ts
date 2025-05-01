import axios, { AxiosError, AxiosRequestConfig, Method, AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry'; // Import axios-retry
import { Logger } from '../../utils/logger';
import { ApiHttpError, ApiNetworkError } from '../../errors/classes/api-errors'; // Import custom errors
// Import specific types
import { ILocationTimezone, IHumanDesignChartResponse } from './humanDesign.types';

/**
 * Configuration for the Human Design API Service.
 */
export interface IHumanDesignServiceConfig {
  apiKey: string;
  baseUrl: string;
  timeout?: number; // Timeout in milliseconds
  logger?: Logger; // Optional logger instance
  retryAttempts?: number; // Number of retry attempts
  retryDelay?: (retryCount: number) => number; // Function for custom retry delay
}

/**
 * Service class for interacting with a Human Design API.
 * Handles configuration, basic request structure, and logging.
 */
export class HumanDesignService {
  private readonly config: IHumanDesignServiceConfig;
  private readonly logger: Logger;
  private readonly axiosInstance: AxiosInstance; // Use an axios instance

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
      retryAttempts: config.retryAttempts ?? 3, // Default 3 retries
    };

    this.logger = config.logger ?? new Logger('HumanDesignService');

    // Create an axios instance
    this.axiosInstance = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    // Configure axios-retry
    axiosRetry(this.axiosInstance, {
      retries: this.config.retryAttempts,
      retryDelay: (retryCount, error) => {
        this.logger.warn(`Retrying request (attempt ${retryCount})...`, { url: error?.config?.url, method: error?.config?.method, status: error?.response?.status });
        // Use provided delay function or exponential backoff
        if (this.config.retryDelay) {
          return this.config.retryDelay(retryCount);
        }
        return axiosRetry.exponentialDelay(retryCount);
      },
      retryCondition: (error: AxiosError) => {
        // Retry on network errors or specific server errors (e.g., 5xx)
        // Do not retry on 429 (Rate Limit) by default, handle it specifically if needed
        return (
          axiosRetry.isNetworkOrIdempotentRequestError(error) ||
          (error.response?.status !== undefined && error.response.status >= 500 && error.response.status <= 599)
        );
      },
      onRetry: (retryCount, error, requestConfig) => {
          this.logger.info(`Request retry attempt ${retryCount}`, { url: requestConfig.url, method: requestConfig.method, error: error.message });
      }
    });

    this.logger.info('HumanDesignService initialized with retry logic.');
    this.logger.debug('Configuration:', { baseUrl: this.config.baseUrl, timeout: this.config.timeout, retryAttempts: this.config.retryAttempts });
  }

  /**
   * Makes an HTTP request to the Human Design API using the configured axios instance.
   *
   * @template T The expected response data type.
   * @param {Method} method The HTTP method (GET, POST, etc.).
   * @param {string} endpoint The API endpoint path (relative to baseUrl).
   * @param {Record<string, any>} [params] Optional query parameters.
   * @param {any} [data] Optional request body data.
   * @returns {Promise<T>} The API response data.
   * @throws {ApiHttpError} If the API returns a non-2xx status code after retries.
   * @throws {ApiNetworkError} If a network error or timeout occurs after retries.
   */
  protected async request<T>(
    method: Method,
    endpoint: string,
    params?: Record<string, any>,
    data?: any,
  ): Promise<T> {
    const requestConfig: AxiosRequestConfig = {
      method,
      url: endpoint, // Use relative endpoint path
      params,
      data,
    };

    this.logger.debug(`Making API request: ${method} ${this.config.baseUrl}${endpoint}`, { params, data: !!data });

    try {
      // Use the configured axios instance which includes retry logic
      const response = await this.axiosInstance.request<T>(requestConfig);
      this.logger.debug(`API request successful: ${response.status} ${response.statusText}`); // Removed data logging for brevity/security
      return response.data;
    } catch (error) {
      this.logger.error('API request failed after retries:', { url: `${this.config.baseUrl}${endpoint}`, method, error });

      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<any>;
        if (axiosError.response) {
          this.logger.warn('API HTTP Error:', {
            status: axiosError.response.status,
            data: axiosError.response.data,
          });
          // Specific handling for Rate Limit (429)
          if (axiosError.response.status === 429) {
              this.logger.error('API Rate Limit Exceeded.', { details: axiosError.response.data });
              // Consider throwing a specific ApiRateLimitError here
              throw new ApiHttpError(429, 'Rate limit exceeded', axiosError.response.data);
          }
          throw new ApiHttpError(
            axiosError.response.status,
            axiosError.message,
            axiosError.response.data,
          );
        } else if (axiosError.request) {
          this.logger.warn('API Network Error (no response):', { message: axiosError.message });
          throw new ApiNetworkError(axiosError.message, axiosError.request);
        } else {
          this.logger.warn('API Request Setup Error:', { message: axiosError.message });
          throw new ApiNetworkError(`Request setup error: ${axiosError.message}`);
        }
      } else {
        this.logger.warn('Non-API Error during request:', { message: (error as Error).message });
        throw error;
      }
    }
  }

  // Helper methods for common HTTP verbs
  protected async get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    return this.request<T>('GET', endpoint, params);
  }

  protected async post<T>(endpoint: string, data: any, params?: Record<string, any>): Promise<T> {
    return this.request<T>('POST', endpoint, params, data);
  }

  protected async put<T>(endpoint: string, data: any, params?: Record<string, any>): Promise<T> {
    return this.request<T>('PUT', endpoint, params, data);
  }

  protected async delete<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    return this.request<T>('DELETE', endpoint, params);
  }

  /**
   * Finds potential locations and timezones based on a query.
   * Uses the /locations endpoint.
   *
   * @param {string} query The location query string (e.g., "London", "New York, USA").
   * @returns {Promise<ILocationTimezone[]>} A list of matching locations.
   * @throws {ApiHttpError} If the API returns an error status.
   * @throws {ApiNetworkError} If a network error occurs.
   */
  public async findLocationTimezone(query: string): Promise<ILocationTimezone[]> {
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new Error('Location query must be a non-empty string.');
    }
    this.logger.info(`Finding timezone for query: "${query}"`);
    // Pass api_key in query params as per humandesign_api.md
    const params = { query, api_key: this.config.apiKey }; 
    return this.get<ILocationTimezone[]>('/locations', params);
  }

  /**
   * Retrieves a Human Design chart from the API.
   * Uses the /hd-data endpoint.
   *
   * @param {string} date The birth date and time in ISO 8601 format (e.g., "1999-07-22 17:00").
   * @param {string} timezone The timezone identifier (e.g., "Europe/London").
   * @returns {Promise<IHumanDesignChartResponse>} The generated chart data.
   * @throws {ApiHttpError} If the API returns an error status.
   * @throws {ApiNetworkError} If a network error occurs.
   */
  public async getChart(date: string, timezone: string): Promise<IHumanDesignChartResponse> {
    // Basic validation
    if (!date || typeof date !== 'string' || !/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(date)) {
        throw new Error('Invalid date format. Expected \"YYYY-MM-DD HH:MM\".');
    }
    if (!timezone || typeof timezone !== 'string' || timezone.trim().length === 0) {
      throw new Error('Timezone must be a non-empty string.');
    }

    this.logger.info(`Getting Human Design chart for date: ${date}, timezone: ${timezone}`);
    // Pass api_key in query params as per humandesign_api.md
    const params = { date, timezone, api_key: this.config.apiKey };
    return this.get<IHumanDesignChartResponse>('/hd-data', params);
  }

  /**
   * Checks the health or status of the API (basic implementation).
   * This might involve making a simple, authenticated request like fetching timezone for a known location.
   *
   * @returns {Promise<{ status: 'ok' | 'error', message?: string }>} The health status.
   */
  public async checkApiHealth(): Promise<{ status: 'ok' | 'error'; message?: string }> {
    this.logger.info('Checking API health...');
    try {
      // Make a simple request to a known endpoint, e.g., timezone lookup for a common city
      await this.findLocationTimezone('London');
      this.logger.info('API health check successful.');
      return { status: 'ok' };
    } catch (error) {
      this.logger.error('API health check failed:', { error });
      const message = error instanceof Error ? error.message : 'Unknown health check error';
      return { status: 'error', message };
    }
  }

  // TODO: Implement concrete methods for API endpoints (subtask 2.4)
  // Example:
  // public async getChart(birthData: any): Promise<IHumanDesignChartResponse> {
  //   // ... call this.request() ...
  // }
} 