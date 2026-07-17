import { Context, SessionFlavor } from 'grammy';
import { IUser } from '../database';

export type OnboardingStep = 'language' | 'name' | 'age' | 'gender' | 'occupation' | 'bio';

/**
 * The bot is always in exactly one mode. Modeling this as a discriminated
 * union (instead of independent boolean flags) makes stale-state bugs
 * unrepresentable: entering a mode always replaces the previous one.
 */
export type SessionMode =
    | { kind: 'idle' }
    | { kind: 'onboarding'; step: OnboardingStep }
    | { kind: 'journal_entry'; entryId: string }
    | { kind: 'journal_chat' }
    | { kind: 'settings' };

export interface JournalBotSession {
    mode: SessionMode;
}

export function initialSession(): JournalBotSession {
    return { mode: { kind: 'idle' } };
}

interface UserFlavor {
    /** Set by the user middleware for every update that has a sender. */
    user: IUser;
}

export type JournalBotContext = Context & SessionFlavor<JournalBotSession> & UserFlavor;
