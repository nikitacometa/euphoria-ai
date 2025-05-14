import { JournalBotContext } from '../../../types/session';
import { IUser } from '../../../types/models';
import { withBotErrorHandling } from '../../../utils/error-handler';
import { 
    newEntryHandler as originalNewEntryHandler,
    handleJournalEntryInput as originalHandleJournalEntryInput,
    finishJournalEntryHandler as originalFinishJournalEntryHandler,
    analyzeAndSuggestQuestionsHandler as originalAnalyzeAndSuggestQuestionsHandler,
    handleGoDeeper as originalHandleGoDeeper
} from '../handlers';

/**
 * Creates a new journal entry with error handling
 */
export const newEntryHandler = withBotErrorHandling(
    originalNewEntryHandler,
    'errors:newEntryError'
);

/**
 * Handles journal entry input with error handling
 */
export const handleJournalEntryInput = withBotErrorHandling(
    originalHandleJournalEntryInput,
    'errors:errorProcessingInput'
);

/**
 * Finishes a journal entry with error handling
 */
export const finishJournalEntryHandler = withBotErrorHandling(
    originalFinishJournalEntryHandler,
    'errors:finishEntryError'
);

/**
 * Analyzes and suggests questions for a journal entry with error handling
 */
export const analyzeAndSuggestQuestionsHandler = withBotErrorHandling(
    originalAnalyzeAndSuggestQuestionsHandler,
    'errors:analysisErrorTryAgain'
);

/**
 * Handles the "Go Deeper" action with error handling
 */
export const handleGoDeeper = withBotErrorHandling(
    originalHandleGoDeeper,
    'errors:goDeeperError'
);
