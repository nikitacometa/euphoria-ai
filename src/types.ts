import { Context, SessionFlavor } from 'grammy';

export interface JournalBotSession {
    onboardingStep?: 'language' | 'name' | 'age' | 'gender' | 'occupation' | 'bio' | 'complete';
    journalEntryId?: string;
    journalChatMode?: boolean;
    waitingForJournalQuestion?: boolean;
    settingsMode?: boolean;
    settingsStep?: 'notifications' | 'time';
}

export type JournalBotContext = Context & SessionFlavor<JournalBotSession>; 