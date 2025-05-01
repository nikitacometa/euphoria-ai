import { Bot } from 'grammy';
import { JournalBotContext, JournalBotSession } from '../../../types/session';
import { findOrCreateUser, getUserWithHumanDesignChart } from '../../../database';
import { createLogger } from '../../../utils/logger';
import { promptText } from '../../../services/ai/openai.service'; // Import AI service
import { IHumanDesignChart } from '../../../types/models';
import { IHumanDesignChartResponse } from '../../../services/ai/humanDesign.types';

const chatLogger = createLogger('HumanDesignChatHandler');

// Extend session type
declare module '@grammyjs/types' {
    interface SessionData {
        inHdChat?: boolean;
    }
}

/**
 * Creates a concise summary of the HD chart for the AI context.
 */
function formatChartForContext(chartDoc: IHumanDesignChart | undefined | null): string {
  // Check if chartDoc exists and has the chartData property
  if (!chartDoc || !chartDoc.chartData || typeof chartDoc.chartData !== 'object') {
    return 'User has no chart data available or data is malformed.';
  }

  // chartData holds the raw API response structure
  const chartData = chartDoc.chartData as IHumanDesignChartResponse; 
  const props = chartData.Properties;

  if (!props) {
      return 'User chart data properties are missing.';
  }
  
  // Extract key details from chartData.Properties
  const type = props.Type?.Id ?? 'N/A';
  const profile = props.Profile?.Id ?? 'N/A';
  const authority = props.InnerAuthority?.Id ?? 'N/A';
  const definition = props.Definition?.Id ?? 'N/A';
  // Access centers/channels from the main chartData structure if available
  const centers = chartData.DefinedCenters ? `Defined Centers: ${chartData.DefinedCenters.join(', ')}` : 'No defined centers data.';
  const channels = chartData.Channels ? `Channels: ${chartData.Channels.join(', ')}` : 'No channels data.';

  return `User's Human Design Chart Summary:
- Type: ${type}
- Profile: ${profile}
- Authority: ${authority}
- Definition: ${definition}
- ${centers}
- ${channels}`;
}

/**
 * Handles the /hd_chat command.
 */
async function handleHdChatCommand(ctx: JournalBotContext): Promise<void> {
  if (!ctx.from) return;
  chatLogger.info(`User ${ctx.from.id} started /hd_chat`);

  const user = await getUserWithHumanDesignChart(ctx.from.id);

  if (!user?.humanDesignChartId) {
    await ctx.reply('You need to generate your Human Design chart first! Use the /generate_hd command.');
    ctx.session.inHdChat = false; // Ensure flag is off
    return;
  }

  ctx.session.inHdChat = true;
  await ctx.reply('Okay, I see you have your chart. What would you like to ask about your Human Design? ✨');
}

/**
 * Handles text messages when the user is in the HD chat mode.
 */
async function handleHdChatMessages(ctx: JournalBotContext): Promise<void> {
  if (!ctx.from || !ctx.message?.text || !ctx.session.inHdChat) {
    // Not in HD chat mode or not a text message
    return;
  }

  // Ignore commands while in chat mode
  if (ctx.message.text.startsWith('/')) {
      await ctx.reply("To exit the Human Design chat, use /cancel. Otherwise, please ask your question.");
      return;
  }
  
  const userId = ctx.from.id;
  const userQuestion = ctx.message.text;
  chatLogger.info(`User ${userId} asked HD question: ${userQuestion}`);

  await ctx.replyWithChatAction('typing');

  try {
    const user = await getUserWithHumanDesignChart(userId);
    if (!user) {
        chatLogger.warn(`User ${userId} not found in database during HD chat.`);
        await ctx.reply('Sorry, I couldn\'t find your user profile.');
        ctx.session.inHdChat = false;
        return;
    }

    const chartDocument = user.humanDesignChartId as IHumanDesignChart | undefined;

    if (!chartDocument) {
      chatLogger.warn(`User ${userId} is in HD chat mode but chart data is missing or not populated correctly.`);
      await ctx.reply('Sorry, I couldn\'t retrieve your chart data. Please try starting the chat again with /hd_chat.');
      ctx.session.inHdChat = false;
      return;
    }

    // Prepare context for AI using the populated document
    const chartContext = formatChartForContext(chartDocument);
    const fullPrompt = `${chartContext}\n\nUser Question: ${userQuestion}\n\nPlease answer the user's question based on their Human Design chart information provided above.`;

    chatLogger.debug(`Sending prompt to AI for user ${userId}:\n${fullPrompt}`);

    // Call AI service
    const aiResponse = await promptText(fullPrompt, user.aiLanguage || 'en');

    chatLogger.info(`Received AI response for user ${userId}`);
    await ctx.reply(aiResponse);

  } catch (error) {
    chatLogger.error(`Error handling HD chat message for user ${userId}:`, error);
    await ctx.reply('Sorry, I encountered an issue trying to answer your question. Please try again.');
  }
}

/**
 * Registers the Human Design chat command and message handler.
 */
export function registerHumanDesignChatHandlers(bot: Bot<JournalBotContext>): void {
  bot.command('hd_chat', handleHdChatCommand);
  bot.on('message:text', handleHdChatMessages); // Handles subsequent messages

  // Add a way to exit the chat mode explicitly
  bot.command('cancel', (ctx) => {
      if (ctx.session.inHdChat) {
          ctx.session.inHdChat = false;
          ctx.reply('Exited Human Design chat mode.');
          // Potentially show main menu again if desired
      } 
      // Allow /cancel to work normally otherwise (handled by core handlers)
  });

  chatLogger.info('Human Design chat handlers registered.');
} 