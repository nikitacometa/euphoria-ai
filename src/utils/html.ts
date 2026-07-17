/**
 * Escapes text for Telegram HTML parse mode.
 * Must be applied to any user-provided or model-generated content
 * before it is interpolated into an HTML-formatted message.
 */
export function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
