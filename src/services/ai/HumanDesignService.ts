import axios, { AxiosError, AxiosRequestConfig, Method } from 'axios';
import { Logger } from '../../utils/logger';
import { ApiHttpError, ApiNetworkError } from '../../errors/classes/api-errors'; // Import custom errors

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
   * Makes an HTTP request to the Human Design API.
   *
   * @template T The expected response data type.
   * @param {Method} method The HTTP method (GET, POST, etc.).
   * @param {string} endpoint The API endpoint path.
   * @param {Record<string, any>} [params] Optional query parameters.
   * @param {any} [data] Optional request body data.
   * @returns {Promise<T>} The API response data.
   * @throws {ApiHttpError} If the API returns a non-2xx status code.
   * @throws {ApiNetworkError} If a network error or timeout occurs.
   */
  protected async request<T>(
    method: Method,
    endpoint: string,
    params?: Record<string, any>,
    data?: any,
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`; // Ensure leading slash consistency if needed
    const headers = {
      Authorization: `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    const requestConfig: AxiosRequestConfig = {
      method,
      url,
      headers,
      params,
      data,
      timeout: this.config.timeout,
    };

    this.logger.debug(`Making API request: ${method} ${url}`, { params, data: !!data }); // Log params, indicate if data exists

    try {
      const response = await axios.request<T>(requestConfig);
      this.logger.debug(`API request successful: ${response.status} ${response.statusText}`, { responseData: response.data });
      // Note: axios throws for non-2xx statuses by default, so we only reach here on success.
      return response.data;
    } catch (error) {
      this.logger.error('API request failed:', { error });

      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<any>;
        if (axiosError.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          this.logger.warn('API HTTP Error:', {
            status: axiosError.response.status,
            data: axiosError.response.data,
          });
          throw new ApiHttpError(
            axiosError.response.status,
            axiosError.message,
            axiosError.response.data,
          );
        } else if (axiosError.request) {
          // The request was made but no response was received
          // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
          // http.ClientRequest in node.js
          this.logger.warn('API Network Error (no response):', { message: axiosError.message });
          throw new ApiNetworkError(axiosError.message, axiosError.request);
        } else {
          // Something happened in setting up the request that triggered an Error
          this.logger.warn('API Request Setup Error:', { message: axiosError.message });
          throw new ApiNetworkError(`Request setup error: ${axiosError.message}`);
        }
      } else {
        // Non-Axios error
        this.logger.warn('Non-API Error during request:', { message: (error as Error).message });
        throw error; // Re-throw unexpected errors
      }
    }
    // TODO: Implement rate limiting and retry logic (subtask 2.3)
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

  // TODO: Implement concrete methods for API endpoints (subtask 2.4)
  // Example:
  // public async getChart(birthData: any): Promise<IHumanDesignChartResponse> {
  //   // ... call this.request() ...
  // }
} 