import { Keyboard } from 'grammy';
import { AGE_RANGES, GENDER_OPTIONS } from './constants';
import { generateUTCOffsetKeyboard as getTimezoneKeyboard } from '../../utils/timezone'; // Import the new keyboard generator

export const ageKeyboard = new Keyboard();
AGE_RANGES.forEach(age => ageKeyboard.text(age).row());
ageKeyboard.resized();

export const genderKeyboard = new Keyboard();
GENDER_OPTIONS.forEach(gender => genderKeyboard.text(gender).row());
genderKeyboard.resized();

// Use the new UTC offset keyboard generator
export const timezoneKeyboard = getTimezoneKeyboard();
