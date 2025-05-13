import { i18nInstance } from '../config/i18n';
import { IUser } from '../types/models';
import { logger } from './logger'; // For logging translation errors

/**
 * Translates a key based on user's language preference or a specified language.
 * @param key The translation key (e.g., "common:welcome" or just "welcome" for defaultNS).
 * @param options Optional parameters for interpolation or overriding language.
 *                `options.lng` can be used to specify a language.
 *                `options.user` can be an IUser object to derive language.
 *                Other properties in `options` are used for interpolation.
 * @returns The translated string, or the key itself if translation is not found.
 */
export function t(key: string, options?: { lng?: string; user?: IUser; [key: string]: any }): string {
    if (!i18nInstance) {
        logger.error('i18next instance not initialized yet. Call setupLocalization() first.');
        // Fallback to a simple key display if i18n is not ready
        const fallbackKey = key.includes(':') ? key.split(':')[1] : key;
        let processedFallback = fallbackKey;
        if (options) {
            Object.keys(options).forEach(optKey => {
                if (optKey !== 'lng' && optKey !== 'user') {
                    processedFallback = processedFallback.replace(new RegExp(`{{${optKey}}}`, 'g'), options[optKey]);
                }
            });
        }
        return processedFallback;
    }

    const langToUse = options?.lng || options?.user?.aiLanguage || i18nInstance.language;
    
    // Split namespace and key (e.g., "common:welcome" -> ns="common", actualKey="welcome")
    // If no namespace in key, it uses defaultNS from i18next config ('common')
    const [nsOrKey, actualKeyIfNs] = key.includes(':') ? key.split(':') : [i18nInstance.options.defaultNS as string, key];
    const ns = actualKeyIfNs ? nsOrKey : i18nInstance.options.defaultNS as string;
    const actualKey = actualKeyIfNs || nsOrKey;

    try {
        return i18nInstance.t(actualKey, {
            ns,
            lng: langToUse,
            ...(options || {}),
        });
    } catch (error) {
        logger.error(`Translation error for key "${key}" with lang "${langToUse}":`, error);
        // Fallback to key with basic interpolation for robustness
        let processedKey = actualKey;
        if (options) {
            Object.keys(options).forEach(optKey => {
                if (optKey !== 'lng' && optKey !== 'user') {
                    processedKey = processedKey.replace(new RegExp(`{{${optKey}}}`, 'g'), options[optKey]);
                }
            });
        }
        return processedKey;
    }
}

/**
 * Gets current language for a user.
 * @param user User object.
 * @returns Language code ('en' or 'ru'). Defaults to 'en'.
 */
export function getUserLanguage(user?: IUser): string {
    return user?.aiLanguage || i18nInstance?.language || 'en';
}

/**
 * Formats a date according to user's language preference.
 * @param date Date to format.
 * @param user Optional user object to determine language.
 * @returns Formatted date string.
 */
export function formatDate(date: Date, user?: IUser): string {
    const lang = getUserLanguage(user);
    const options: Intl.DateTimeFormatOptions = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    
    // Fallback for locale string if specific one fails, though i18next handles language fallback
    let localeString = 'en-US';
    if (lang === 'ru') localeString = 'ru-RU';
    // Add more mappings if other languages are supported in future

    try {
        return date.toLocaleDateString(localeString, options);
    } catch (error) {
        logger.error(`Error formatting date for locale ${localeString}:`, error);
        return date.toLocaleDateString('en-US', options); // Fallback to en-US
    }
} 