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
    
    // Define patterns with their associated facts in a declarative structure
    const patterns = [
        {
            regex: /hobby|hobbies|enjoy|love|passion|like/i,
            extractFact: () => {
                const hobbyMatch = bio.match(/(?:hobby|hobbies|enjoy|love|passion|like)s?\s+(?:to\s+)?([^,.!?]+)/i);
                return hobbyMatch && hobbyMatch[1] 
                    ? `You seem to enjoy ${hobbyMatch[1].trim()}`
                    : null;
            }
        },
        {
            regex: /work|job|profession|career|study|student|studying/i,
            extractFact: () => {
                const workMatch = bio.match(/(?:work|job|profession|career)(?:ing|ed)?\s+(?:as|at|in|with)?\s+([^,.!?]+)/i) || 
                                bio.match(/(?:study|student|studying)\s+([^,.!?]+)/i);
                return workMatch && workMatch[1]
                    ? `Your path in life involves ${workMatch[1].trim()}`
                    : null;
            }
        },
        { 
            regex: /married|wife|husband|partner|relationship|dating|boyfriend|girlfriend/i,
            fact: "Relationships seem to be meaningful in your life"
        },
        {
            regex: /travel|trip|journey|explore|adventure|country|countries|city|cities/i,
            fact: "You have a wanderlust spirit"
        },
        {
            regex: /write|author|book|novel|music|play|sing|art|paint|draw|create|creative/i,
            fact: "You have a creative soul"
        },
        {
            regex: /think|analyze|solve|problem|science|math|logic|data|research/i,
            fact: "You have an analytical mind"
        }
    ];
    
    // Process each pattern
    for (const pattern of patterns) {
        if (bio.match(pattern.regex)) {
            // If there's an extractFact function, use it; otherwise use the static fact
            if (pattern.extractFact) {
                const fact = pattern.extractFact();
                if (fact) facts.push(fact);
            } else if (pattern.fact) {
                facts.push(pattern.fact);
            }
        }
    }
    
    // If we couldn't extract specific facts, add some general observations
    if (facts.length === 0) {
        const bioLength = bio.length;
        const sentenceCount = bio.split(/[.!?]+/).filter(Boolean).length;
        const questionCount = (bio.match(/\?/g) || []).length;
        const positiveWords = (bio.match(/happy|joy|love|excited|passion|great|amazing|wonderful/gi) || []).length;
        const negativeWords = (bio.match(/sad|angry|upset|frustrat|disappoint|worry|anxious|stress/gi) || []).length;
        
        // Use an array of conditions and their associated facts for the fallback logic too
        const fallbackConditions = [
            { test: () => bioLength > 200, fact: "You're quite thorough in sharing about yourself" },
            { test: () => sentenceCount >= 5, fact: "You're expressive and detailed in your communication" },
            { test: () => questionCount > 1, fact: "You're inquisitive and thoughtful" },
            { test: () => positiveWords > negativeWords && positiveWords > 2, fact: "You radiate positive energy" },
            { test: () => negativeWords > positiveWords && negativeWords > 2, fact: "You're in touch with life's complexities" }
        ];
        
        // Add facts that match our fallback conditions
        for (const condition of fallbackConditions) {
            if (condition.test()) {
                facts.push(condition.fact);
            }
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
            ctx.session.onboardingStep = 'timezone';
            await ctx.reply("<b>Perfect!</b>\n\nNow, what's your current timezone? This helps me send notifications at the right time for you.", {
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
            await ctx.reply("<b>Great!</b>\n\nWhat is your main occupation or main focus in life?", {
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
            const summary = `<b>🌟 Perfect! Here's what I've learned about you:</b>\n\n<b>Name:</b> ${updatedUser.name || updatedUser.firstName}\n<b>Age:</b> ${updatedUser.age || 'not specified'}\n<b>Gender:</b> ${updatedUser.gender || 'not specified'}\n<b>Timezone:</b> ${text || updatedUser.timezone || 'UTC'}\n<b>Occupation:</b> ${updatedUser.occupation || 'not specified'}\n\n<b>Your Story:</b>\n${story}`;
            
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
