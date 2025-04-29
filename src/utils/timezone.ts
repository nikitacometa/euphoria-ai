/**
 * Timezone utility functions for handling time conversions
 */
import { JournalBotContext } from '../types/session';

/**
 * Converts a time string from a specific timezone to UTC
 * @param timeString Time string in format "HH:mm"
 * @param timezone User's timezone (IANA format, e.g., "America/New_York")
 * @returns Time string in UTC in format "HH:mm"
 */
export function convertToUTC(timeString: string, timezone: string): string {
    // Create a date with the current day but with the specific time in the user's timezone
    const [hours, minutes] = timeString.split(':').map(Number);
    
    // Create a date in the specified timezone
    const date = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
    });
    
    // Get the date parts in the user's timezone
    const dateParts = formatter.formatToParts(date);
    const year = Number(dateParts.find(part => part.type === 'year')?.value || date.getFullYear());
    const month = Number(dateParts.find(part => part.type === 'month')?.value || (date.getMonth() + 1)) - 1;
    const day = Number(dateParts.find(part => part.type === 'day')?.value || date.getDate());
    
    // Create a date object with the correct timezone but at the specified time
    const userTimezoneDate = new Date(Date.UTC(year, month, day, hours, minutes));
    
    // Adjust for timezone offset
    const userTimezoneOffset = getUserTimezoneOffset(timezone);
    const utcTime = new Date(userTimezoneDate.getTime() - userTimezoneOffset * 60000);
    
    // Format the UTC time
    return `${utcTime.getUTCHours().toString().padStart(2, '0')}:${utcTime.getUTCMinutes().toString().padStart(2, '0')}`;
}

/**
 * Converts a UTC time string to a time in a specific timezone
 * @param utcTimeString Time string in UTC in format "HH:mm"
 * @param timezone Target timezone (IANA format, e.g., "America/New_York")
 * @returns Time string in the target timezone in format "HH:mm"
 */
export function convertFromUTC(utcTimeString: string, timezone: string): string {
    // Parse the UTC time string
    const [hours, minutes] = utcTimeString.split(':').map(Number);
    
    // Create a date with the current day but with the specific time in UTC
    const utcDate = new Date();
    utcDate.setUTCHours(hours, minutes, 0, 0);
    
    // Format the time in the target timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    
    // Get the formatted time in the target timezone
    const formattedTime = formatter.format(utcDate);
    
    // Some locales might output in a different format
    // Extract hours and minutes and ensure they're in HH:mm format
    const timeRegex = /(\d{1,2})[^\d]*(\d{2})/;
    const match = timeRegex.exec(formattedTime);
    
    if (match) {
        const hours = match[1].padStart(2, '0');
        const minutes = match[2];
        return `${hours}:${minutes}`;
    }
    
    // Fallback: try to extract from the formatter's output
    return formattedTime.replace(/[^\d:]/g, '');
}

/**
 * Gets the current offset in minutes for a timezone
 * @param timezone IANA timezone string (e.g., "America/New_York")
 * @returns Offset in minutes
 */
function getUserTimezoneOffset(timezone: string): number {
    const date = new Date();
    
    // Get the time in the specified timezone
    const timeString = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
    }).format(date);
    
    // Get the time in the local timezone
    const localTimeString = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
    }).format(date);
    
    // Parse both times
    const parseTime = (timeStr: string) => {
        const match = /(\d{1,2})[^\d]*(\d{2})/.exec(timeStr);
        if (match) {
            return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
        }
        return 0;
    };
    
    const timezoneMinutes = parseTime(timeString);
    const localMinutes = parseTime(localTimeString);
    
    // Calculate offset including day difference
    let offset = timezoneMinutes - localMinutes;
    
    // Adjust for day boundaries
    if (offset > 720) offset -= 1440;
    if (offset < -720) offset += 1440;
    
    return offset;
}

/**
 * Common timezones to use as a fallback if Intl.supportedValuesOf is not available
 */
const COMMON_TIMEZONES = [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Europe/Moscow',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Asia/Kolkata',
    'Australia/Sydney',
    'Pacific/Auckland'
];

/**
 * Common timezone to region mappings for heuristic timezone guessing
 */
