import i18next from 'i18next';
import Backend from 'i18next-fs-backend';
import path from 'path';
import { logger } from '../utils/logger'; // For logging initialization status

async function initializeI18n() {
  await i18next
    .use(Backend)
    .init({
      backend: {
        loadPath: path.join(__dirname, '../locales/{{lng}}/{{ns}}.json'), // Corrected path
      },
      fallbackLng: 'en',
      preload: ['en', 'ru'], // Preload both languages
      ns: ['common', 'onboarding', 'journal', 'settings', 'errors', 'aiPrompts'], // Define namespaces
      defaultNS: 'common',
      debug: process.env.NODE_ENV !== 'production',
      // Explicitly set interpolation options to avoid issues with curly braces in Telegram messages
      interpolation: {
        escapeValue: false, // Do not escape HTML, as Telegram supports HTML
        prefix: '{{',
        suffix: '}}'
      },
      // Add returnObjects to allow returning arrays/objects from translations if needed
      returnObjects: true,
    });
    
  return i18next;
}

// Export the i18next instance directly, to be initialized by the app
export let i18nInstance: typeof i18next | undefined;

export async function setupLocalization(): Promise<typeof i18next> {
  if (!i18nInstance) {
    i18nInstance = await initializeI18n();
    logger.info('Localization initialized with languages:', i18nInstance.languages);
  } else {
    logger.info('Localization already initialized.');
  }
  if (!i18nInstance) {
      throw new Error("i18next instance failed to initialize");
  }
  return i18nInstance;
}
