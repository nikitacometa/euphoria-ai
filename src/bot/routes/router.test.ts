import { Bot } from 'grammy';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JournalBotContext, SessionMode } from '../context';

vi.mock('../helpers', () => ({
    showMainMenu: vi.fn()
}));

vi.mock('./onboarding', () => ({
    handleOnboardingMessage: vi.fn()
}));

vi.mock('./journal-entry', () => ({
    handleJournalEntryMessage: vi.fn()
}));

vi.mock('./journal-chat', () => ({
    handleChatMessage: vi.fn()
}));

vi.mock('./settings', () => ({
    handleSettingsMessage: vi.fn()
}));

import { showMainMenu } from '../helpers';
import { handleChatMessage } from './journal-chat';
import { handleJournalEntryMessage } from './journal-entry';
import { handleOnboardingMessage } from './onboarding';
import { registerMessageRouter } from './router';
import { handleSettingsMessage } from './settings';

type MessageHandler = (ctx: JournalBotContext) => Promise<void>;

const handlers = [
    handleOnboardingMessage,
    handleJournalEntryMessage,
    handleChatMessage,
    handleSettingsMessage,
    showMainMenu
];

function context(mode: SessionMode): JournalBotContext {
    return {
        session: { mode },
        user: { firstName: 'Nik' }
    } as unknown as JournalBotContext;
}

describe('registerMessageRouter', () => {
    let captured: MessageHandler | undefined;

    beforeEach(() => {
        vi.clearAllMocks();
        captured = undefined;
    });

    it.each([
        [{ kind: 'onboarding', step: 'name' } as const, handleOnboardingMessage],
        [{ kind: 'journal_entry', entryId: 'entry-id' } as const, handleJournalEntryMessage],
        [{ kind: 'journal_chat' } as const, handleChatMessage],
        [{ kind: 'settings' } as const, handleSettingsMessage]
    ])('routes $mode.kind mode to only its handler', async (mode, expectedHandler) => {
        const bot = {
            on: vi.fn((_event: string, callback: MessageHandler) => {
                captured = callback;
            })
        } as unknown as Bot<JournalBotContext>;
        const ctx = context(mode);
        registerMessageRouter(bot);

        await captured?.(ctx);

        expect(expectedHandler).toHaveBeenCalledWith(ctx);
        for (const handler of handlers.filter(candidate => candidate !== expectedHandler)) {
            expect(handler).not.toHaveBeenCalled();
        }
    });

    it('shows the main menu with the current user in idle mode', async () => {
        const bot = {
            on: vi.fn((_event: string, callback: MessageHandler) => {
                captured = callback;
            })
        } as unknown as Bot<JournalBotContext>;
        const ctx = context({ kind: 'idle' });
        registerMessageRouter(bot);

        await captured?.(ctx);

        expect(showMainMenu).toHaveBeenCalledWith(ctx, ctx.user);
        for (const handler of handlers.filter(candidate => candidate !== showMainMenu)) {
            expect(handler).not.toHaveBeenCalled();
        }
    });
});
