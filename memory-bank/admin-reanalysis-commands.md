# Admin Re-Analysis Commands Design

## Overview

The re-analysis commands will allow administrators to reprocess existing journal entries with the latest AI analysis algorithm. Two commands will be implemented:

1. `/reanalyzeme` - Re-analyze only the current user's entries
2. `/reanalyzeall` - Re-analyze all entries for all users

## Command Structure

### Command Registration

```typescript
// src/commands/index.ts
import { reanalyzeMe, reanalyzeAll } from './reanalyze';

// Register commands
bot.command('reanalyzeme', isAdmin, reanalyzeMe);
bot.command('reanalyzeall', isAdmin, reanalyzeAll);
```

### Admin Middleware

```typescript
// src/middlewares/admin.ts
import { ADMIN_USER_IDS } from '../config';
import { JournalBotContext } from '../types/session';

export function isAdmin(ctx: JournalBotContext, next: () => Promise<void>) {
  const userId = ctx.from?.id;
  
  if (userId && ADMIN_USER_IDS.includes(userId.toString())) {
    return next();
  }
  
  ctx.reply('This command is only available to administrators.');
  return;
}
```

## Implementation Design

### Core Analysis Function

We'll extract the core analysis logic from the existing implementation to make it reusable:

```typescript
// src/services/ai/journal-analysis.service.ts

/**
 * Performs analysis on a journal entry
 * @param entry The journal entry to analyze
 * @param user The user who created the entry
 * @returns Analysis results containing analysis text, insights, and questions
 */
export async function analyzeJournalEntryContent(
  entry: IJournalEntry,
  user: IUser
): Promise<{
  analysis: string;
  insights: string;
  questions: string[];
}> {
  try {
    // Extract entry content
    const entryContent = extractContentFromEntry(entry);
    
    if (!entryContent) {
      return {
        analysis: "Not enough content to analyze.",
        insights: "No insights available for empty entries.",
        questions: ["What would you like to write about?"]
      };
    }
    
    // Core analysis implementation (extracted from existing code)
    // ... analysis logic ...
    
    return {
      analysis,
      insights,
      questions
    };
  } catch (error) {
    // Error handling
    errorService.logError(/* ... */);
    
    return {
      analysis: "Analysis error occurred.",
      insights: "Could not generate insights due to an error.",
      questions: ["What else would you like to explore?"]
    };
  }
}

/**
 * Updates an entry with analysis results
 * @param entryId The ID of the entry to update
 * @param results Analysis results to save
 */
export async function updateEntryWithAnalysis(
  entryId: Types.ObjectId,
  results: {
    analysis: string;
    insights: string;
    questions: string[];
  }
): Promise<IJournalEntry | null> {
  try {
    return await JournalEntry.findByIdAndUpdate(
      entryId,
      {
        $set: {
          analysis: results.analysis,
          aiInsights: results.insights,
          aiQuestions: results.questions
        }
      },
      { new: true }
    );
  } catch (error) {
    errorService.logError(/* ... */);
    return null;
  }
}
```

### Batch Processing Implementation

