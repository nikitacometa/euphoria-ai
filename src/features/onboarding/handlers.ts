import { Bot, Context, Keyboard } from 'grammy';
import { JournalBotContext } from '../../types/session';
import { IUser } from '../../types/models';
import { updateUserProfile } from '../../database'; // Assuming updateUserProfile is exported from database index
import { ageKeyboard, genderKeyboard, timezoneKeyboard } from './keyboards';
import { isValidAgeRange, isValidGender, isValidTimezone, convertToIANATimezone } from './utils';
import { transcribeAudio, promptText } from '../../services/ai/openai.service'; // Import AI services
import { showMainMenu } from '../core/handlers';
import { logger } from '../../utils/logger';
import { TELEGRAM_API_TOKEN } from '../../config';
import { HOWTO_GUIDE } from '../../commands/howto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Helper function to create a short story with jokes from the user's bio
async function createStorytelling(bio: string): Promise<string> {
    if (!bio || bio.length < 20) {
        return "Once upon a time, there was a mysteriously enigmatic person who believed bios were optional. Bold strategy. Let's see if it pays off! 🧙‍♂️";
    }
    
    try {
        // Create the prompt for the storytelling
        const prompt = `format the bio into a list of facts ${bio}`;
        
        // Call the OpenAI service
        const story = await promptText(prompt);
        return story;
    } catch (error) {
        // Log the error but provide a fallback response
        logger.error('Error generating story from bio:', error);
        
        // Fallback: create a simple story with elements from the bio
        let fallbackStory = "The tale of this fascinating human could fill volumes, but the AI storyteller seems to be on coffee break right now. ";
        
        // Extract simple patterns for the fallback
        if (bio.match(/hobby|hobbies|enjoy|love|passion|like/i)) {
            fallbackStory += "They have passions that mere mortals can only dream of. ";
        }
        
        if (bio.match(/work|job|profession|career/i)) {
            fallbackStory += "Their career path would make LinkedIn executives weep with joy. ";
        }
        
        fallbackStory += "Legend says they're so interesting, ChatGPT once asked THEM for advice.";
        
        return fallbackStory;
    }
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
            await ctx.reply(`Wow, <b>${text}</b>! What a lovely name 😘\n\n<i>How old are you?</i>`, {
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
            await ctx.reply("<b>Good, good 😏</b>\n\n<i>How do you identify yourself?</i>", {
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
            ctx.session.onboardingStep = 'timezone';
            await ctx.reply("<b>Sweet 😏</b>\n\n<i>Your current timezone?</i>", {
                reply_markup: timezoneKeyboard, // Use imported keyboard
                parse_mode: 'HTML'
            });
            break;
        }
        case 'timezone': {
            if (!text || !isValidTimezone(text)) { // Expecting text from keyboard
                await ctx.reply("Please select your timezone from the options provided 🌍");
                return;
            }
            const ianaTimezone = convertToIANATimezone(text);
            await updateUserProfile(ctx.from.id, { timezone: ianaTimezone });
            ctx.session.onboardingStep = 'occupation';
            await ctx.reply("<b>Great!</b>\n\n<i>What is your job, profession? Or more broadly — who are you exactly?</i>", {
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
            await ctx.reply("<b>You are interesting, you know</b> 😏\n\nPlease, tell me more! Any details, stories which describe you.\n\n<i>The more you share, the better I understand you!</i>\n\n<b>Possible topics:</b>\n• <i>Hobbies or interests?</i>\n• <i>Where you live, travel?</i>\n• <i>Important relationships in your life?</i>\n• <i>Have dreams, goals?</i>\n• <i>Philosophy or values?</i>\n• <i>What makes you unique?</i>\n\n🎤 <b>You can send a voice/video message (max 5 min).</b>", {
                
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
                    // Process media with the same pattern as journal-entry handler
                    const mediaType = voiceFileId ? 'voice' : 'video';
                    bioText = await processMediaForBio(ctx, mediaFileId, mediaType);
                    
                    // Replace eyes reaction with thumbs up - don't try to delete the old one
                    await ctx.react("👍").catch(e => logger.warn("Failed to add thumbs up reaction", e));
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
            
            // Create a storytelling from the bio
            const story = await createStorytelling(bioText);
            
            // Generate a warm, personalized summary with the storytelling
            const summary = `<b>☺️ Nice to meet you:</b>\n\n<b>Name:</b> ${updatedUser.name || updatedUser.firstName}\n<b>Age:</b> ${updatedUser.age || 'not specified'}\n<b>Gender:</b> ${updatedUser.gender || 'not specified'}\n<b>Timezone:</b> ${text || updatedUser.timezone || 'UTC'}\n<b>Occupation:</b> ${updatedUser.occupation || 'not specified'}\n\n<b>Some facts:</b>\n${story}`;
            
            await ctx.reply(summary, { parse_mode: 'HTML' });
            
            // Send welcome guide message
            const welcomeGuide = generateWelcomeGuide(updatedUser.name || updatedUser.firstName);
            await ctx.reply(welcomeGuide, { parse_mode: 'HTML' });
            
            // Show main menu after onboarding completion
            await showMainMenu(ctx, updatedUser);
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
    if (!ctx.from) return;
    
    ctx.session.onboardingStep = 'name';
    
    const nameKeyboard = new Keyboard()
        .text(ctx.from.first_name)
        .resized();

    await ctx.reply(HOWTO_GUIDE, {
        reply_markup: nameKeyboard,
        parse_mode: 'HTML'
    });
}

/**
 * Helper to process media files for bio input
 */
async function processMediaForBio(
    ctx: JournalBotContext, 
    fileId: string, 
    mediaType: 'voice' | 'video'
): Promise<string> {
    const file = await ctx.api.getFile(fileId);
    const filePath = file.file_path;
    
    if (!filePath) {
        throw new Error(`File path not found for ${mediaType}`);
    }
    
    const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_API_TOKEN}/${filePath}`;
    const tempDir = path.join(os.tmpdir(), 'journal-bot-onboarding');
    
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const extension = filePath.split('.').pop() || (mediaType === 'voice' ? 'oga' : 'mp4');
    const localFilePath = path.join(tempDir, `bio_${Date.now()}.${extension}`);
    
    // Download the file
    const response = await fetch(fileUrl);
    if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
    }
    
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(localFilePath, Buffer.from(buffer));
    
    try {
        // Transcribe the audio
        const transcription = await transcribeAudio(localFilePath);
        return transcription;
    } finally {
        // Clean up, regardless of success/failure in transcription
        fs.unlinkSync(localFilePath);
    }
}

function generateWelcomeGuide(name: string): string {
    return `Ah, I'm so exiceted to have you here, ${name}! ☺️\n\nBuild next-level connection with your journal. Just ask /howto to remind you how what are the good usecases!\n\n<i>I want to make your life better. Please, dear, use me hard 😏</i>`;
}
