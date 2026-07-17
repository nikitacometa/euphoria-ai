import { describe, expect, it } from 'vitest';
import { initialSession } from './context';

describe('initialSession', () => {
    it('starts in idle mode', () => {
        expect(initialSession()).toEqual({ mode: { kind: 'idle' } });
    });
});
