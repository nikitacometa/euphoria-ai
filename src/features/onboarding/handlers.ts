import { Bot, Context, Keyboard } from 'grammy';
import { JournalBotContext } from '../../types/session';
import { IUser } from '../../types/models';
import { updateUserProfile } from '../../database'; // Assuming updateUserProfile is exported from database index
import { ageKeyboard, genderKeyboard } from './keyboards';
import { isValidAgeRange, isValidGender } from './utils';
import { transcribeAudio } from '../../services/ai/openai.service'; // Import transcription service
import { showMainMenu } from '../core/handlers';
import { logger } from '../../utils/logger';
import { TELEGRAM_API_TOKEN } from '../../config';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';


// Helper function (remains local to this feature for now)
function generatePersonalizedBioSummary(bio: string): string {
    const shortBio = bio.slice(0, 100).trim();
    return `${shortBio}${bio.length > 100 ? '...' : ''}\n\nLooking forward to our conversations ✨`;
}

// Core onboarding handler function
export async function handleOnboarding(ctx: JournalBotContext, user: IUser) {
    if (!ctx.message || !ctx.from) return;
    
    const step = ctx.session.onboardingStep;
    // Explicitly handle only text messages for steps expecting keyboard input
    const text = 'text' in ctx.message ? ctx.message.text : undefined;

    switch (step) {
        case 'name': {
            if (!text) { // Expecting text for name
                 await ctx.reply("Please tell me what name you'd like me to use.");
                 return;
            }
            await updateUserProfile(ctx.from.id, { name: text });
            ctx.session.onboardingStep = 'age';
            await ctx.reply(`${text}, what a lovely name 😏\n\nYour age?`, {
                reply_markup: ageKeyboard, // Use imported keyboard
                parse_mode: 'HTML'
            });
            break;
        }
        case 'age': {
            if (!text || !isValidAgeRange(text)) { // Expecting text from keyboard
                await ctx.reply("Please choose from the options provided ✨");
                return;
            }
            await updateUserProfile(ctx.from.id, { age: text });
            ctx.session.onboardingStep = 'gender';
            await ctx.reply("How do you identify yourself? 🌟", {
                reply_markup: genderKeyboard, // Use imported keyboard
                parse_mode: 'HTML'
            });
            break;
        }
        case 'gender': {
             if (!text || !isValidGender(text)) { // Expecting text from keyboard
                await ctx.reply("Let's pick from the options I suggested 💫");
                return;
            }
            await updateUserProfile(ctx.from.id, { gender: text });
            ctx.session.onboardingStep = 'occupation';
            await ctx.reply("What is your occupation, work? Or main activity in life? 🌟", {
                reply_markup: { remove_keyboard: true },
                parse_mode: 'HTML'
            });
            break;
        }
        case 'occupation': {
            if (!text) { // Expecting text for occupation
                 await ctx.reply("Please tell me about your occupation.");
                 return;
            }
            await updateUserProfile(ctx.from.id, { occupation: text });
            ctx.session.onboardingStep = 'bio';
            await ctx.reply("Tell me anything about yourself! The more details you share, the better I will understand you ✨\n\nSome ideas:<i>\n• Your hobbies?\n• What drives you?\n• Interesting friends or romantic partners?\n• Your passions?\n• Life philosophy?\n• What makes you unique?</i>\n\nFeel free to type, or send a voice/video message.", {
                parse_mode: 'HTML'
            });
            break;
        }
        case 'bio': {
            let bioText = text; // Default to text if available
            
            // Handle voice/video transcription if present
            // Use optional chaining for safety
            const voiceFileId = ctx.message?.voice?.file_id;
            const videoFileId = ctx.message?.video?.file_id;
            const videoNoteFileId = ctx.message?.video_note?.file_id;
            const mediaFileId = voiceFileId || videoFileId || videoNoteFileId;

            if (mediaFileId) {
                 if (bioText) {
                    // User sent text AND media, maybe clarify or just use media?
                    logger.info(`User ${ctx.from.id} sent both text and media for bio. Using media.`);
                }
                
                // Add eyes reaction to indicate processing instead of sending a message
                await ctx.react("👀").catch(e => logger.warn("Failed to react with eyes", e));
                
                try {
                    const file = await ctx.api.getFile(mediaFileId);
                    const filePath = file.file_path;
                    
                    if (filePath) {
                        const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_API_TOKEN}/${filePath}`;
                        const tempDir = path.join(os.tmpdir(), 'journal-bot-onboarding'); // Unique temp dir
                        
                        if (!fs.existsSync(tempDir)) {
                            fs.mkdirSync(tempDir, { recursive: true });
                        }
                        
                        const localFilePath = path.join(tempDir, `bio_${Date.now()}.${filePath.split('.').pop()}`);
                        
                        const response = await fetch(fileUrl);
                         if (!response.ok) throw new Error(`Failed to download file: ${response.statusText}`);
                        const buffer = await response.arrayBuffer();
                        fs.writeFileSync(localFilePath, Buffer.from(buffer));
                        
                        bioText = await transcribeAudio(localFilePath);
                        fs.unlinkSync(localFilePath); // Clean up immediately
                        
                        // Replace eyes reaction with thumbs up - don't try to delete the old one
                        await ctx.react("👍").catch(e => logger.warn("Failed to add thumbs up reaction", e));
                        
                        // Consider removing tempDir if empty, or have a separate cleanup process
                    } else {
                         throw new Error("File path not found after fetching file info.");
                    }
                } catch (error) {
                    // If we failed, try to add an error reaction
                    try {
                        await ctx.react("😢").catch(e => logger.warn("Failed to react with error symbol", e));
                    } catch (e) {
                        logger.warn("Failed to add error reaction", e);
                    }
                    
                    logger.error('Error processing voice/video bio:', error);
                    await ctx.reply("I couldn't process your message. Could you type it instead? 🎧");
                    return; // Don't proceed if media processing failed
                }
            } else if (!bioText) {
                // No text and no valid media provided
                await ctx.reply("Please tell me a bit about yourself using text, voice, or video.");
                return;
            }

            // We should have bioText now either from text or transcription
            const updatedUser = await updateUserProfile(ctx.from.id, { bio: bioText, onboardingCompleted: true });
            if (!updatedUser) { // Check if user update failed
                logger.error(`Failed to update profile for user ${ctx.from.id} during bio step.`);
                 await ctx.reply("Something went wrong saving your bio. Please try again.");
                return;
            }

            ctx.session.onboardingStep = undefined; // Clear onboarding step
            
            // Generate a warm, personalized summary
            const summary = `<b>Here's what I know about you:</b>\n\n✨ ${updatedUser.name || updatedUser.firstName}, ${updatedUser.age || 'age not specified'}\n🌟 ${(updatedUser.gender || 'gender not specified').toLowerCase()}\n💫 ${updatedUser.occupation || 'occupation not specified'}\n\n<i>${generatePersonalizedBioSummary(updatedUser.bio || '')}</i>`;
            
            await ctx.reply(summary, { parse_mode: 'HTML' });
            await showMainMenu(ctx, updatedUser); // Use local copy for now
            break;
        }
         default: {
            // Should not happen, but clear session just in case
            logger.warn(`User ${ctx.from.id} in unexpected onboarding step: ${step}`);
            ctx.session.onboardingStep = undefined;
            await showMainMenu(ctx, user); // Use local copy for now
        }
    }
}

/**
 * Initiates the onboarding process for a new user.
 */
export async function startOnboarding(ctx: JournalBotContext) {
    if (!ctx.from) return; // Should have ctx.from if called from /start
    
    ctx.session.onboardingStep = 'name';
    
    // Suggest user's first name as default
    const nameKeyboard = new Keyboard()
        .text(ctx.from.first_name)
        .resized();

    await ctx.reply("Hi! I'm Infinity, your friend and AI journal 💁‍♀️\n\nTell me how to call you.", {
        reply_markup: nameKeyboard,
        parse_mode: 'HTML'
    });
}
