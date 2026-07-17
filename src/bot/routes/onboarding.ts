import { Bot, Keyboard } from 'grammy';
import { IUser, updateUserLanguage, updateUserProfile } from '../../database';
import { Language, getTextForUser } from '../../utils/localization';
import { withCommandLogging } from '../../utils/command-logger';
import { createLogger } from '../../utils/logger';
import { LOG_LEVEL } from '../../config';
import { parseBioInformation } from '../../ai/journal-ai';
import { getVideoFileId, transcribeVideoMessage, transcribeVoiceMessage } from '../../services/telegram-media';
import { JournalBotContext, OnboardingStep } from '../context';
import { buildLanguageKeyboard, LANGUAGE_PROMPT, sendTranscriptionReply, showMainMenu, withWaitMessage } from '../helpers';

const onboardingLogger = createLogger('Onboarding', LOG_LEVEL);

export function registerOnboardingRoutes(bot: Bot<JournalBotContext>): void {
    bot.command('start', withCommandLogging('start', handleStartCommand));
}

async function handleStartCommand(ctx: JournalBotContext): Promise<void> {
    if (ctx.user.onboardingCompleted) {
        ctx.session.mode = { kind: 'idle' };
        await showMainMenu(ctx, ctx.user);
        return;
    }

    ctx.session.mode = { kind: 'onboarding', step: 'language' };
    await ctx.reply(LANGUAGE_PROMPT, { reply_markup: buildLanguageKeyboard() });
}

/**
 * Puts a user whose session was lost back into onboarding at the first
 * question they have not answered yet, using their stored profile rather
 * than restarting the wizard from scratch.
 */
export async function resumeOnboarding(ctx: JournalBotContext): Promise<void> {
    const step = nextOnboardingStep(ctx.user);
    if (!step) {
        // Every field is filled but the flag never got set: finish the job.
        const user = (await updateUserProfile(ctx.from!.id, { onboardingCompleted: true })) || ctx.user;
        ctx.session.mode = { kind: 'idle' };
        await showMainMenu(ctx, user);
        return;
    }

    ctx.session.mode = { kind: 'onboarding', step };
    await sendStepPrompt(ctx, step, ctx.user);
}

/** First onboarding question the stored profile has no answer for. */
function nextOnboardingStep(user: IUser): OnboardingStep | null {
    if (!user.name) return 'name';
    if (!user.age) return 'age';
    if (!user.gender) return 'gender';
    if (!user.occupation) return 'occupation';
    if (!user.bio) return 'bio';
    return null;
}

/** Asks the question for a given onboarding step. */
async function sendStepPrompt(ctx: JournalBotContext, step: OnboardingStep, user: IUser): Promise<void> {
    switch (step) {
        case 'language':
            await ctx.reply(LANGUAGE_PROMPT, { reply_markup: buildLanguageKeyboard() });
            return;

        case 'name':
            await ctx.reply(getTextForUser('welcome', user), {
                reply_markup: new Keyboard().text(ctx.from!.first_name).resized(),
                parse_mode: 'HTML'
            });
            return;

        case 'age':
            await ctx.reply(getTextForUser('niceMeet', user, { name: user.name || user.firstName }), {
                reply_markup: new Keyboard()
                    .text('0-18')
                    .text('18-24')
                    .row()
                    .text('25-34')
                    .text('35-44')
                    .row()
                    .text('45-60')
                    .text('60+')
                    .resized(),
                parse_mode: 'HTML'
            });
            return;

        case 'gender':
            await ctx.reply(getTextForUser('thanks', user), {
                reply_markup: new Keyboard().text('Male').text('Female').row().text('Non-binary').text('Other').resized(),
                parse_mode: 'HTML'
            });
            return;

        case 'occupation':
            await ctx.reply(getTextForUser('gotIt', user), {
                reply_markup: { remove_keyboard: true },
                parse_mode: 'HTML'
            });
            return;

        case 'bio':
            await ctx.reply(getTextForUser('almostDone', user), {
                reply_markup: { remove_keyboard: true },
                parse_mode: 'HTML'
            });
            return;
    }
}

