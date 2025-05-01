import axios, { AxiosError } from 'axios';
import { HumanDesignService, IHumanDesignServiceConfig } from './HumanDesignService';
import { ApiHttpError, ApiNetworkError } from '../../errors/classes/api-errors';
import { ILocationTimezone, IHumanDesignChartResponse } from './humanDesign.types';
import { createLogger, LogLevel } from '../../utils/logger';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock the database functions to avoid actual DB calls
jest.mock('../../database/models/human-design-chart.model', () => ({
  findExistingChart: jest.fn(),
  createChart: jest.fn(),
}));
import { findExistingChart, createChart } from '../../database/models/human-design-chart.model';
const mockedFindExistingChart = findExistingChart as jest.Mock;
const mockedCreateChart = createChart as jest.Mock;

// Basic config for tests
const baseConfig: IHumanDesignServiceConfig = {
  apiKey: 'test-api-key',
  baseUrl: 'https://fake-api.humandesign.ai',
  logger: createLogger('TestHumanDesignService', LogLevel.ERROR),
};

describe('HumanDesignService', () => {
  let service: HumanDesignService;

  beforeEach(() => {
    // Reset mocks before each test
    mockedAxios.request.mockClear();
    mockedAxios.create.mockReturnThis(); // Ensure create returns a mock
    mockedFindExistingChart.mockClear();
    mockedCreateChart.mockClear();
    service = new HumanDesignService(baseConfig);
    // Clear in-memory cache if necessary (added clearLocationCache method for this)
    service.clearLocationCache(); 
  });

  // --- findLocationTimezone Tests ---
  it('should find location timezone successfully', async () => {
    const mockQuery = 'London';
    const mockResponse: ILocationTimezone[] = [{
        country: 'UK', timezone: 'Europe/London', asciiname: 'London', admin1: 'England', tokens: [], value: 'London, UK'
    }];
    mockedAxios.request.mockResolvedValueOnce({ data: mockResponse, status: 200, statusText: 'OK', headers: {}, config: {} });

    const result = await service.findLocationTimezone(mockQuery);

    expect(result).toEqual(mockResponse);
    expect(mockedAxios.request).toHaveBeenCalledTimes(1);
    expect(mockedAxios.request).toHaveBeenCalledWith(expect.objectContaining({
        method: 'GET',
        url: '/locations',
        params: { query: mockQuery.toLowerCase(), api_key: baseConfig.apiKey }
    }));
  });

  it('should use in-memory cache for findLocationTimezone', async () => {
    const mockQuery = 'Paris';
    const mockResponse: ILocationTimezone[] = [{ country: 'FR', timezone: 'Europe/Paris', asciiname: 'Paris', admin1: 'IDF', tokens: [], value: 'Paris, FR' }];
    mockedAxios.request.mockResolvedValueOnce({ data: mockResponse, status: 200, statusText: 'OK', headers: {}, config: {} });

    // First call - should hit API
    await service.findLocationTimezone(mockQuery);
    expect(mockedAxios.request).toHaveBeenCalledTimes(1);

    // Second call - should use cache
    const result = await service.findLocationTimezone(mockQuery);
    expect(result).toEqual(mockResponse);
    expect(mockedAxios.request).toHaveBeenCalledTimes(1); // Still 1 call
  });

  // --- getChart Tests ---
  it('should get chart successfully (cache miss)', async () => {
    const date = '2000-01-01';
    const time = '12:00';
    const location = 'Berlin, DE';
    const timezone = 'Europe/Berlin';
    const mockApiResponse = { Properties: { Type: { Id: 'Projector' } } } as unknown as IHumanDesignChartResponse;

    mockedFindExistingChart.mockResolvedValueOnce(null); // Cache miss
    mockedAxios.request.mockResolvedValueOnce({ data: mockApiResponse, status: 200, statusText: 'OK', headers: {}, config: {} });
    mockedCreateChart.mockResolvedValueOnce({ _id: 'mock-db-id' }); // Mock saving to cache

    const result = await service.getChart(date, time, location, timezone);

    expect(result).toEqual(mockApiResponse);
    expect(mockedFindExistingChart).toHaveBeenCalledWith(date, time, location);
    expect(mockedAxios.request).toHaveBeenCalledTimes(1);
    expect(mockedAxios.request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'GET',
      url: '/hd-data',
      params: { date: `${date} ${time}`, timezone, api_key: baseConfig.apiKey }
    }));
    // Use setTimeout to allow async cache saving call to potentially resolve
    await new Promise(res => setTimeout(res, 0)); 
    expect(mockedCreateChart).toHaveBeenCalledTimes(1);
  });

  it('should get chart from database cache (cache hit)', async () => {
    const date = '1995-05-10';
    const time = '10:15';
    const location = 'Sydney, AU';
    const timezone = 'Australia/Sydney';
    const mockCachedData = { Properties: { Type: { Id: 'Generator' } } } as unknown as IHumanDesignChartResponse;
    const mockDbEntry = { 
        birthDate: date, 
        birthTime: time, 
        birthLocation: location, 
        chartData: mockCachedData 
    };

    mockedFindExistingChart.mockResolvedValueOnce(mockDbEntry); // Cache hit

    const result = await service.getChart(date, time, location, timezone);

    expect(result).toEqual(mockCachedData);
    expect(mockedFindExistingChart).toHaveBeenCalledWith(date, time, location);
    expect(mockedAxios.request).not.toHaveBeenCalled();
    expect(mockedCreateChart).not.toHaveBeenCalled();
  });

  it('should throw ApiHttpError on API non-2xx response for getChart', async () => {
    const date = '2001-02-03';
    const time = '03:45';
    const location = 'Tokyo, JP';
    const timezone = 'Asia/Tokyo';
    const apiError = { 
        response: { status: 500, data: { message: 'Server Error' }, statusText: 'Internal Server Error', headers: {}, config: {} }, 
        isAxiosError: true, 
        message: 'Request failed with status code 500', 
        name: 'AxiosError'
    } as AxiosError;

    mockedFindExistingChart.mockResolvedValueOnce(null); // Cache miss
    mockedAxios.request.mockRejectedValueOnce(apiError);

    await expect(service.getChart(date, time, location, timezone)).rejects.toThrow(ApiHttpError);
    await expect(service.getChart(date, time, location, timezone)).rejects.toMatchObject({
        statusCode: 500,
        message: expect.stringContaining('API request failed with status 500'),
    });
    expect(mockedCreateChart).not.toHaveBeenCalled();
  });

  it('should throw ApiHttpError on API 429 response for getChart', async () => {
    const date = '2002-03-04';
    const time = '04:50';
    const location = 'Cairo, EG';
    const timezone = 'Africa/Cairo';
    const apiError = { 
        response: { status: 429, data: { message: 'Rate limit exceeded' }, statusText: 'Too Many Requests', headers: {}, config: {} }, 
        isAxiosError: true, 
        message: 'Request failed with status code 429', 
        name: 'AxiosError'
    } as AxiosError;

    mockedFindExistingChart.mockResolvedValueOnce(null); // Cache miss
    mockedAxios.request.mockRejectedValueOnce(apiError);

    await expect(service.getChart(date, time, location, timezone)).rejects.toThrow(ApiHttpError);
    await expect(service.getChart(date, time, location, timezone)).rejects.toMatchObject({
        statusCode: 429,
        message: expect.stringContaining('Rate limit exceeded'),
    });
    expect(mockedCreateChart).not.toHaveBeenCalled();
  });

  // Add more tests: network errors, validation errors, etc.

}); 