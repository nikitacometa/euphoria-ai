import { describe, expect, it } from 'vitest';
import { escapeHtml } from './html';

describe('escapeHtml', () => {
    it.each([
        ['&', '&amp;'],
        ['<', '&lt;'],
        ['>', '&gt;'],
        ['I <3 & "you"', 'I &lt;3 &amp; "you"'],
        ['&amp;', '&amp;amp;'],
        ['', '']
    ])('escapes %j as %j', (input, expected) => {
        expect(escapeHtml(input)).toBe(expected);
    });
});
