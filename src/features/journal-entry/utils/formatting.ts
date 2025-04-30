/**
 * Sanitizes HTML content for Telegram messages.
 * Telegram only supports a limited set of HTML tags:
 * <b>, <i>, <u>, <s>, <tg-spoiler>, <a>, <code>, <pre>
 */
export function sanitizeHtmlForTelegram(text: string): string {
    return text
        .replace(/<\/?p>/g, '') // Remove paragraph tags
        .replace(/<(?!\/?(b|i|u|s|tg-spoiler|a|code|pre)[ >])[^>]+>/g, '') // Remove unsupported tags
        .trim();
}

/**
 * Formats a transcription for display
 */
export function formatTranscription(transcription: string): string {
    return `<b>Here's what I heard:</b>\n\n<code>${sanitizeHtmlForTelegram(transcription)}</code>`;
}

/**
 * Formats error messages for user display
 */
export function formatErrorMessage(message: string): string {
    return `<b>Oops!</b> ${sanitizeHtmlForTelegram(message)}`;
}

/**
 * Formats system messages (info, success, etc)
 */
export function formatSystemMessage(message: string): string {
    return sanitizeHtmlForTelegram(message);
}

/**
 * Common error messages
 */
export const ErrorMessages = {
    ENTRY_NOT_FOUND: "I couldn't find that journal entry. Let's start fresh! ✨",
    TRANSCRIPTION_FAILED: "I had trouble understanding that recording. Could you try again? 🎤",
    GENERAL_ERROR: "Something went wrong. Please try again. ✨",
    ANALYSIS_FAILED: "I had trouble analyzing your entry, but don't worry - it's saved! ✨",
    EMPTY_ENTRY: "There's nothing to analyze yet. Share some thoughts first! ✨",
    SESSION_EXPIRED: "Looks like that reflection session ended. Let's start fresh! 💫"
} as const; 