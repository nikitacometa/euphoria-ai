import { Context, SessionFlavor } from 'grammy';
// import { Conversation, ConversationFlavor } from '@grammyjs/conversations'; // Removed unused import

// Define the shape of your session data
export interface JournalBotSession {
    // Flag for journal chat mode
    journalChatMode: boolean;
    waitingForJournalQuestion?: boolean;
    // Onboarding state
    onboardingStep?: 'name' | 'age' | 'gender' | 'occupation' | 'timezone' | 'notification_time' | 'completed';
    onboardingData?: {
        name?: string;
        age?: string;
        gender?: string;
        occupation?: string;
        timezone?: string;
        notificationTime?: string;
    };
    // Human Design Chat mode flag
    inHdChat?: boolean;
}

// Define your context type, including session
export type JournalBotContext = Context & 
    SessionFlavor<JournalBotSession>;
    // & ConversationFlavor; // Removed conversation flavor

// Define Conversation type if using conversations
// export type JournalBotConversation = Conversation<JournalBotContext>; // Removed conversation type 