const TIMEZONE_REGIONS: Record<string, string> = {
    '1': 'Europe/London',     // UK, Portugal
    '2': 'Europe/Paris',      // Most of Europe
    '3': 'Europe/Moscow',     // Eastern Europe, parts of Russia
    '4': 'Asia/Dubai',        // Middle East
    '5': 'Asia/Karachi',      // Pakistan, parts of Central Asia
    '5.5': 'Asia/Kolkata',    // India
    '6': 'Asia/Dhaka',        // Bangladesh
    '7': 'Asia/Bangkok',      // Thailand, Vietnam
    '8': 'Asia/Shanghai',     // China, Singapore, parts of Asia
    '9': 'Asia/Tokyo',        // Japan, Korea
    '10': 'Australia/Sydney', // Eastern Australia
    '11': 'Pacific/Noumea',   // Pacific islands
    '12': 'Pacific/Auckland', // New Zealand
    '-11': 'Pacific/Midway',  // Samoa
    '-10': 'Pacific/Honolulu',// Hawaii
    '-9': 'America/Anchorage',// Alaska
    '-8': 'America/Los_Angeles', // Pacific Time
    '-7': 'America/Denver',   // Mountain Time
    '-6': 'America/Chicago',  // Central Time
    '-5': 'America/New_York', // Eastern Time
    '-4': 'America/Halifax',  // Atlantic Time
    '-3': 'America/Sao_Paulo',// Brazil, Argentina
    '-2': 'Atlantic/South_Georgia', // Mid-Atlantic
    '-1': 'Atlantic/Azores'   // Azores
};

/**
 * Get a list of all IANA timezones
 * @returns Array of timezone strings
 */
export function getAvailableTimezones(): string[] {
    try {
        // Use the modern API if available
        if (typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl) {
            return (Intl as any).supportedValuesOf('timeZone');
        }
    } catch (error) {
        // Fall back to common timezones if the API fails
    }
    
    // Return common timezones as a fallback
    return COMMON_TIMEZONES;
}

/**
 * Detects the user's timezone based on browser information
 * @returns The detected IANA timezone string
 */
export function detectUserTimezone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (error) {
        // Default to UTC if detection fails
        return 'UTC';
    }
}

/**
 * Validates if a string is a valid IANA timezone
 * @param timezone The timezone string to validate
 * @returns True if valid, false otherwise
 */
export function isValidTimezone(timezone: string): boolean {
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: timezone });
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Formats a time string with timezone information for display
 * @param timeString Time string in format "HH:mm"
 * @param timezone User's timezone
 * @returns Formatted string like "21:00 (UTC+1)"
 */
export function formatTimeWithTimezone(timeString: string, timezone: string): string {
    try {
        // Get current date in the timezone
        const date = new Date();
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            timeZoneName: 'short'
        });
        
        // Extract the timezone abbreviation from the formatted string
        const formattedDate = formatter.format(date);
        const timezoneAbbr = formattedDate.split(' ').pop();
        
        return `${timeString} (${timezoneAbbr})`;
    } catch (error) {
        // If there's an error, just return the time string
        return timeString;
    }
}

/**
 * Attempts to guess a user's timezone from a Telegram context
 * Since Telegram doesn't provide timezone info, this uses various heuristics
 * 
 * @param ctx The Telegram bot context
 * @returns Best guess at user's timezone or null if can't determine
 */
export async function guessUserTimezone(ctx: JournalBotContext): Promise<string | null> {
    try {
        // 1. Try to get language from user settings
        const userLanguage = ctx.from?.language_code || '';
        
        // Maps of common languages to likely timezones
        const languageTimezones: Record<string, string> = {
            'en-US': 'America/New_York',
            'en-GB': 'Europe/London',
            'ru': 'Europe/Moscow',
            'es': 'Europe/Madrid',
            'de': 'Europe/Berlin',
            'fr': 'Europe/Paris',
            'it': 'Europe/Rome',
            'ja': 'Asia/Tokyo',
            'zh': 'Asia/Shanghai',
            'ko': 'Asia/Seoul',
            'pt': 'Europe/Lisbon',
            'pt-BR': 'America/Sao_Paulo',
            'ar': 'Asia/Riyadh',
            'hi': 'Asia/Kolkata',
            'tr': 'Europe/Istanbul',
            'id': 'Asia/Jakarta',
            'th': 'Asia/Bangkok',
            'vi': 'Asia/Ho_Chi_Minh'
        };
        
        // Try exact language match first
        if (userLanguage && languageTimezones[userLanguage]) {
            return languageTimezones[userLanguage];
        }
        
        // Try language prefix (e.g., "en" from "en-US")
        const langPrefix = userLanguage.split('-')[0];
        if (langPrefix) {
            for (const [key, value] of Object.entries(languageTimezones)) {
                if (key.startsWith(langPrefix + '-')) {
                    return value;
                }
            }
        }
        
        // 2. Fallback to UTC (safest option)
        return 'UTC';
    } catch (error) {
        console.error('Error guessing timezone:', error);
        return 'UTC'; // Default to UTC on error
    }
} 