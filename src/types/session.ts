import { Context, SessionFlavor } from 'grammy';

// Define session interface
export interface JournalBotSession {
    onboardingStep?: 'name' | 'age' | 'gender' | 'occupation' | 'bio' | 'complete';
    journalEntryId?: string;
    journalChatMode: boolean;
    waitingForJournalQuestion: boolean;
    waitingForNotificationTime?: boolean;
    waitingForTimezone?: boolean;
}

// Define context type
export type JournalBotContext = Context & SessionFlavor<JournalBotSession>; 