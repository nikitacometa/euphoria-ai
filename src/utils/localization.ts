import { IUser } from '../database';
import * as fs from 'fs';
import * as path from 'path';
import {
  getAllLocalizationTexts,
  upsertLocalizationText,
  updateTranslation
} from '../database';
import { escapeHtml } from './html';

// Supported languages
export enum Language {
  ENGLISH = 'en',
  RUSSIAN = 'ru'
}

// Interface for text entries
export interface LocalizedText {
  [Language.ENGLISH]: string;
  [Language.RUSSIAN]: string;
}

// Type for text collections
export type TextCollection = {
  [key: string]: LocalizedText;
};

// Path to the localization files directory
const LOCALIZATION_DIR = path.join(process.cwd(), 'localization');

// Default texts as fallback
const defaultTexts: TextCollection = {
  // Onboarding
  languageSelection: {
    [Language.ENGLISH]: 'Please select your preferred language:',
    [Language.RUSSIAN]: 'Пожалуйста, выберите предпочитаемый язык:'
  },
  languageChanged: {
    [Language.ENGLISH]: 'Language has been changed to English.',
    [Language.RUSSIAN]: 'Язык изменен на русский.'
  },
  welcome: {
    [Language.ENGLISH]: '<b>Hey there, {firstName}!</b> 👋\n\nI\'m your personal journal buddy! I\'m here to help you reflect, grow, and have some fun along the way.\n\nBefore we dive in, I\'d love to get to know you better.\n\n<b>First things first</b> - what name would you like me to call you?',
    [Language.RUSSIAN]: '<b>Привет, {firstName}!</b> 👋\n\nЯ твой личный дневник-помощник! Я здесь, чтобы помочь тебе размышлять, расти и немного развлечься.\n\nПрежде чем мы начнем, я хотел бы узнать тебя получше.\n\n<b>Для начала</b> - как тебя называть?'
  },
  niceMeet: {
    [Language.ENGLISH]: '<b>Nice to meet you, {name}!</b> 😊\n\nHow old are you? Feel free to pick from these options:',
    [Language.RUSSIAN]: '<b>Приятно познакомиться, {name}!</b> 😊\n\nСколько тебе лет? Выбери один из вариантов:'
  },
  thanks: {
    [Language.ENGLISH]: '<b>Thanks!</b> And what gender do you identify as?',
    [Language.RUSSIAN]: '<b>Спасибо!</b> А какого ты пола?'
  },
  gotIt: {
    [Language.ENGLISH]: '<b>Got it!</b> What do you do for work or study?',
    [Language.RUSSIAN]: '<b>Понятно!</b> Чем ты занимаешься - работаешь или учишься?'
  },
  almostDone: {
    [Language.ENGLISH]: '<b>Almost done!</b> Now for the fun part - tell me a bit more about yourself! 💫\n\nFeel free to share anything you want, like you\'re introducing yourself to a new friend (which I am, actually!).\n\nSome things you might want to share:\n\n<i>• Where are you from?</i>\n<i>• Where are you living now?</i>\n<i>• Do you travel often?</i>\n<i>• Are you in a relationship?</i>\n<i>• What sports or physical activities do you enjoy?</i>\n<i>• What are your hobbies?</i>\n<i>• What are your dreams and goals?</i>\n<i>• Do you have any pets?</i>\n<i>• Any spiritual practices?</i>\n\nYou can reply with text, voice message, or even a video!',
    [Language.RUSSIAN]: '<b>Почти готово!</b> Теперь самое интересное - расскажи мне немного о себе! 💫\n\nМожешь поделиться чем угодно, как будто знакомишься с новым другом (которым я, собственно, и являюсь).\n\nВот что ты можешь рассказать:\n\n<i>• Откуда ты родом?</i>\n<i>• Где живешь сейчас?</i>\n<i>• Часто ли путешествуешь?</i>\n<i>• Состоишь ли в отношениях?</i>\n<i>• Какими видами спорта или физической активности занимаешься?</i>\n<i>• Какие у тебя хобби?</i>\n<i>• О чем ты мечтаешь, какие у тебя цели?</i>\n<i>• Есть ли у тебя домашние животные?</i>\n<i>• Занимаешься ли духовными практиками?</i>\n\nМожешь ответить текстом, голосовым сообщением или даже видео!'
  },
  amazing: {
    [Language.ENGLISH]: '<b>Amazing! Thanks for sharing, {name}!</b> 🎉\n\nI\'m so excited to be your journal buddy. Let\'s start this journey together!',
    [Language.RUSSIAN]: '<b>Потрясающе! Спасибо, что поделился(-ась), {name}!</b> 🎉\n\nЯ так рад быть твоим дневником-помощником. Давай начнем это путешествие вместе!'
  },
  welcomeAboard: {
    [Language.ENGLISH]: '<b>Welcome aboard, {name}!</b> 🎉\n\nI\'m so excited to be your journal buddy. Let\'s start this journey together!',
    [Language.RUSSIAN]: '<b>Добро пожаловать, {name}!</b> 🎉\n\nЯ так рад быть твоим дневником-помощником. Давай начнем это путешествие вместе!'
  },
  
  // Main menu
  mainMenu: {
    [Language.ENGLISH]: '<b>Hey {name}!</b> 😊\n\nWhat\'s on your mind today?',
    [Language.RUSSIAN]: '<b>Привет, {name}!</b> 😊\n\nО чем думаешь сегодня?'
  },
  createNewEntry: {
    [Language.ENGLISH]: '📝 Create New Entry',
    [Language.RUSSIAN]: '📝 Создать новую запись'
  },
  viewJournalHistory: {
    [Language.ENGLISH]: '📚 View Journal History',
    [Language.RUSSIAN]: '📚 Просмотр истории дневника'
  },
  chatAboutJournal: {
    [Language.ENGLISH]: '💬 Chat About My Journal',
    [Language.RUSSIAN]: '💬 Обсудить мой дневник'
  },
  analyzeToday: {
    [Language.ENGLISH]: '📊 Analyze Today',
    [Language.RUSSIAN]: '📊 Анализ сегодняшнего дня'
  },
  settings: {
    [Language.ENGLISH]: '⚙️ Settings',
    [Language.RUSSIAN]: '⚙️ Настройки'
  },
  
  // Journal entry
  continueEntry: {
    [Language.ENGLISH]: '<b>Hey {name}!</b>\n\nYou already have an entry in progress. Want to continue where you left off? You can add more thoughts or choose an option below:',
    [Language.RUSSIAN]: '<b>Привет, {name}!</b>\n\nУ тебя уже есть незавершенная запись. Хочешь продолжить с того места, где остановился(-ась)? Можешь добавить больше мыслей или выбрать один из вариантов ниже:'
  },
  newEntry: {
    [Language.ENGLISH]: '<b>Let\'s create a new journal entry, {name}!</b> 📝✨\n\nShare whatever\'s on your mind - your thoughts, feelings, experiences... anything at all! You can send text, voice messages, or videos.\n\nI\'m here to listen and help you reflect. When you\'re ready, just choose one of the options below:',
    [Language.RUSSIAN]: '<b>Давай создадим новую запись в дневнике, {name}!</b> 📝✨\n\nПоделись всем, что у тебя на уме - твоими мыслями, чувствами, опытом... чем угодно! Можешь отправлять текст, голосовые сообщения или видео.\n\nЯ здесь, чтобы выслушать и помочь тебе поразмышлять. Когда будешь готов(-а), просто выбери один из вариантов ниже:'
  },
  finishEntry: {
    [Language.ENGLISH]: '✅ Finish Entry',
    [Language.RUSSIAN]: '✅ Завершить запись'
  },
  goDeeper: {
    [Language.ENGLISH]: '🔍 Go Deeper, Ask Me',
    [Language.RUSSIAN]: '🔍 Копнуть глубже'
  },
  cancelEntry: {
    [Language.ENGLISH]: '❌ Cancel Entry',
    [Language.RUSSIAN]: '❌ Отменить запись'
  },
  
  // Journal history
  noEntries: {
    [Language.ENGLISH]: '<b>{name}</b>, you haven\'t created any journal entries yet. Let\'s start your journaling journey today!',
    [Language.RUSSIAN]: '<b>{name}</b>, ты еще не создал(а) ни одной записи в дневнике. Давай начнем твой путь ведения дневника сегодня!'
  },
  journalHistory: {
    [Language.ENGLISH]: '<b>Here\'s your journaling history, {name}!</b> 📚\n\nTap on any entry to view it:',
    [Language.RUSSIAN]: '<b>Вот история твоего дневника, {name}!</b> 📚\n\nНажми на любую запись, чтобы просмотреть ее:'
  },
  
  // Chat mode
  noChatEntries: {
    [Language.ENGLISH]: '<b>{name}</b>, you don\'t have any journal entries yet. Let\'s create some first so we can chat about them!',
    [Language.RUSSIAN]: '<b>{name}</b>, у тебя еще нет записей в дневнике. Давай сначала создадим несколько, чтобы мы могли их обсудить!'
  },
  chatIntro: {
    [Language.ENGLISH]: '<b>Hey {name}!</b> 💬\n\nI\'m all ears and ready to chat about your journal entries!\n\nYou can ask me things like:\n\n<i>• "What patterns do you notice in my entries?"</i>\n<i>• "How have my feelings changed over time?"</i>\n<i>• "What insights can you give me about my recent experiences?"</i>\n\nJust ask away - I\'ll do my best to give you thoughtful insights!',
    [Language.RUSSIAN]: '<b>Привет, {name}!</b> 💬\n\nЯ весь внимание и готов обсудить твои записи в дневнике!\n\nТы можешь спросить меня о таких вещах, как:\n\n<i>• "Какие закономерности ты замечаешь в моих записях?"</i>\n<i>• "Как менялись мои чувства со временем?"</i>\n<i>• "Какие выводы ты можешь сделать о моем недавнем опыте?"</i>\n\nСпрашивай - я постараюсь дать тебе содержательные ответы!'
  },
  exitChatMode: {
    [Language.ENGLISH]: '❌ Exit Chat Mode',
    [Language.RUSSIAN]: '❌ Выйти из режима обсуждения'
  },
  
  // Button responses
  entryCanceled: {
    [Language.ENGLISH]: '<b>No worries, {name}!</b> I\'ve canceled this entry. We can start fresh whenever you\'re ready.',
    [Language.RUSSIAN]: '<b>Не беспокойся, {name}!</b> Я отменил эту запись. Мы можем начать заново, когда ты будешь готов(а).'
  },
  exitedChatMode: {
    [Language.ENGLISH]: '<b>Alright {name}!</b> We\'re back to the main menu. Let me know if you want to chat again later.',
    [Language.RUSSIAN]: '<b>Хорошо, {name}!</b> Мы вернулись в главное меню. Дай мне знать, если захочешь пообщаться позже.'
  },
  
  // Entry view
  journalEntry: {
    [Language.ENGLISH]: '<b>📝 Journal Entry</b> ({date} at {time}):\n\n{content}\n\n<b>📊 Analysis:</b>\n{analysis}',
    [Language.RUSSIAN]: '<b>📝 Запись в дневнике</b> ({date} в {time}):\n\n{content}\n\n<b>📊 Анализ:</b>\n{analysis}'
  },
  voiceTranscription: {
    [Language.ENGLISH]: '🎙️ <b>Voice:</b> {transcription}',
    [Language.RUSSIAN]: '🎙️ <b>Голос:</b> {transcription}'
  },
  videoTranscription: {
    [Language.ENGLISH]: '🎥 <b>Video:</b> {transcription}',
    [Language.RUSSIAN]: '🎥 <b>Видео:</b> {transcription}'
  },
  
  // Go deeper
  deeperQuestions: {
    [Language.ENGLISH]: '<b>{analysis}</b>\n\n<b>🤔 Let\'s dig a bit deeper:</b>\n\n{questions}',
    [Language.RUSSIAN]: '<b>{analysis}</b>\n\n<b>🤔 Давай копнем глубже:</b>\n\n{questions}'
  },
  thoughtsOnQuestions: {
    [Language.ENGLISH]: '<b>What are your thoughts on these questions, {name}?</b> Or would you like to wrap up this entry?',
    [Language.RUSSIAN]: '<b>Что ты думаешь об этих вопросах, {name}?</b> Или хочешь завершить эту запись?'
  },
  
  // Analyze journal
  noActiveEntry: {
    [Language.ENGLISH]: '<b>Hey {name}</b>, you don\'t have an active journal entry yet. Let\'s create one first!',
    [Language.RUSSIAN]: '<b>Привет, {name}</b>, у тебя еще нет активной записи в дневнике. Давай сначала создадим одну!'
  },
  entryNotFound: {
    [Language.ENGLISH]: '<b>Hmm, I can\'t seem to find your journal entry.</b> Let\'s start fresh!',
    [Language.RUSSIAN]: '<b>Хм, не могу найти твою запись в дневнике.</b> Давай начнем заново!'
  },
  questionsToThinkAbout: {
    [Language.ENGLISH]: '<b>I\'ve been thinking about what you shared, {name}... 🤔</b>\n\n<b>Questions to ponder:</b>\n\n{questions}',
    [Language.RUSSIAN]: '<b>Я размышлял о том, чем ты поделился(-ась), {name}... 🤔</b>\n\n<b>Вопросы для размышления:</b>\n\n{questions}'
  },
  shareThoughts: {
    [Language.ENGLISH]: '<b>Feel free to share your thoughts on these questions</b>, or we can wrap up whenever you\'re ready!',
    [Language.RUSSIAN]: '<b>Не стесняйся делиться своими мыслями по этим вопросам</b>, или мы можем закончить, когда ты будешь готов(а)!'
  },
  
  // Finish entry
  entrySaved: {
    [Language.ENGLISH]: '<b>Good job, {name}! ✨ Entry saved.</b>\n\n<b>📝 Summary:</b>\n{summary}\n\n<b>💭 Something to reflect on:</b>\n<i>{question}</i>',
    [Language.RUSSIAN]: '<b>Отличная работа, {name}! ✨ Запись сохранена.</b>\n\n<b>📝 Краткое содержание:</b>\n{summary}\n\n<b>💭 Вопрос для размышления:</b>\n<i>{question}</i>'
  },
  
  // Settings
  settingsTitle: {
    [Language.ENGLISH]: '<b>Settings</b>\n\nHere you can customize your journal experience:',
    [Language.RUSSIAN]: '<b>Настройки</b>\n\nЗдесь ты можешь настроить свой опыт ведения дневника:'
  },
  changeLanguage: {
    [Language.ENGLISH]: '🌐 Change Language',
    [Language.RUSSIAN]: '🌐 Изменить язык'
  },
  backToMainMenu: {
    [Language.ENGLISH]: '↩️ Back to Main Menu',
    [Language.RUSSIAN]: '↩️ Вернуться в главное меню'
  },
  
  // Analyze Today
  analyzeTodayIntro: {
    [Language.ENGLISH]: '<b>Let\'s analyze your day, {name}!</b> 📊\n\nI\'ll look at your entries from today and share some insights.',
    [Language.RUSSIAN]: '<b>Давай проанализируем твой день, {name}!</b> 📊\n\nЯ посмотрю на твои сегодняшние записи и поделюсь некоторыми наблюдениями.'
  },
  noTodayEntries: {
    [Language.ENGLISH]: '<b>{name}</b>, you don\'t have any journal entries from today. Let\'s create one first!',
    [Language.RUSSIAN]: '<b>{name}</b>, у тебя нет записей в дневнике за сегодня. Давай сначала создадим одну!'
  },
  todayAnalysis: {
    [Language.ENGLISH]: '<b>Here\'s my analysis of your day, {name}:</b>\n\n{analysis}\n\n<b>Would you like to discuss this further?</b>',
    [Language.RUSSIAN]: '<b>Вот мой анализ твоего дня, {name}:</b>\n\n{analysis}\n\n<b>Хочешь обсудить это подробнее?</b>'
  },
  
  // Error messages
  errorProcessingVoice: {
    [Language.ENGLISH]: 'Sorry, I had trouble processing your voice message. Could you try sending a text message instead?',
    [Language.RUSSIAN]: 'Извини, у меня возникли проблемы с обработкой твоего голосового сообщения. Не мог бы ты попробовать отправить текстовое сообщение?'
  },
  errorProcessingVideo: {
    [Language.ENGLISH]: 'Sorry, I had trouble processing your video. Could you try sending a text message instead?',
    [Language.RUSSIAN]: 'Извини, у меня возникли проблемы с обработкой твоего видео. Не мог бы ты попробовать отправить текстовое сообщение?'
  },
  
  // Transcription
  transcriptionText: {
    [Language.ENGLISH]: '<b>Text:</b>\n\n<code>{transcription}</code>',
    [Language.RUSSIAN]: '<b>Текст:</b>\n\n<code>{transcription}</code>'
  },
  
  // Chat follow-ups
  anythingElse: {
    [Language.ENGLISH]: '<b>Anything else you\'d like to know about your journal, {name}?</b> I\'m all ears! 👂',
    [Language.RUSSIAN]: '<b>Что-нибудь еще ты хотел бы узнать о своем дневнике, {name}?</b> Я весь внимание! 👂'
  },
  anyOtherQuestions: {
    [Language.ENGLISH]: '<b>Any other questions about your journaling journey, {name}?</b>',
    [Language.RUSSIAN]: '<b>Есть ли у тебя другие вопросы о твоем пути ведения дневника, {name}?</b>'
  },
  gotMoreQuestions: {
    [Language.ENGLISH]: '<b>Got any more questions for me, {name}?</b> I\'m loving our chat!',
    [Language.RUSSIAN]: '<b>Есть ли у тебя еще вопросы ко мне, {name}?</b> Мне нравится наш разговор!'
  },
  askMeAnything: {
    [Language.ENGLISH]: '<b>{name}</b>, you can ask me anything about your journal entries! Send me a text, voice message, or video with your question. Or type \'❌ Exit Chat Mode\' if you want to return to the main menu.',
    [Language.RUSSIAN]: '<b>{name}</b>, ты можешь спросить меня о чем угодно касательно твоих записей в дневнике! Отправь мне текст, голосовое сообщение или видео с твоим вопросом. Или напиши \'❌ Выйти из режима обсуждения\', если хочешь вернуться в главное меню.'
  }
};

