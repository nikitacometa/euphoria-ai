import { AGE_RANGES, GENDER_OPTIONS, TIMEZONE_OPTIONS } from './constants';

export function isValidAgeRange(ageRange: string): boolean {
    return AGE_RANGES.includes(ageRange);
}

export function isValidGender(gender: string): boolean {
    return GENDER_OPTIONS.includes(gender);
}

export function isValidTimezone(timezone: string): boolean {
    return TIMEZONE_OPTIONS.includes(timezone);
}

// Helper function to convert user-friendly timezone format to IANA timezone format
export function convertToIANATimezone(userTimezone: string): string {
    // Extract GMT offset from the user-friendly format
    const match = userTimezone.match(/GMT([+-])(\d{2}):(\d{2})/);
    if (!match) return 'UTC'; // Default to UTC if format doesn't match
    
    const [_, sign, hours, minutes] = match;
    
    // Map some common timezone offsets to IANA timezone strings
    // This is a simplified mapping and doesn't account for daylight saving time changes
    const timezoneMap: Record<string, string> = {
        '-10:00': 'Pacific/Honolulu',      // Hawaii
        '-08:00': 'America/Los_Angeles',   // Pacific Time
        '-07:00': 'America/Denver',        // Mountain Time
        '-06:00': 'America/Chicago',       // Central Time
        '-05:00': 'America/New_York',      // Eastern Time
        '-03:00': 'America/Sao_Paulo',     // São Paulo
        '+00:00': 'Europe/London',         // London
        '+01:00': 'Europe/Berlin',         // Berlin
        '+02:00': 'Europe/Athens',         // Athens
        '+03:00': 'Europe/Moscow',         // Moscow
        '+05:30': 'Asia/Kolkata',          // New Delhi
        '+07:00': 'Asia/Bangkok',          // Bangkok
        '+08:00': 'Asia/Singapore',        // Singapore
        '+09:00': 'Asia/Tokyo',            // Tokyo
        '+10:00': 'Australia/Sydney',      // Sydney
        '+12:00': 'Pacific/Auckland',      // Auckland
    };
    
    const offset = `${sign}${hours}:${minutes}`;
    return timezoneMap[offset] || 'UTC';
}
