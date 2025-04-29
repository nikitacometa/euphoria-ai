import { 
    convertToUTC, 
    convertFromUTC, 
    formatTimeWithTimezone, 
    isValidTimezone,
    getAvailableTimezones 
} from './timezone';

// Mock the internal getUserTimezoneOffset function which is not exported
jest.mock('./timezone', () => {
    // Save the original module
    const originalModule = jest.requireActual('./timezone');
    
    // Create a mock implementation with the functions we need
    return {
        ...originalModule,
        // Override internal function for testing
        getUserTimezoneOffset: jest.fn(),
    };
});

describe('Timezone utility functions', () => {
    // Test conversion from local time to UTC
    describe('convertToUTC', () => {
        test('should convert time from a timezone to UTC', () => {
            // Mock implementation to make tests predictable
            jest.spyOn(Date.prototype, 'getTime').mockImplementation(function(this: Date) {
                // Create a predictable offset based on the hours
                return this.getUTCHours() * 3600000 + this.getUTCMinutes() * 60000;
            });
            
            // Mock to simulate timezone conversion
            const getUserTimezoneOffset = require('./timezone').getUserTimezoneOffset;
            getUserTimezoneOffset.mockReturnValue(-300); // -5 hours in minutes
            
            const result = convertToUTC('12:30', 'America/New_York');
            expect(result).toBe('17:30'); // 12:30 EST -> 17:30 UTC (assuming -5 hours)
            
            jest.restoreAllMocks();
        });
        
        test('should handle midnight edge case', () => {
            const getUserTimezoneOffset = require('./timezone').getUserTimezoneOffset;
            getUserTimezoneOffset.mockReturnValue(60); // +1 hour
            
            const result = convertToUTC('00:30', 'Europe/Paris');
            expect(result).toBe('23:30'); // 00:30 Paris -> 23:30 UTC (previous day)
            
            jest.restoreAllMocks();
        });
    });
    
    // Test conversion from UTC to local time
    describe('convertFromUTC', () => {
        test('should convert time from UTC to a timezone', () => {
            // Mock Intl.DateTimeFormat to return predictable results
            const mockFormat = jest.fn();
            mockFormat.mockReturnValue('17:30');
            
            jest.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => ({
                format: mockFormat,
                formatToParts: jest.fn(),
                resolvedOptions: jest.fn()
            } as any));
            
            const result = convertFromUTC('12:30', 'America/New_York');
            expect(result).toBe('17:30'); // This is just based on our mock
            
            jest.restoreAllMocks();
        });
    });
    
    // Test timezone validation
    describe('isValidTimezone', () => {
        test('should validate correct timezone', () => {
            expect(isValidTimezone('America/New_York')).toBe(true);
            expect(isValidTimezone('Europe/London')).toBe(true);
            expect(isValidTimezone('UTC')).toBe(true);
        });
        
        test('should invalidate incorrect timezone', () => {
            // Mock implementation to throw for invalid timezones
            jest.spyOn(Intl, 'DateTimeFormat').mockImplementation((locale, options) => {
                if (options?.timeZone === 'Invalid/Timezone') {
                    throw new RangeError('Invalid timezone');
                }
                return {
                    format: jest.fn(),
                    formatToParts: jest.fn(),
                    resolvedOptions: jest.fn()
                } as any;
            });
            
            expect(isValidTimezone('Invalid/Timezone')).toBe(false);
            
            jest.restoreAllMocks();
        });
    });
    
    // Test timezone formatting
    describe('formatTimeWithTimezone', () => {
        test('should format time with timezone abbreviation', () => {
            // Mock Intl.DateTimeFormat to return a predictable timezone abbreviation
            const mockFormat = jest.fn();
            mockFormat.mockReturnValue('10/26/2023, 2:30 PM EDT');
            
            jest.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => ({
                format: mockFormat,
                formatToParts: jest.fn(),
                resolvedOptions: jest.fn()
            } as any));
            
            const result = formatTimeWithTimezone('14:30', 'America/New_York');
            expect(result).toBe('14:30 (EDT)');
            
            jest.restoreAllMocks();
        });
        
        test('should handle errors gracefully', () => {
            // Mock to throw an error
            jest.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
                throw new Error('Test error');
            });
            
            const result = formatTimeWithTimezone('14:30', 'Invalid/Timezone');
            expect(result).toBe('14:30'); // Just returns the time without timezone
            
            jest.restoreAllMocks();
        });
    });
    
    // Test getting available timezones
    describe('getAvailableTimezones', () => {
        test('should return a list of timezones', () => {
            // Mock Intl.supportedValuesOf to return a predictable list
            const mockSupportedValuesOf = jest.fn();
            mockSupportedValuesOf.mockReturnValue(['UTC', 'America/New_York', 'Europe/London']);
            
            // @ts-ignore - Property 'supportedValuesOf' does not exist on type 'typeof Intl'
            Intl.supportedValuesOf = mockSupportedValuesOf;
            
            const result = getAvailableTimezones();
            expect(result).toContain('UTC');
            expect(result).toContain('America/New_York');
            expect(result).toContain('Europe/London');
            
            // @ts-ignore - Property 'supportedValuesOf' does not exist on type 'typeof Intl'
            delete Intl.supportedValuesOf;
        });
        
        test('should fall back to common timezones if API is unavailable', () => {
            // Ensure the API is unavailable
            // @ts-ignore - Property 'supportedValuesOf' does not exist on type 'typeof Intl'
            delete Intl.supportedValuesOf;
            
            const result = getAvailableTimezones();
            expect(result.length).toBeGreaterThan(0);
            expect(result).toContain('UTC');
            
            // Even without the API, we should have common timezones
            expect(result.some(tz => tz.includes('America/'))).toBe(true);
            expect(result.some(tz => tz.includes('Europe/'))).toBe(true);
        });
    });
}); 