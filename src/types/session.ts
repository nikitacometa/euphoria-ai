import { Context, SessionFlavor } from 'grammy';

// Define onboarding step type for clarity
type OnboardingStep = 'name' | 'age' | 'gender' | 'timezone' | 'language' | 'occupation' | 'bio' | 'complete';
// TODO: Update OnboardingStep 'timezone' to 'utcOffset' in a later phase if this type is still used for flow control

// Define session interface
export interface JournalBotSession {
    onboardingStep?: OnboardingStep;
    journalEntryId?: string;
    journalChatMode: boolean;
    waitingForJournalQuestion: boolean;
    waitingForNotificationTime?: boolean;
    waitingForUtcOffset?: boolean; // Renamed from waitingForTimezone
    askingSettings?: boolean;
    lastStatusMessageId?: number;
    isMainMenuActive?: boolean; // Flag to indicate if the main menu was just shown
    adminReanalyzeAllConfirmation?: boolean; // For admin command
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
    // waitingForTimezone?: boolean; // Old field, replaced by waitingForUtcOffset in JournalBotSession
    askingSettings?: boolean;

    // Status message tracking
    lastStatusMessageId?: number;
} 