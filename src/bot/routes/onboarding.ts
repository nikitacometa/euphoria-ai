import { Bot, Keyboard } from 'grammy';
import { updateUserLanguage, updateUserProfile } from '../../database';
import { Language, getTextForUser } from '../../utils/localization';
import { withCommandLogging } from '../../utils/command-logger';
import { createLogger } from '../../utils/logger';
import { LOG_LEVEL } from '../../config';
import { parseBioInformation } from '../../ai/journal-ai';
import { getVideoFileId, transcribeVideoMessage, transcribeVoiceMessage } from '../../services/telegram-media';
import { JournalBotContext } from '../context';
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

async function handleTextStep(ctx: JournalBotContext, step: string, text: string): Promise<void> {
    switch (step) {
        case 'language': {
            const language = text === 'Русский 🇷🇺' ? Language.RUSSIAN : Language.ENGLISH;
            const user = (await updateUserLanguage(ctx.from!.id, language)) || ctx.user;

            ctx.session.mode = { kind: 'onboarding', step: 'name' };
            const nameKeyboard = new Keyboard().text(ctx.from!.first_name).resized();
            await ctx.reply(getTextForUser('welcome', user), {
                reply_markup: nameKeyboard,
                parse_mode: 'HTML'
            });
            break;
        }

        case 'name': {
            await updateUserProfile(ctx.from!.id, { name: text });
            ctx.session.mode = { kind: 'onboarding', step: 'age' };

            const ageKeyboard = new Keyboard()
                .text('0-18')
                .text('18-24')
                .row()
                .text('25-34')
                .text('35-44')
                .row()
                .text('45-60')
                .text('60+')
                .resized();

            await ctx.reply(getTextForUser('niceMeet', ctx.user, { name: text }), {
                reply_markup: ageKeyboard,
                parse_mode: 'HTML'
            });
            break;
        }

        case 'age': {
            const age = parseAgeAnswer(text);
            if (age === null) {
                await ctx.reply('Please select one of the age ranges or enter a valid age (a number between 1 and 120):');
                return;
            }

            await updateUserProfile(ctx.from!.id, { age });
            ctx.session.mode = { kind: 'onboarding', step: 'gender' };

            const genderKeyboard = new Keyboard()
                .text('Male')
                .text('Female')
                .row()
                .text('Non-binary')
                .text('Other')
                .resized();

            await ctx.reply(getTextForUser('thanks', ctx.user), {
                reply_markup: genderKeyboard,
                parse_mode: 'HTML'
            });
            break;
        }

        case 'gender': {
            await updateUserProfile(ctx.from!.id, { gender: text });
            ctx.session.mode = { kind: 'onboarding', step: 'occupation' };
            await ctx.reply(getTextForUser('gotIt', ctx.user), {
                reply_markup: { remove_keyboard: true },
                parse_mode: 'HTML'
            });
            break;
        }

        case 'occupation': {
            await updateUserProfile(ctx.from!.id, { occupation: text });
            ctx.session.mode = { kind: 'onboarding', step: 'bio' };
            await ctx.reply(getTextForUser('almostDone', ctx.user), {
                reply_markup: { remove_keyboard: true },
                parse_mode: 'HTML'
            });
            break;
        }

        case 'bio': {
            const updatedUser =
                (await updateUserProfile(ctx.from!.id, { bio: text, onboardingCompleted: true })) || ctx.user;
            ctx.session.mode = { kind: 'idle' };

            await ctx.reply(getTextForUser('amazing', updatedUser), { parse_mode: 'HTML' });
            await showMainMenu(ctx, updatedUser);
            break;
        }
    }
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
