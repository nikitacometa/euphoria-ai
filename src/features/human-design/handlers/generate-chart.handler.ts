import { Bot } from 'grammy';
import { JournalBotContext } from '../../../types/session';
import { findOrCreateUser } from '../../../database';
import { HumanDesignService, IHumanDesignServiceConfig } from '../../../services/ai/HumanDesignService';
import { createLogger } from '../../../utils/logger';
import config from '../../../config'; // Using default export again
import { setUserHumanDesignChart } from '../../../database/models/user.model';
import { findExistingChart } from '../../../database/models/human-design-chart.model';
import mongoose, { Types } from 'mongoose'; // Import Types

const handlerLogger = createLogger('HumanDesignHandler');

// --- State Management (Manual) ---
// WARNING: Simple in-memory state, will NOT scale and will be lost on restart.
// Consider using grammy-conversations or database persistence for real applications.
interface UserState {
  step: 'idle' | 'awaiting_date' | 'awaiting_time' | 'awaiting_location';
  birthDate?: string;
  birthTime?: string;
  birthLocation?: string;
}
const userStates = new Map<number, UserState>();
// ---------------------------------

// Instantiate the service
// TODO: Ensure AppConfig in config/types.ts includes a 'humanDesign' property 
//       of type { apiKey: string; baseUrl: string; }
// TODO: Ensure config/validation.ts loads and validates HUMAN_DESIGN_API_KEY and HUMAN_DESIGN_API_BASE_URL
const hdServiceConfig: IHumanDesignServiceConfig = {
  // Accessing via assumed structure on default config export
  apiKey: (config as any).humanDesign?.apiKey || 'MISSING_API_KEY',
  baseUrl: (config as any).humanDesign?.baseUrl || 'MISSING_BASE_URL',
  logger: createLogger('HumanDesignService'),
};
if (hdServiceConfig.apiKey === 'MISSING_API_KEY' || hdServiceConfig.baseUrl === 'MISSING_BASE_URL') {
    handlerLogger.error('Missing Human Design API Key or Base URL in config object!');
    // Consider throwing an error or disabling the command
}
const hdService = new HumanDesignService(hdServiceConfig);

/**
 * Handles the /generate_hd command to start the chart generation flow.
 */
async function handleGenerateChartCommand(ctx: JournalBotContext): Promise<void> {
  if (!ctx.from) return;
  handlerLogger.info(`User ${ctx.from.id} started /generate_hd`);

  // Reset any previous state for this user
  userStates.set(ctx.from.id, { step: 'awaiting_date' });

  await ctx.reply('Okay, let\'s generate your Human Design chart! ✨\nWhat is your date of birth? (Please use YYYY-MM-DD format)');
}

/**
 * Handles incoming messages during the chart generation flow.
 */
