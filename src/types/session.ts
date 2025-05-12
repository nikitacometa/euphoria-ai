import { Context, SessionFlavor } from 'grammy';

// Define onboarding step type for clarity
type OnboardingStep = 'name' | 'age' | 'gender' | 'timezone' | 'language' | 'occupation' | 'bio' | 'complete';

// Define session interface
export interface JournalBotSession {
    onboardingStep?: OnboardingStep;
    journalEntryId?: string;
    journalChatMode: boolean;
    waitingForJournalQuestion: boolean;
    waitingForNotificationTime?: boolean;
    waitingForTimezone?: boolean;
    askingSettings?: boolean;
    lastStatusMessageId?: number;
}

// Define context type
export type JournalBotContext = Context & SessionFlavor<JournalBotSession>;

export interface SessionData {
    // Core
    onboardingStep?: OnboardingStep;
    journalEntryId?: string;
    journalChatMode?: boolean;
    waitingForJournalQuestion?: boolean;
    
    // Settings
    waitingForNotificationTime?: boolean;
    askingSettings?: boolean;

    // Status message tracking
    lastStatusMessageId?: number;
} 