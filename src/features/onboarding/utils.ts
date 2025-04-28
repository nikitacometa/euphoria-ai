import { AGE_RANGES, GENDER_OPTIONS } from './constants';

export function isValidAgeRange(age: string): boolean {
    return AGE_RANGES.includes(age);
}

export function isValidGender(gender: string): boolean {
    return GENDER_OPTIONS.includes(gender);
}
