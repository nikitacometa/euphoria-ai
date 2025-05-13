# Localization Design: Russian Language Support

## Implementation Approach

We'll implement full Russian language support using the i18next library, which provides a robust framework for internationalization in JavaScript/TypeScript applications.

## Structure

```
src/
  locales/
    en/
      common.json
      onboarding.json
      journal.json
      settings.json
      errors.json
    ru/
      common.json
      onboarding.json
      journal.json
      settings.json
      errors.json
  config/
    i18n.ts     # Initialization and configuration
  utils/
    localization.ts   # Helper functions
```

## Core Implementation

### i18n Configuration (src/config/i18n.ts)

```typescript
import i18next from 'i18next';
import Backend from 'i18next-fs-backend';
import path from 'path';

// Initialize i18next
async function initializeI18n() {
  await i18next
    .use(Backend)
    .init({
      backend: {
        loadPath: path.join(__dirname, '../locales/{{lng}}/{{ns}}.json'),
      },
      fallbackLng: 'en',
      preload: ['en', 'ru'],
      ns: ['common', 'onboarding', 'journal', 'settings', 'errors'],
      defaultNS: 'common',
      debug: process.env.NODE_ENV !== 'production',
    });
    
  return i18next;
}

export let i18n: typeof i18next;

export async function setupLocalization() {
  i18n = await initializeI18n();
  console.log('Localization initialized with languages:', i18n.languages);
}
```

### Localization Utility (src/utils/localization.ts)

```typescript
import { i18n } from '../config/i18n';
import { IUser } from '../types/models';

/**
 * Translate a key based on user's language preference
 * @param key The translation key
 * @param params Optional parameters for interpolation
 * @param user User object to determine language preference
 */
export function t(key: string, params: Record<string, any> = {}, user?: IUser): string {
  const lang = user?.aiLanguage || 'en';
  
  try {
    // Split namespace and key (e.g., "common:welcome" -> "common", "welcome")
    const [ns, actualKey] = key.includes(':') ? key.split(':') : ['common', key];
    
    return i18n.t(actualKey, {
      ns,
      lng: lang,
      ...params
    });
  } catch (error) {
    console.error(`Translation error for key "${key}":`, error);
    return key.includes(':') ? key.split(':')[1] : key;
  }
}

/**
 * Get current language for a user
 * @param user User object
 * @returns Language code ('en' or 'ru')
 */
export function getUserLanguage(user?: IUser): string {
  return user?.aiLanguage || 'en';
}

/**
 * Format a date according to user's language preference
 * @param date Date to format
 * @param user User object to determine language
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
  
  return date.toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', options);
}
```

## Key Translation Files

### Common Translations (sample)

**English (en/common.json)**:
```json
{
  "welcome": "Welcome!",
  "yes": "Yes",
  "no": "No",
  "save": "Save",
  "cancel": "Cancel",
  "back": "Back",
  "next": "Next",
  "continue": "Continue",
  "text": "text",
  "voiceMessage": "Voice message",
  "videoMessage": "Video message",
  "fileMessage": "File",
  "seconds": "s",
  "minutes": "m",
  "loading": "Loading...",
  "error": "Error"
}
```

**Russian (ru/common.json)**:
```json
{
  "welcome": "Добро пожаловать!",
  "yes": "Да",
  "no": "Нет",
  "save": "Сохранить",
  "cancel": "Отмена",
  "back": "Назад",
  "next": "Далее",
  "continue": "Продолжить",
  "text": "текст",
  "voiceMessage": "Голосовое сообщение",
  "videoMessage": "Видео сообщение",
  "fileMessage": "Файл",
  "seconds": "сек",
  "minutes": "мин",
  "loading": "Загрузка...",
  "error": "Ошибка"
}
```

### Journal Entry Translations (sample)

**English (en/journal.json)**:
```json
{
  "newEntry": "New Entry",
  "currentEntry": "Current Entry:",
  "whatElseAdd": "What else would you like to add? You can also press:",
  "saveAnalyze": "to save and analyze your entry",
  "analyzeOnly": "to just analyze without saving",
  "cancelEntry": "to cancel this entry",
  "analyzing": "Analyzing your entry...",
  "entrySaved": "Your entry has been saved!",
  "insights": "Insights",
  "questions": "Questions to reflect on",
  "emptyEntry": "Your entry is empty. Please share your thoughts using text, voice, or video.",
  "transcribing": "Transcribing your message..."
}
```

**Russian (ru/journal.json)**:
```json
{
  "newEntry": "Новая запись",
  "currentEntry": "Текущая запись:",
  "whatElseAdd": "Что ещё хотите добавить? Вы также можете нажать:",
  "saveAnalyze": "чтобы сохранить и проанализировать запись",
  "analyzeOnly": "чтобы только проанализировать без сохранения",
  "cancelEntry": "чтобы отменить эту запись",
  "analyzing": "Анализирую вашу запись...",
  "entrySaved": "Ваша запись сохранена!",
  "insights": "Мысли",
  "questions": "Вопросы для размышления",
  "emptyEntry": "Ваша запись пуста. Пожалуйста, поделитесь своими мыслями используя текст, голос или видео.",
  "transcribing": "Расшифровываю ваше сообщение..."
}
```

## Integration Example

Here's an example of how the localization will be integrated into the application code:

```typescript
// Before:
await ctx.reply("Welcome! How are you today?", options);

// After:
await ctx.reply(t('onboarding:welcome', {}, user), options);

// Before:
const messageText = `<b>Hey ${userName}!</b> 😏\n\nHow is your day? Share any thoughts, your mood, what you done today?`;

// After:
const messageText = `<b>${t('journal:greeting', { name: userName }, user)}</b> 😏\n\n${t('journal:howIsYourDay', {}, user)}`;
```

## Testing Strategy

1. **Unit Tests**:
   - Test that all translation files are valid JSON
   - Test that all keys in English exist in Russian
   - Test the t() function with various inputs

2. **Integration Test**:
   - Test loading both languages
   - Test switching between languages
   - Test handling missing keys

3. **Manual Testing**:
   - Test with actual Russian users
   - Verify natural-sounding phrases
   - Check for cultural appropriateness

## Natural Phrasing

When translating to Russian, we'll focus on:

1. Natural expression rather than literal translation
2. Appropriate level of formality for a personal journal
3. Cultural considerations for Russian speakers
4. Maintaining the friendly, supportive tone of the bot

## Stylistic Guidelines for Russian

1. Use the informal "ты" (you) form rather than formal "вы" for a more personal feel
2. Employ Russian idioms where appropriate
3. When translating UI elements, prioritize clarity over brevity
4. For emotional expressions, use Russian equivalents rather than direct translations 