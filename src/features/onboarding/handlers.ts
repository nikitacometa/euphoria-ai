import { Bot, Context, Keyboard } from 'grammy';
import { JournalBotContext } from '../../types/session';
import { IUser } from '../../types/models';
import { updateUserProfile } from '../../database'; // Assuming updateUserProfile is exported from database index
import { ageKeyboard, genderKeyboard } from './keyboards';
import { isValidAgeRange, isValidGender } from './utils';
import { transcribeAudio, promptText } from '../../services/ai/openai.service'; // Import AI services
import { showMainMenu } from '../core/handlers';
import { logger } from '../../utils/logger';
import { TELEGRAM_API_TOKEN } from '../../config';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';


// Helper function to extract interesting facts from user bio
function extractInterestingFacts(bio: string): string[] {
    // Check if bio is too short to extract meaningful facts
    if (!bio || bio.length < 20) {
        return ["You're quite mysterious! I like that about you."];
    }

    const facts: string[] = [];
    
    // Look for hobbies
    if (bio.match(/hobby|hobbies|enjoy|love|passion|like/i)) {
        const hobbyMatch = bio.match(/(?:hobby|hobbies|enjoy|love|passion|like)s?\s+(?:to\s+)?([^,.!?]+)/i);
        if (hobbyMatch && hobbyMatch[1]) {
            facts.push(`You seem to enjoy ${hobbyMatch[1].trim()}`);
        }
    }
    
    // Look for profession or work
    if (bio.match(/work|job|profession|career|study|student|studying/i)) {
        const workMatch = bio.match(/(?:work|job|profession|career)(?:ing|ed)?\s+(?:as|at|in|with)?\s+([^,.!?]+)/i) || 
                          bio.match(/(?:study|student|studying)\s+([^,.!?]+)/i);
        if (workMatch && workMatch[1]) {
            facts.push(`Your path in life involves ${workMatch[1].trim()}`);
        }
    }
    
    // Look for relationships
    if (bio.match(/married|wife|husband|partner|relationship|dating|boyfriend|girlfriend/i)) {
        facts.push("Relationships seem to be meaningful in your life");
    }
    
    // Look for travel
    if (bio.match(/travel|trip|journey|explore|adventure|country|countries|city|cities/i)) {
        facts.push("You have a wanderlust spirit");
    }
    
    // Look for creative expressions
    if (bio.match(/write|author|book|novel|music|play|sing|art|paint|draw|create|creative/i)) {
        facts.push("You have a creative soul");
    }
    
    // Look for analytical mind
    if (bio.match(/think|analyze|solve|problem|science|math|logic|data|research/i)) {
        facts.push("You have an analytical mind");
    }
    
    // If we couldn't extract specific facts, add some general observations
    if (facts.length === 0) {
        const bioLength = bio.length;
        if (bioLength > 200) {
            facts.push("You're quite thorough in sharing about yourself");
        }
        
        const sentenceCount = bio.split(/[.!?]+/).filter(Boolean).length;
        if (sentenceCount >= 5) {
            facts.push("You're expressive and detailed in your communication");
        }
        
        const questionCount = (bio.match(/\?/g) || []).length;
        if (questionCount > 1) {
            facts.push("You're inquisitive and thoughtful");
        }
        
        // Emotional tone indicators
        const positiveWords = (bio.match(/happy|joy|love|excited|passion|great|amazing|wonderful/gi) || []).length;
        const negativeWords = (bio.match(/sad|angry|upset|frustrat|disappoint|worry|anxious|stress/gi) || []).length;
        
        if (positiveWords > negativeWords && positiveWords > 2) {
            facts.push("You radiate positive energy");
        } else if (negativeWords > positiveWords && negativeWords > 2) {
            facts.push("You're in touch with life's complexities");
        }
        
        // Add a fallback if still no facts
        if (facts.length === 0) {
            facts.push("You've shared something unique about yourself");
        }
    }
    
    // Only return up to 3 facts to keep it concise
    return facts.slice(0, 3);
}

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

// Generate a personalized welcome guide message
function generateWelcomeGuide(name: string): string {
    return `
<b>Welcome to Infinity, ${name} 😘</b>

🎤 <i>Voice messages should be 5 minutes maximum. Long voices are cringe, you know...</i> 

• <b>Notifications</b> - Turn on daily journaling reminders
• <b>Reminder Time</b> - Set when you want to be reminded
• <b>Transcriptions</b> - Show/hide text from your voice messages
• <b>Language</b> - Switch between English and Russian

/settings - Customize your settings
/help - See all available commands
`;
}

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
            await ctx.reply(`<b>${text}</b>, what a lovely name 😘\n\nYour age range?`, {
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
            await ctx.reply("<b>Good, good 😏</b>\n\nHow do you identify yourself?", {
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
            await ctx.reply("<b>Got it!</b>\n\nWhat is your main occupation or main focus in life?", {
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
            await ctx.reply("<b>Almost done</b> 🎉\n\nPlease, tell me more about yourself! The more you share, the better I will understand you!\n\n<b>Possible questions:</b>\n• <i>What are your hobbies or interests?</i>\n• <i>What energizes or inspires you?</i>\n• <i>Important relationships in your life?</i>\n• <i>What are you passionate about?</i>\n• <i>Any life philosophy or values?</i>\n• <i>What makes you unique?</i>\n\n🎤 <i>Feel free to send a voice/video message.</i>", {
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
            
            // Create a storytelling from the bio
            const story = await createStorytelling(bioText);
            
            // Generate a warm, personalized summary with the storytelling
            const summary = `<b>🌟 Perfect! Here's what I've learned about you:</b>\n\n<b>Name:</b> ${updatedUser.name || updatedUser.firstName}\n<b>Age:</b> ${updatedUser.age || 'not specified'}\n<b>Gender:</b> ${updatedUser.gender || 'not specified'}\n<b>Occupation:</b> ${updatedUser.occupation || 'not specified'}\n\n<b>Your Story:</b>\n${story}`;
            
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
    if (!ctx.from) return; // Should have ctx.from if called from /start
    
    ctx.session.onboardingStep = 'name';
    
    // Suggest user's first name as default
    const nameKeyboard = new Keyboard()
        .text(ctx.from.first_name)
        .resized();

    await ctx.reply("<b>Welcome to Infinity</b> ✨\n\nI'm your AI friend and for high-level journaling and much more 😏\n\nHow should I call you, dear?", {
        reply_markup: nameKeyboard,
        parse_mode: 'HTML'
    });
}
