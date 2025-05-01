import axios, { AxiosError, AxiosRequestConfig, Method, AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry'; // Import axios-retry
import { Logger } from '../../utils/logger';
import { ApiHttpError, ApiNetworkError } from '../../errors/classes/api-errors'; // Import custom errors
// Import specific types
import { ILocationTimezone, IHumanDesignChartResponse } from './humanDesign.types';
// Import database functions and type
import {
  findExistingChart,
  createChart,
} from '../../database/models/human-design-chart.model';
import { IHumanDesignChart } from '../../types/models';

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
  cacheTTL?: number; // Cache time-to-live in milliseconds
}

/**
 * Service class for interacting with a Human Design API.
 * Handles configuration, basic request structure, and logging.
 */
export class HumanDesignService {
  private readonly config: IHumanDesignServiceConfig;
  private readonly logger: Logger;
  private readonly axiosInstance: AxiosInstance; // Use an axios instance
  private readonly locationCache: Map<string, { data: ILocationTimezone[]; timestamp: number }>;
  private readonly cacheTTL: number;

  constructor(config: IHumanDesignServiceConfig) {
    // Basic validation
    if (!config.apiKey) {
      throw new Error('Human Design API key is required.');
    }
    if (!config.baseUrl) {
      throw new Error('Human Design API base URL is required.');
    }

    // Initialize cacheTTL *before* using it in the config spread
    this.cacheTTL = config.cacheTTL ?? 60 * 60 * 1000; // Default 1 hour cache TTL

    this.config = {
      ...config,
      timeout: config.timeout ?? 10000,
      retryAttempts: config.retryAttempts ?? 3,
      cacheTTL: this.cacheTTL, // Now use the initialized value
    };
    this.locationCache = new Map();

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

    this.logger.info('HumanDesignService initialized with retry logic and caching.');
    this.logger.debug('Configuration:', {
      baseUrl: this.config.baseUrl,
      timeout: this.config.timeout,
      retryAttempts: this.config.retryAttempts,
      cacheTTL: this.cacheTTL,
    });
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
   * Uses the /locations endpoint with in-memory caching.
   *
   * @param {string} query The location query string.
   * @returns {Promise<ILocationTimezone[]>} A list of matching locations.
   */
  public async findLocationTimezone(query: string): Promise<ILocationTimezone[]> {
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new Error('Location query must be a non-empty string.');
    }

    const lowerCaseQuery = query.trim().toLowerCase();

    // Check cache
    const cachedEntry = this.locationCache.get(lowerCaseQuery);
    if (cachedEntry && Date.now() - cachedEntry.timestamp < this.cacheTTL) {
      this.logger.info(`Cache hit for location query: "${query}"`);
      return cachedEntry.data;
    }

    this.logger.info(`Cache miss. Finding timezone for query: "${query}"`);
    const params = { query: lowerCaseQuery, api_key: this.config.apiKey };
    const results = await this.get<ILocationTimezone[]>('/locations', params);

    // Update cache
    this.locationCache.set(lowerCaseQuery, { data: results, timestamp: Date.now() });
    this.logger.debug(`Cached ${results.length} results for query: "${query}"`);

    // Optional: Prune old cache entries periodically if memory becomes an issue
    // this.pruneLocationCache();

    return results;
  }

  /**
   * Clears the in-memory location cache.
   */
  public clearLocationCache(): void {
    this.locationCache.clear();
    this.logger.info('Location cache cleared.');
  }

  // Optional: Method to prune cache if needed
  // private pruneLocationCache(): void {
  //   const now = Date.now();
  //   for (const [key, entry] of this.locationCache.entries()) {
  //     if (now - entry.timestamp >= this.cacheTTL) {
  //       this.locationCache.delete(key);
  //     }
  //   }
  //   this.logger.debug('Pruned stale entries from location cache.');
  // }