```typescript
// src/commands/reanalyze.ts

/**
 * Re-analyzes entries for the current user
 */
export async function reanalyzeMe(ctx: JournalBotContext) {
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.reply("User ID not found.");
    return;
  }
  
  try {
    await ctx.reply("Starting re-analysis of your entries...");
    
    const user = await getUserById(userId);
    if (!user) {
      await ctx.reply("User record not found.");
      return;
    }
    
    // Fetch all completed entries for this user
    const entries = await getUserJournalEntries(user._id);
    
    if (entries.length === 0) {
      await ctx.reply("No completed entries found to re-analyze.");
      return;
    }
    
    await ctx.reply(`Found ${entries.length} entries. Beginning analysis...`);
    
    // Process entries in batches to prevent timeouts
    const batchSize = 5;
    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      
      // Process batch in parallel
      const results = await Promise.allSettled(
        batch.map(entry => processEntry(entry, user))
      );
      
      // Count results
      results.forEach(result => {
        processedCount++;
        if (result.status === 'fulfilled') {
          successCount++;
        } else {
          errorCount++;
        }
      });
      
      // Send progress update
      if (processedCount % 10 === 0 || processedCount === entries.length) {
        await ctx.reply(
          `Progress: ${processedCount}/${entries.length} entries processed.\n` +
          `✅ ${successCount} successful\n` +
          `❌ ${errorCount} failed`
        );
      }
    }
    
    await ctx.reply(
      `Re-analysis complete!\n` +
      `✅ ${successCount} entries were successfully re-analyzed.\n` +
      `❌ ${errorCount} entries failed.`
    );
  } catch (error) {
    errorService.logError(/* ... */);
    await ctx.reply("An error occurred during re-analysis.");
  }
}

/**
 * Re-analyzes entries for all users
 */
export async function reanalyzeAll(ctx: JournalBotContext) {
  try {
    await ctx.reply("Starting re-analysis of ALL entries for ALL users...");
    
    // Confirm with admin before proceeding
    await ctx.reply(
      "⚠️ WARNING: This will re-analyze ALL journal entries for ALL users. " +
      "This operation may take a long time and consume significant resources.\n\n" +
      "Are you sure you want to continue? Reply with 'yes' to confirm."
    );
    
    // Set waiting for confirmation state
    ctx.session.adminReanalyzeAllConfirmation = true;
    
    // The confirmation is handled in a separate message handler
  } catch (error) {
    errorService.logError(/* ... */);
    await ctx.reply("An error occurred while preparing re-analysis.");
  }
}

/**
 * Handle confirmation for reanalyzeAll command
 */
export async function handleReanalyzeAllConfirmation(ctx: JournalBotContext) {
  // Check if we're waiting for confirmation
  if (!ctx.session.adminReanalyzeAllConfirmation) {
    return;
  }
  
  // Reset waiting state
  ctx.session.adminReanalyzeAllConfirmation = false;
  
  // Check if confirmation is 'yes'
  const message = ctx.message?.text?.toLowerCase();
  if (message !== 'yes') {
    await ctx.reply("Re-analysis of all entries cancelled.");
    return;
  }
  
  try {
    await ctx.reply("Confirmation received. Starting re-analysis of ALL entries...");
    
    // Get all users
    const users = await getAllUsers();
    
    // Get total entry count
    const totalEntries = await JournalEntry.countDocuments({ 
      status: JournalEntryStatus.COMPLETED 
    });
    
    await ctx.reply(`Found ${users.length} users with ${totalEntries} total entries.`);
    
    let processedUsers = 0;
    let totalProcessed = 0;
    let totalSuccess = 0;
    let totalErrors = 0;
    
    // Process each user's entries
    for (const user of users) {
      processedUsers++;
      
      // Get all completed entries for this user
      const entries = await getUserJournalEntries(user._id);
      
      if (entries.length === 0) {
        continue;
      }
      
      await ctx.reply(
        `Processing user ${processedUsers}/${users.length}: ` +
        `${user.firstName} (${user.telegramId}) - ${entries.length} entries`
      );
      
      // Process entries in batches
      const batchSize = 5;
      let userSuccess = 0;
      let userErrors = 0;
      
      for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);
        
        // Process batch in parallel
        const results = await Promise.allSettled(
          batch.map(entry => processEntry(entry, user))
        );
        
        // Count results
        results.forEach(result => {
          totalProcessed++;
          if (result.status === 'fulfilled') {
            userSuccess++;
            totalSuccess++;
          } else {
            userErrors++;
            totalErrors++;
          }
        });
        
        // Update progress periodically
        if (totalProcessed % 20 === 0 || 
            i + batchSize >= entries.length || 
            totalProcessed === totalEntries) {
          await ctx.reply(
            `Overall progress: ${totalProcessed}/${totalEntries} entries processed.\n` +
            `Current user: ${userSuccess + userErrors}/${entries.length} entries processed.\n` +
            `✅ Total successful: ${totalSuccess}\n` +
            `❌ Total failed: ${totalErrors}`
          );
        }
      }
      
      await ctx.reply(
        `Completed user ${user.firstName} (${user.telegramId}):\n` +
        `✅ ${userSuccess} successful\n` +
        `❌ ${userErrors} failed`
      );
    }
    
    await ctx.reply(
      `🎉 Re-analysis of ALL entries complete!\n` +
      `✅ ${totalSuccess} entries were successfully re-analyzed.\n` +
      `❌ ${totalErrors} entries failed.\n` +
      `Processed ${processedUsers} users in total.`
    );
  } catch (error) {
    errorService.logError(/* ... */);
    await ctx.reply("An error occurred during re-analysis.");
  }
}

/**
 * Process an individual entry
 */
async function processEntry(entry: IJournalEntry, user: IUser): Promise<boolean> {
  try {
    // Perform analysis
    const results = await analyzeJournalEntryContent(entry, user);
    
    // Update entry with results
    await updateEntryWithAnalysis(entry._id, results);
    
    return true;
  } catch (error) {
    errorService.logError(/* ... */);
    return false;
  }
}
```

### Session Type Update

```typescript
// src/types/session.ts
export interface AdminState {
  adminReanalyzeAllConfirmation?: boolean;
}

export interface JournalBotSessionData extends AdminState {
  // ... existing fields
}
```

## Progress Tracking and Error Handling

1. **Batch Processing**: Process entries in small batches (5-10) to prevent memory issues
2. **Progress Updates**: Send regular updates to the admin about progress
3. **Error Resilience**: Continue processing even if some entries fail
4. **Detailed Reporting**: Provide summary of success/failure at the end

## Security Considerations

1. **Admin-Only Access**: Use middleware to verify admin status
2. **Confirmation for Major Operations**: Require explicit confirmation for reanalyzeAll
3. **Rate Limiting**: Avoid OpenAI API rate limits by controlling batch sizes
4. **Timeout Handling**: Graceful recovery from potential Telegram API timeouts

## Testing Approach

1. **Unit Tests**:
   - Test the extracted analysis functions
   - Test batch processing with mock entries
   - Test admin validation middleware

2. **Integration Tests**:
   - Test reanalyzing a small batch of entries
   - Test confirmation flow for reanalyzeAll
   - Test error handling scenarios

3. **Admin Manual Testing**:
   - Test with a small subset of real entries
   - Verify analysis quality compared to original
   - Monitor performance and resource usage

## Configuration Parameters

Add to the configuration:

```typescript
// src/config/index.ts
export const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || '').split(',');
export const REANALYSIS_BATCH_SIZE = parseInt(process.env.REANALYSIS_BATCH_SIZE || '5');
export const REANALYSIS_PROGRESS_INTERVAL = parseInt(process.env.REANALYSIS_PROGRESS_INTERVAL || '10');
``` 