/** Handles onboarding replies; the message router calls this while mode is 'onboarding'. */
export async function handleOnboardingMessage(ctx: JournalBotContext): Promise<void> {
    if (!ctx.message || !ctx.from || ctx.session.mode.kind !== 'onboarding') {
        return;
    }
    const step = ctx.session.mode.step;

    if (ctx.message.text !== undefined) {
        await handleTextStep(ctx, step, ctx.message.text);
        return;
    }

    if (step === 'bio') {
        if (ctx.message.voice) {
            await handleMediaBio(ctx, () => transcribeVoiceMessage(ctx, ctx.message!.voice!.file_id), 'errorProcessingVoice');
            return;
        }
        const videoFileId = getVideoFileId(ctx.message);
        if (videoFileId) {
            await handleMediaBio(ctx, () => transcribeVideoMessage(ctx, videoFileId), 'errorProcessingVideo');
            return;
        }
    }

    await ctx.reply('Please send a text message, voice message, or video to continue with the setup.');
}

/** Saves the answer for the current step, then asks the next question. */
async function handleTextStep(ctx: JournalBotContext, step: OnboardingStep, text: string): Promise<void> {
    switch (step) {
        case 'language': {
            const language = text === 'Русский 🇷🇺' ? Language.RUSSIAN : Language.ENGLISH;
            const user = (await updateUserLanguage(ctx.from!.id, language)) || ctx.user;
            await advanceTo(ctx, 'name', user);
            return;
        }

        case 'name': {
            const user = (await updateUserProfile(ctx.from!.id, { name: text })) || ctx.user;
            await advanceTo(ctx, 'age', user);
            return;
        }

        case 'age': {
            const age = parseAgeAnswer(text);
            if (age === null) {
                await ctx.reply('Please select one of the age ranges or enter a valid age (a number between 1 and 120):');
                return;
            }
            const user = (await updateUserProfile(ctx.from!.id, { age })) || ctx.user;
            await advanceTo(ctx, 'gender', user);
            return;
        }

        case 'gender': {
            const user = (await updateUserProfile(ctx.from!.id, { gender: text })) || ctx.user;
            await advanceTo(ctx, 'occupation', user);
            return;
        }

        case 'occupation': {
            const user = (await updateUserProfile(ctx.from!.id, { occupation: text })) || ctx.user;
            await advanceTo(ctx, 'bio', user);
            return;
        }

        case 'bio': {
            const user = (await updateUserProfile(ctx.from!.id, { bio: text, onboardingCompleted: true })) || ctx.user;
            ctx.session.mode = { kind: 'idle' };

            await ctx.reply(getTextForUser('amazing', user), { parse_mode: 'HTML' });
            await showMainMenu(ctx, user);
            return;
        }
    }
}

/** Moves the wizard to a step and asks its question with the freshest profile. */
async function advanceTo(ctx: JournalBotContext, step: OnboardingStep, user: IUser): Promise<void> {
    ctx.session.mode = { kind: 'onboarding', step };
    await sendStepPrompt(ctx, step, user);
}

function parseAgeAnswer(text: string): number | null {
    const ageRanges: Record<string, number> = {
        '0-18': 15,
        '18-24': 21,
        '25-34': 30,
        '35-44': 40,
        '45-60': 50,
        '60+': 65
    };
    if (ageRanges[text] !== undefined) {
        return ageRanges[text];
    }

    const age = parseInt(text, 10);
    if (isNaN(age) || age < 1 || age > 120) {
        return null;
    }
    return age;
}

async function handleMediaBio(
    ctx: JournalBotContext,
    transcribe: () => Promise<string>,
    errorTextKey: 'errorProcessingVoice' | 'errorProcessingVideo'
): Promise<void> {
    try {
        await ctx.react('👍');
        const transcription = await withWaitMessage(ctx, transcribe);
        await sendTranscriptionReply(ctx, ctx.message!.message_id, transcription, ctx.user);

        const { parsedBio, structuredInfo } = await parseBioInformation(transcription);
        const updatedUser =
            (await updateUserProfile(ctx.from!.id, {
                bio: transcription,
                parsedBio,
                onboardingCompleted: true
            })) || ctx.user;
        ctx.session.mode = { kind: 'idle' };

        const bioSummary = formatStructuredBio(structuredInfo);
        if (bioSummary) {
            await ctx.reply(bioSummary);
        }

        await ctx.reply(getTextForUser('welcomeAboard', updatedUser), { parse_mode: 'HTML' });
        await showMainMenu(ctx, updatedUser);
    } catch (error) {
        onboardingLogger.error('Error processing media bio:', error);
        await ctx.reply(getTextForUser(errorTextKey, ctx.user));
    }
}

/** Renders the structured bio extraction as a readable bullet list. */
function formatStructuredBio(info: Record<string, unknown>): string {
    const lines = Object.entries(info)
        .filter(([, value]) => value !== null && value !== undefined && value !== '')
        .map(([key, value]) => `• ${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
    return lines.join('\n');
}
