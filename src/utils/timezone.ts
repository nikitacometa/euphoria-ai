/**
 * Timezone utility functions for handling time conversions
 */
import { JournalBotContext } from '../types/session';
import { Keyboard } from 'grammy';

/**
 * Parses a UTC offset string (e.g., "+5:30", "-10", "0") into hours and minutes.
 * @param utcOffsetString The UTC offset string.
 * @returns Object with hours and minutes (minutes can be negative for negative offsets).
 */
function parseUtcOffset(utcOffsetString: string): { hours: number; minutes: number } {
    if (utcOffsetString === "0" || utcOffsetString === "+0" || utcOffsetString === "-0") {
        return { hours: 0, minutes: 0 };
    }
    const match = utcOffsetString.match(/^([+-])(\d{1,2})(?::(\d{2}))?$/);
    if (!match) {
        console.warn(`Invalid UTC offset string format: ${utcOffsetString}. Defaulting to +0.`);
        return { hours: 0, minutes: 0 }; // Default to UTC if format is invalid
    }

    const sign = match[1] === '-' ? -1 : 1;
    const hours = parseInt(match[2], 10);
    const minutes = match[3] ? parseInt(match[3], 10) : 0;

    return { hours: sign * hours, minutes: sign * minutes };
}

/**
 * Converts a local time string to UTC time string using a UTC offset.
 * @param localTimeString Time string in "HH:mm" format (user's local time).
 * @param utcOffset User's UTC offset string (e.g., "+2", "-5:30").
 * @returns Time string in UTC in "HH:mm" format.
 */
export function convertToUTC(localTimeString: string, utcOffset: string): string {
    const [localHours, localMinutes] = localTimeString.split(':').map(Number);
    const offset = parseUtcOffset(utcOffset);

    let utcHours = localHours - offset.hours;
    let utcMinutes = localMinutes - offset.minutes;

    // Adjust minutes and hours if minutes are out of bounds
    if (utcMinutes < 0) {
        utcMinutes += 60;
        utcHours -= 1;
    }
    if (utcMinutes >= 60) {
        utcMinutes -= 60;
        utcHours += 1;
    }

    // Adjust hours if they are out of bounds
    if (utcHours < 0) {
        utcHours += 24;
    }
    if (utcHours >= 24) {
        utcHours -= 24;
    }

    return `${String(utcHours).padStart(2, '0')}:${String(utcMinutes).padStart(2, '0')}`;
}

/**
 * Converts a UTC time string to a local time string using a UTC offset.
 * @param utcTimeString Time string in UTC in "HH:mm" format.
 * @param utcOffset User's UTC offset string (e.g., "+2", "-5:30").
 * @returns Time string in the user's local time in "HH:mm" format.
 */
export function convertFromUTC(utcTimeString: string, utcOffset: string): string {
    const [utcHours, utcMinutes] = utcTimeString.split(':').map(Number);
    const offset = parseUtcOffset(utcOffset);

    let localHours = utcHours + offset.hours;
    let localMinutes = utcMinutes + offset.minutes;

    // Adjust minutes and hours if minutes are out of bounds
    if (localMinutes < 0) {
        localMinutes += 60;
        localHours -= 1;
    }
    if (localMinutes >= 60) {
        localMinutes -= 60;
        localHours += 1;
    }

    // Adjust hours if they are out of bounds
    if (localHours < 0) {
        localHours += 24;
    }
    if (localHours >= 24) {
        localHours -= 24;
    }

    return `${String(localHours).padStart(2, '0')}:${String(localMinutes).padStart(2, '0')}`;
}

/**
 * Validates if a string is a valid UTC offset format (e.g., "+2", "-5:30", "0").
 * @param utcOffset The UTC offset string to validate.
 * @returns True if valid, false otherwise.
 */
export function isValidUtcOffset(utcOffset: string): boolean {
    if (utcOffset === "0") return true;
    // Regex from user.model.ts, slightly adjusted for full match an no empty validation needed here
    return /^([+-])((?:[0-9]|1[0-3])(?::[0-5][0-9])?|14(?::00)?)$/.test(utcOffset);
}

/**
 * Formats a time string with UTC offset information for display.
 * @param localTimeString Time string in "HH:mm" format (user's local time).
 * @param utcOffset User's UTC offset string (e.g., "+2", "-5:30").
 * @returns Formatted string like "21:00 (UTC+2)" or "09:30 (UTC-5:30)".
 */
export function formatTimeWithTimezone(localTimeString: string, utcOffset: string): string {
    if (utcOffset === "0" || utcOffset === "+0" || utcOffset === "-0") {
        return `${localTimeString} (UTC)`;
    }
    // Ensure the sign is always present for non-zero offsets
    const displayOffset = (utcOffset.startsWith('+') || utcOffset.startsWith('-')) ? utcOffset : `+${utcOffset}`;
    return `${localTimeString} (UTC${displayOffset})`;
}

/**
 * Generates a keyboard with common UTC offset options for selection.
 * @returns A Grammy Keyboard object.
 */
export function generateUTCOffsetKeyboard(): Keyboard {
    const keyboard = new Keyboard().resized();
    const offsets: string[] = [];
    for (let i = -12; i <= 14; i++) {
        if (i === 0) {
            offsets.push("0");
        } else {
            offsets.push((i > 0 ? "+" : "") + i.toString());
        }
    }

    // Add half-hour offsets for common regions if desired, e.g. +5:30
    // For simplicity, sticking to whole hours for now based on the plan for onboarding
    // offsets.push("+5:30"); 
    // offsets.sort((a,b) => parseFloat(a.replace(":30", ".5")) - parseFloat(b.replace(":30",".5")));

    let row: string[] = [];
    for (let i = 0; i < offsets.length; i++) {
        row.push(offsets[i]);
        if (row.length === 3 || i === offsets.length - 1) {
            keyboard.row(...row.map(offset => ({ text: `UTC${offset}` })));
            row = [];
        }
    }
    keyboard.row({ text: "❌ Cancel" }); // Add a cancel button
    return keyboard;
}

/**
 * Calculates the next notification Date object based on a UTC time string.
 * @param utcTimeString The desired notification time in "HH:mm" format (UTC).
 * @returns The Date object for the next occurrence of this UTC time.
 */
export function calculateNextNotificationDateTime(utcTimeString: string): Date {
    const [hours, minutes] = utcTimeString.split(':').map(Number);
    const nextNotification = new Date();
    nextNotification.setUTCHours(hours, minutes, 0, 0);

    if (nextNotification.getTime() <= Date.now()) {
        nextNotification.setUTCDate(nextNotification.getUTCDate() + 1);
    }
    return nextNotification;
}

// --- Functions to be removed or refactored as they are IANA specific ---
/*
export function getAvailableTimezones(): string[] {
    try {
        if (typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl) {
            return (Intl as any).supportedValuesOf('timeZone');
        }
    } catch (error) { }
    return []; // Simplified, was COMMON_TIMEZONES
}

export function detectUserTimezone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (error) {
        return 'UTC';
    }
}

export async function guessUserTimezone(ctx: JournalBotContext): Promise<string | null> {
    // This logic is IANA specific and complex to map to simple UTC offset
    // Should be re-evaluated if frontend timezone detection is available or a simpler heuristic for offset is found
    return null; // Defaulting to null as guessing IANA is not useful for UTC offset model directly
}
*/ 