  /**
   * Retrieves a Human Design chart, checking the database cache first.
   * If not cached, fetches from the API and saves to the database.
   *
   * @param {string} date The birth date in "YYYY-MM-DD" format.
   * @param {string} time The birth time in "HH:MM" format.
   * @param {string} location The birth location string.
   * @param {string} timezone The IANA timezone identifier.
   * @returns {Promise<IHumanDesignChartResponse>} The generated chart data.
   * @throws {Error} If validation fails.
   * @throws {ApiHttpError} If the API returns an error status.
   * @throws {ApiNetworkError} If a network error occurs.
   */
  public async getChart(
    date: string, // YYYY-MM-DD
    time: string, // HH:MM
    location: string,
    timezone: string,
  ): Promise<IHumanDesignChartResponse> {
    // Basic validation
    if (!date || !/\d{4}-\d{2}-\d{2}/.test(date)) {
      throw new Error('Invalid date format. Expected \"YYYY-MM-DD\".');
    }
    if (!time || !/^([01]?\d|2[0-3]):([0-5]\d)$/.test(time)) {
        throw new Error('Invalid time format. Expected \"HH:MM\".');
    }
    if (!location || typeof location !== 'string' || location.trim().length === 0) {
        throw new Error('Location must be a non-empty string.');
    }
    if (!timezone || typeof timezone !== 'string' || timezone.trim().length === 0) {
      throw new Error('Timezone must be a non-empty string.');
    }

    this.logger.info(`Getting Human Design chart for: ${date} ${time}, ${location}, ${timezone}`);

    // 1. Check database cache
    try {
      const existingChart = await findExistingChart(date, time, location);
      if (existingChart) {
        this.logger.info('Chart found in database cache.');
        // Ensure the returned data matches the API response structure
        // The model might store extra fields; we only return the API-like structure.
        // Assuming `existingChart.chartData` holds the original API response.
        if (!existingChart.chartData) {
            this.logger.warn('Cached chart found but chartData is missing. Refetching...');
        } else {
            // TODO: Validate if the cached chartData structure matches IHumanDesignChartResponse
            return existingChart.chartData as IHumanDesignChartResponse;
        }
      }
    } catch (dbError) {
      this.logger.error('Error checking database cache:', dbError);
      // Decide whether to proceed without cache or throw. Proceeding for now.
    }

    // 2. Fetch from API if not cached or cache read failed
    this.logger.info('Chart not found in cache or cache read failed. Fetching from API...');
    const apiDateTime = `${date} ${time}`; // Combine date and time for API
    const params = { date: apiDateTime, timezone, api_key: this.config.apiKey };

    try {
      const chartResponse = await this.get<IHumanDesignChartResponse>('/hd-data', params);
      this.logger.info('Successfully fetched chart from API.');

      // 3. Save to database cache (async, don't wait)
      createChart({
        birthDate: date,
        birthTime: time,
        birthLocation: location,
        timezone: timezone,
        chartData: chartResponse,
        // Store key properties for potential direct query/display later
        profile: chartResponse.Properties?.Profile?.Id,
        type: chartResponse.Properties?.Type?.Id,
        authority: chartResponse.Properties?.InnerAuthority?.Id,
        definition: chartResponse.Properties?.Definition?.Id,
        centers: {
            head: chartResponse.DefinedCenters?.includes('Head center'),
            ajna: chartResponse.DefinedCenters?.includes('Ajna center'),
            throat: chartResponse.DefinedCenters?.includes('Throat center'),
            g: chartResponse.DefinedCenters?.includes('G center'),
            heart: chartResponse.DefinedCenters?.includes('Heart center'),
            solar: chartResponse.DefinedCenters?.includes('Solar Plexus center'),
            sacral: chartResponse.DefinedCenters?.includes('Sacral center'),
            spleen: chartResponse.DefinedCenters?.includes('Splenic center'),
            root: chartResponse.DefinedCenters?.includes('Root center'),
        },
        channels: chartResponse.Channels,
        gates: chartResponse.Gates,
      }).then(savedChart => {
          this.logger.info(`Successfully saved chart to database cache. ID: ${savedChart._id}`);
      }).catch(saveError => {
          this.logger.error('Error saving chart to database cache:', saveError);
          // Don't fail the whole operation if caching fails
      });

      return chartResponse;

    } catch (apiError) {
      this.logger.error('Failed to fetch chart from API:', apiError);
      // Re-throw the specific API error (ApiHttpError or ApiNetworkError)
      throw apiError;
    }
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