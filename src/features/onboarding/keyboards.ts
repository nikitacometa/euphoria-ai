import { Keyboard } from 'grammy';
import { AGE_RANGES, GENDER_OPTIONS, TIMEZONE_OPTIONS } from './constants';

export const ageKeyboard = new Keyboard();
AGE_RANGES.forEach(age => ageKeyboard.text(age).row());
ageKeyboard.resized();

export const genderKeyboard = new Keyboard();
GENDER_OPTIONS.forEach(gender => genderKeyboard.text(gender).row());
genderKeyboard.resized();

export const timezoneKeyboard = new Keyboard();
TIMEZONE_OPTIONS.forEach(timezone => timezoneKeyboard.text(timezone).row());
timezoneKeyboard.resized();