// In-memory cache of texts
export const texts: TextCollection = { ...defaultTexts };

// Function to load texts from database
export async function loadTextsFromDatabase(): Promise<TextCollection> {
  try {
    // Get all localization texts from database
    const dbTexts = await getAllLocalizationTexts();
    
    // If no texts exist in the database, initialize with default texts
    if (dbTexts.length === 0) {
      await initializeDefaultTexts();
      return defaultTexts;
    }
    
    // Convert database texts to text collection format
    const loadedTexts: TextCollection = {};
    
    for (const dbText of dbTexts) {
      loadedTexts[dbText.key] = {
        [Language.ENGLISH]: dbText.translations[Language.ENGLISH],
        [Language.RUSSIAN]: dbText.translations[Language.RUSSIAN]
      };
    }
    
    return loadedTexts;
  } catch (error) {
    console.error('Error loading localization texts from database:', error);
    return defaultTexts;
  }
}

// Function to initialize default texts in the database
async function initializeDefaultTexts(): Promise<void> {
  try {
    // Group texts by category
    const categories = {
      onboarding: [
        'languageSelection', 'languageChanged', 'welcome', 'niceMeet', 
        'thanks', 'gotIt', 'almostDone', 'amazing', 'welcomeAboard'
      ],
      mainMenu: [
        'mainMenu', 'createNewEntry', 'viewJournalHistory', 
        'chatAboutJournal', 'analyzeToday', 'settings'
      ],
      journalEntry: [
        'continueEntry', 'newEntry', 'finishEntry', 
        'goDeeper', 'cancelEntry'
      ],
      journalHistory: [
        'noEntries', 'journalHistory'
      ],
      chatMode: [
        'noChatEntries', 'chatIntro', 'exitChatMode'
      ],
      buttonResponses: [
        'entryCanceled', 'exitedChatMode'
      ],
      entryView: [
        'journalEntry', 'voiceTranscription', 'videoTranscription'
      ],
      goDeeper: [
        'deeperQuestions', 'thoughtsOnQuestions'
      ],
      analyzeJournal: [
        'noActiveEntry', 'entryNotFound', 'questionsToThinkAbout', 'shareThoughts'
      ],
      finishEntry: [
        'entrySaved'
      ],
      settings: [
        'settingsTitle', 'changeLanguage', 'backToMainMenu'
      ],
      analyzeToday: [
        'analyzeTodayIntro', 'noTodayEntries', 'todayAnalysis'
      ],
      errorMessages: [
        'errorProcessingVoice', 'errorProcessingVideo'
      ],
      transcription: [
        'transcriptionText'
      ],
      chatFollowUps: [
        'anythingElse', 'anyOtherQuestions', 'gotMoreQuestions', 'askMeAnything'
      ]
    };
    
    // Insert each text into the database
    for (const [category, keys] of Object.entries(categories)) {
      for (const key of keys) {
        if (defaultTexts[key]) {
          await upsertLocalizationText(
            key,
            category,
            {
              [Language.ENGLISH]: defaultTexts[key][Language.ENGLISH],
              [Language.RUSSIAN]: defaultTexts[key][Language.RUSSIAN]
            }
          );
        }
      }
      
      console.log(`Default localization texts initialized in database for category: ${category}`);
    }
  } catch (error) {
    console.error('Error initializing default texts in database:', error);
  }
}