async function handleFlowMessages(ctx: JournalBotContext): Promise<void> {
  if (!ctx.from || !ctx.message?.text) return;

  const userId = ctx.from.id;
  const currentState = userStates.get(userId);
  const text = ctx.message.text.trim();

  if (!currentState || currentState.step === 'idle') {
    // Not in the generation flow, ignore or pass to other handlers
    return;
  }

  try {
    switch (currentState.step) {
      case 'awaiting_date':
        if (!/\d{4}-\d{2}-\d{2}/.test(text)) {
          await ctx.reply('Hmm, that doesn\'t look right. Please enter the date as YYYY-MM-DD.');
          return;
        }
        currentState.birthDate = text;
        currentState.step = 'awaiting_time';
        await ctx.reply('Got it. Now, what time were you born? (Please use HH:MM 24-hour format)');
        break;

      case 'awaiting_time':
         if (!/^([01]?\d|2[0-3]):([0-5]\d)$/.test(text)) {
          await ctx.reply('Hmm, invalid time. Please use HH:MM format (e.g., 09:30 or 17:15).');
          return;
        }
        currentState.birthTime = text;
        currentState.step = 'awaiting_location';
        await ctx.reply('Excellent. Finally, where were you born? (e.g., London, UK or New York, USA)');
        break;

      case 'awaiting_location':
        if (!text || text.length < 3) {
          await ctx.reply('Please enter a valid city and country/state.');
          return;
        }
        currentState.birthLocation = text;
        await ctx.reply('Got it! Generating your chart now, please wait a moment... ⏳');
        currentState.step = 'idle'; // Prevent further processing for this flow
        userStates.delete(userId); // Clean up state

        // --- Call the Service --- (using validated data)
        try {
           // First, find timezone based on location
          // NOTE: API returns multiple matches, how to pick the right one?
          // For now, just attempt to use the first result's timezone.
          // This is a MAJOR simplification and likely needs user interaction.
          handlerLogger.info(`Finding timezone for location: ${currentState.birthLocation}`);
          const locationResults = await hdService.findLocationTimezone(currentState.birthLocation);
          
          if (!locationResults || locationResults.length === 0 || !locationResults[0].timezone) {
              await ctx.reply('Sorry, I couldn\'t determine the timezone for that location. Please try specifying it more clearly (e.g., \"Paris, France\").');
              return;
          }
          const timezone = locationResults[0].timezone;
          handlerLogger.info(`Using timezone: ${timezone} for location: ${currentState.birthLocation}`);
          
          // Generate chart
          const chartData = await hdService.getChart(
            currentState.birthDate!, // Already validated
            currentState.birthTime!, // Already validated
            currentState.birthLocation, // Use the raw location string for caching consistency
            timezone
          );

          // --- Save Chart ID to User --- 
            // Corrected: Use findExistingChart imported above
            const savedChart = await findExistingChart(currentState.birthDate!, currentState.birthTime!, currentState.birthLocation);
            if (savedChart && savedChart._id) { // Check if savedChart and _id exist
                try {
                  // Ensure _id is a valid type before conversion
                  const chartObjectId = new Types.ObjectId(savedChart._id as Types.ObjectId | string | number); 
                  await setUserHumanDesignChart(userId, chartObjectId);
                  handlerLogger.info(`Saved chart reference ${savedChart._id} for user ${userId}`);
                } catch (objectIdError) {
                    handlerLogger.error(`Error converting saved chart ID to ObjectId for user ${userId}:`, { savedId: savedChart._id, error: objectIdError });
                }
            } else {
                handlerLogger.error(`Could not find saved chart or its ID for user ${userId} after generation`);
            }

          // --- Send Confirmation --- 
          // Format a simple confirmation message
          const profile = chartData.Properties?.Profile?.Id ?? 'N/A';
          const type = chartData.Properties?.Type?.Id ?? 'N/A';
          const authority = chartData.Properties?.InnerAuthority?.Id ?? 'N/A';
          
          const confirmationMsg = 
`🎉 Your Human Design Chart is ready! 🎉

**Profile:** ${profile}
**Type:** ${type}
**Authority:** ${authority}

You can now use the /hd_chat command to ask questions about your design!`;

          await ctx.reply(confirmationMsg, { parse_mode: 'Markdown' });

        } catch (error) {
          handlerLogger.error('Error during chart generation or saving:', error);
          await ctx.reply('Oh dear, something went wrong while generating your chart. Please try again later or contact support if the problem persists.');
          // Optionally: Send detailed error to admin/support chat
        }
        break;
    }
  } catch (flowError) {
     handlerLogger.error('Error in message handling flow:', flowError);
     await ctx.reply('An unexpected error occurred. Please try starting the command again.');
     userStates.delete(userId); // Clean up state on error
  }
}

/**
 * Registers the Human Design generation command and message handler.
 * NOTE: This function itself doesn't register with the main bot instance.
 * Call this function from the feature registration file.
 */
export function registerHumanDesignHandlers(bot: Bot<JournalBotContext>): void {
  bot.command('generate_hd', handleGenerateChartCommand);
  bot.on('message:text', handleFlowMessages);
  handlerLogger.info('Human Design generation handlers registered locally.');
} 