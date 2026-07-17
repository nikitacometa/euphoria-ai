import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../database', () => ({
    getAllLocalizationTexts: vi.fn(),
    upsertLocalizationText: vi.fn(),
    updateTranslation: vi.fn()
}));

import { IUser } from '../database';
import {
    getTextForUser,
    Language,
    LocalizedText,
    texts
} from './localization';

const originalGreeting = texts.greet;

function user(overrides: Partial<IUser> = {}): IUser {
    return {
        firstName: 'Nik',
        language: Language.ENGLISH,
        ...overrides
    } as unknown as IUser;
}

beforeEach(() => {
    texts.greet = {
        [Language.ENGLISH]: 'Hello {name}, {custom}!',
        [Language.RUSSIAN]: 'Привет, {name}, {custom}!'
    };
});

afterEach(() => {
    if (originalGreeting) {
        texts.greet = originalGreeting;
    } else {
        delete texts.greet;
    }
});

describe('getTextForUser', () => {
    it('escapes the user name', () => {
        expect(getTextForUser('greet', user({ name: '<Nik>' }), { custom: 'friend' }))
            .toBe('Hello &lt;Nik&gt;, friend!');
    });

    it('escapes custom string variables', () => {
        expect(getTextForUser('greet', user(), { custom: '<b>friend</b>' }))
            .toBe('Hello Nik, &lt;b&gt;friend&lt;/b&gt;!');
    });

    it('passes trusted raw variables through unchanged', () => {
        expect(getTextForUser('greet', user(), { custom: { raw: '<i>x</i>' } }))
            .toBe('Hello Nik, <i>x</i>!');
    });

    it.each(['$&', '$\''])('inserts the replacement-pattern value %j literally', value => {
        expect(getTextForUser('greet', user(), { custom: { raw: value } }))
            .toBe(`Hello Nik, ${value}!`);
    });

    it('returns a missing-key marker', () => {
        expect(getTextForUser('key', user())).toBe('[Missing text: key]');
    });

    it('falls back to English when the selected translation is empty', () => {
        texts.greet = {
            [Language.ENGLISH]: 'English fallback',
            [Language.RUSSIAN]: ''
        } satisfies LocalizedText;

        expect(getTextForUser('greet', user({ language: Language.RUSSIAN })))
            .toBe('English fallback');
    });
});
