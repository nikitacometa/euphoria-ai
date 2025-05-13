import { AGE_RANGES, GENDER_OPTIONS } from './constants';
import { isValidUtcOffset as validateUtcOffsetFormat } from '../../utils/timezone'; // Import the validator

export function isValidAgeRange(ageRange: string): boolean {
    return AGE_RANGES.includes(ageRange);
}

export function isValidGender(gender: string): boolean {
    return GENDER_OPTIONS.includes(gender);
}

/**
 * Validates if the user's input string for UTC offset is valid.
 * The input from keyboard is like "UTC+5", "UTC-10", "UTC0".
 * We need to strip "UTC" prefix before validating with the core validator.
 */
export function isValidUtcOffsetInput(userInput: string): boolean {
    if (!userInput) return false;
    const offsetOnly = userInput.replace(/^UTC/i, '').trim();
    if (offsetOnly === "") return false; // User just typed "UTC"
    return validateUtcOffsetFormat(offsetOnly);
}

// Removed convertToIANATimezone as it's no longer needed with UTC offset model