// Function to load texts from JSON files (for backward compatibility)
export function loadTextsFromFiles(): TextCollection {
  try {
    // Create directory if it doesn't exist
    if (!fs.existsSync(LOCALIZATION_DIR)) {
      fs.mkdirSync(LOCALIZATION_DIR, { recursive: true });
      
      // Save default texts to files for each category
      saveDefaultTextsToFiles();
      
      return defaultTexts;
    }
    
    // Load all JSON files from the localization directory
    const files = fs.readdirSync(LOCALIZATION_DIR).filter(file => file.endsWith('.json'));
    
    // If no files exist, create them with default texts
    if (files.length === 0) {
      saveDefaultTextsToFiles();
      return defaultTexts;
    }
    
    // Merge all text files into a single collection
    const loadedTexts: TextCollection = {};
    
    for (const file of files) {
      const filePath = path.join(LOCALIZATION_DIR, file);
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const fileTexts = JSON.parse(fileContent) as TextCollection;
      
      // Merge with loaded texts
      Object.assign(loadedTexts, fileTexts);
    }
    
    return loadedTexts;
  } catch (error) {
    console.error('Error loading localization files:', error);
    return defaultTexts;
  }
}

// Function to save default texts to separate files by category (for backward compatibility)
function saveDefaultTextsToFiles() {
  // Group texts by category
  const categories = {
    onboarding: [
      'languageSelection', 'languageChanged', 'welcome', 'niceMeet', 
      'thanks', 'gotIt', 'almostDone', 'amazing', 'welcomeAboard'
    ],
    mainMenu: [
      'mainMenu', 'createNewEntry', 'viewJournalHistory', 
      'chatAboutJournal', 'analyzeToday', 'settings'
    ],
    journalEntry: [
      'continueEntry', 'newEntry', 'finishEntry', 
      'goDeeper', 'cancelEntry'
    ],
    journalHistory: [
      'noEntries', 'journalHistory'
    ],
    chatMode: [
      'noChatEntries', 'chatIntro', 'exitChatMode'
    ],
    buttonResponses: [
      'entryCanceled', 'exitedChatMode'
    ],
    entryView: [
      'journalEntry', 'voiceTranscription', 'videoTranscription'
    ],
    goDeeper: [
      'deeperQuestions', 'thoughtsOnQuestions'
    ],
    analyzeJournal: [
      'noActiveEntry', 'entryNotFound', 'questionsToThinkAbout', 'shareThoughts'
    ],
    finishEntry: [
      'entrySaved'
    ],
    settings: [
      'settingsTitle', 'changeLanguage', 'backToMainMenu'
    ],
    analyzeToday: [
      'analyzeTodayIntro', 'noTodayEntries', 'todayAnalysis'
    ],
    errorMessages: [
      'errorProcessingVoice', 'errorProcessingVideo'
    ],
    transcription: [
      'transcriptionText'
    ],
    chatFollowUps: [
      'anythingElse', 'anyOtherQuestions', 'gotMoreQuestions', 'askMeAnything'
    ]
  };
  
  // Create a file for each category
  for (const [category, keys] of Object.entries(categories)) {
    const categoryTexts: TextCollection = {};
    
    // Add each key to the category
    for (const key of keys) {
      if (defaultTexts[key]) {
        categoryTexts[key] = defaultTexts[key];
      }
    }
    
    // Save to file
    const filePath = path.join(LOCALIZATION_DIR, `${category}.json`);
    fs.writeFileSync(filePath, JSON.stringify(categoryTexts, null, 2), 'utf8');
  }
}

