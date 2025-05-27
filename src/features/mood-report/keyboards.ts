import { InlineKeyboard } from 'grammy';
import { IUser } from '../../types/models';
import { t } from '../../utils/localization';

// Callback data constants
export const MOOD_CALLBACKS = {
    MOOD_1: 'mood_rate_1',
    MOOD_2: 'mood_rate_2',
    MOOD_3: 'mood_rate_3',
    MOOD_4: 'mood_rate_4',
    MOOD_5: 'mood_rate_5',
    SUCCESS_VERY: 'success_very',
    SUCCESS_MOSTLY: 'success_mostly',
    SUCCESS_SOMEWHAT: 'success_somewhat',
    SUCCESS_NOT_REALLY: 'success_not_really',
    SUCCESS_FAILED: 'success_failed',
    SLEEP_LESS_4: 'sleep_less_4',
    SLEEP_4_6: 'sleep_4_6',
    SLEEP_6_8: 'sleep_6_8',
    SLEEP_8_10: 'sleep_8_10',
    SLEEP_MORE_10: 'sleep_more_10',
    SKIP_DETAILS: 'mood_skip_details',
    SAVE_MOOD: 'mood_save',
    REFLECT_MORE: 'mood_reflect_more',
    CANCEL_MOOD: 'mood_cancel'
};

/**
 * Creates mood rating keyboard (1-5 scale with emojis)
 */
export function createMoodRatingKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
        .text('😔 1', MOOD_CALLBACKS.MOOD_1)
        .text('😕 2', MOOD_CALLBACKS.MOOD_2)
        .text('😐 3', MOOD_CALLBACKS.MOOD_3)
        .text('🙂 4', MOOD_CALLBACKS.MOOD_4)
        .text('😄 5', MOOD_CALLBACKS.MOOD_5)
        .row()
        .text('❌ Cancel', MOOD_CALLBACKS.CANCEL_MOOD);
}

/**
 * Creates day success keyboard
 */
export function createDaySuccessKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
        .text('🌟 Crushed it!', MOOD_CALLBACKS.SUCCESS_VERY)
        .text('✅ Mostly yes', MOOD_CALLBACKS.SUCCESS_MOSTLY)
        .row()
        .text('🤷 Somewhat', MOOD_CALLBACKS.SUCCESS_SOMEWHAT)
        .text('😕 Not really', MOOD_CALLBACKS.SUCCESS_NOT_REALLY)
        .row()
        .text('❌ Failed today', MOOD_CALLBACKS.SUCCESS_FAILED)
        .row()
        .text('❌ Cancel', MOOD_CALLBACKS.CANCEL_MOOD);
}

/**
 * Creates sleep hours keyboard
 */
export function createSleepHoursKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
        .text('😴 < 4 hours', MOOD_CALLBACKS.SLEEP_LESS_4)
        .text('😪 4-6 hours', MOOD_CALLBACKS.SLEEP_4_6)
        .row()
        .text('🙂 6-8 hours', MOOD_CALLBACKS.SLEEP_6_8)
        .text('😊 8-10 hours', MOOD_CALLBACKS.SLEEP_8_10)
        .row()
        .text('😁 > 10 hours', MOOD_CALLBACKS.SLEEP_MORE_10)
        .row()
        .text('❌ Cancel', MOOD_CALLBACKS.CANCEL_MOOD);
}

/**
 * Creates details input keyboard
 */
export function createDetailsKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
        .text('⏭️ Skip details', MOOD_CALLBACKS.SKIP_DETAILS)
        .text('❌ Cancel', MOOD_CALLBACKS.CANCEL_MOOD);
}

/**
 * Creates summary action keyboard
 */
export function createSummaryKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
        .text('💾 Save Entry', MOOD_CALLBACKS.SAVE_MOOD)
        .text('✍️ Reflect More', MOOD_CALLBACKS.REFLECT_MORE)
        .row()
        .text('❌ Cancel', MOOD_CALLBACKS.CANCEL_MOOD);
} 