// Initialize texts from database
export async function initializeTexts(): Promise<void> {
  const loadedTexts = await loadTextsFromDatabase();
  Object.assign(texts, loadedTexts);
  console.log('Localization texts loaded from database');
}

// Helper function to get text for a specific key and language
export function getText(key: string, language: Language): string {
  if (!texts[key]) {
    console.warn(`Missing text key: ${key}`);
    return `[Missing text: ${key}]`;
  }
  
  return texts[key][language] || texts[key][Language.ENGLISH] || `[Missing translation: ${key}]`;
}

/**
 * A template variable value. Plain strings are HTML-escaped before insertion;
 * wrap pre-built trusted markup in `{ raw: ... }` to insert it verbatim.
 */
export type TemplateValue = string | { raw: string };

// Replacement uses a function so that `$`-patterns in values are inserted literally.
function replacePlaceholder(text: string, varName: string, value: string): string {
  return text.replace(new RegExp(`\\{${varName}\\}`, 'g'), () => value);
}

// Helper function to get text for a user with variable replacement.
// Texts themselves are trusted HTML; all injected values are escaped by default.
export function getTextForUser(key: string, user: IUser, variables: Record<string, TemplateValue> = {}): string {
  const language = user.language || Language.ENGLISH;
  let text = getText(key, language);

  // Replace user-specific variables
  text = replacePlaceholder(text, 'name', escapeHtml(user.name || user.firstName || ''));
  text = replacePlaceholder(text, 'firstName', escapeHtml(user.firstName || ''));

  // Replace custom variables
  for (const [varName, varValue] of Object.entries(variables)) {
    const value = typeof varValue === 'string' ? escapeHtml(varValue) : varValue.raw;
    text = replacePlaceholder(text, varName, value);
  }

  return text;
}

// Function to reload texts from database
export async function reloadTexts(): Promise<TextCollection> {
  const reloadedTexts = await loadTextsFromDatabase();
  Object.assign(texts, reloadedTexts);
  return texts;
}

// Function to update a specific text in the database
export async function updateText(key: string, language: Language, newText: string): Promise<boolean> {
  try {
    // Update in database
    const updatedText = await updateTranslation(key, language, newText);
    
    if (!updatedText) {
      console.error(`Text key "${key}" not found in database`);
      return false;
    }
    
    // Update in-memory cache
    if (!texts[key]) {
      texts[key] = { [Language.ENGLISH]: '', [Language.RUSSIAN]: '' };
    }
    texts[key][language] = newText;
    
    return true;
  } catch (error) {
    console.error('Error updating text:', error);
    return false;
  }
}

// Function to export texts to JSON files (for backup)
export async function exportTextsToFiles(): Promise<boolean> {
  try {
    // Get all texts from database
    const dbTexts = await getAllLocalizationTexts();
    
    // Group by category
    const categorizedTexts: Record<string, TextCollection> = {};
    
    for (const dbText of dbTexts) {
      if (!categorizedTexts[dbText.category]) {
        categorizedTexts[dbText.category] = {};
      }
      
      categorizedTexts[dbText.category][dbText.key] = {
        [Language.ENGLISH]: dbText.translations[Language.ENGLISH],
        [Language.RUSSIAN]: dbText.translations[Language.RUSSIAN]
      };
    }
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(LOCALIZATION_DIR)) {
      fs.mkdirSync(LOCALIZATION_DIR, { recursive: true });
    }
    
    // Save each category to a file
    for (const [category, categoryTexts] of Object.entries(categorizedTexts)) {
      const filePath = path.join(LOCALIZATION_DIR, `${category}.json`);
      fs.writeFileSync(filePath, JSON.stringify(categoryTexts, null, 2), 'utf8');
    }
    
    console.log('Texts exported to files successfully');
    return true;
  } catch (error) {
    console.error('Error exporting texts to files:', error);
    return false;
  }
} 