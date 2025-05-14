## Suggestions for src/locales/ru/settings.json

Here are the suggested changes for the Russian localization strings in `src/locales/ru/settings.json`.
Each original key is followed by the current Russian text, my suggested alternative, and a proposed HTML formatted version where applicable. For button texts, only the text with an emoji is suggested.

```json
{
  "title": {
    "current": "Настройки",
    "suggestion": "⚙️ Настройки",
    "html_suggestion": "⚙️ Настройки"
  },
  "remindMeHeader": {
    "current": "Напоминать мне о журнале?",
    "suggestion": "🔔 Напоминать о дневнике?",
    "html_suggestion": "🔔 Напоминать о дневнике?"
  },
  "everyDayAtHeader": {
    "current": "Каждый день в:",
    "suggestion": "⏰ Ежедневно в:",
    "html_suggestion": "<b>⏰ Ежедневно в:</b>"
  },
  "showTranscribedHeader": {
    "current": "Показывать расшифрованный текст?",
    "suggestion": "📜 Показывать расшифровку?",
    "html_suggestion": "📜 Показывать расшифровку?"
  },
  "aiChatPreferHeader": {
    "current": "Для ИИ-чата предпочитать:",
    "suggestion": "💬 Язык AI-чата:",
    "html_suggestion": "💬 Язык AI-чата:"
  },
  "playWithSettingsTip": {
    "current": "<i>Поиграйтесь с настройками, чтобы получить от вашего журнала в 100 раз больше — чистые факты.</i>",
    "suggestion": "<i>💡 Поэкспериментируйте с настройками – и ваш дневник станет в 💯 раз полезнее. Факт!</i>",
    "html_suggestion": "<i>💡 Поэкспериментируйте с настройками – и ваш дневник станет в 💯 раз полезнее. Факт!</i>"
  },
  "notificationsEnabledIcon": {
    "current": "✅",
    "suggestion": "✅"
  },
  "notificationsDisabledIcon": {
    "current": "❌",
    "suggestion": "❌"
  },
  "timeNotSet": {
    "current": "⏱️ Не установлено",
    "suggestion": "⏱️ Время не задано",
    "html_suggestion": "⏱️ Время не задано"
  },
  "transcriptionsShowIcon": {
    "current": "✅",
    "suggestion": "✅"
  },
  "transcriptionsHideIcon": {
    "current": "❌",
    "suggestion": "❌"
  },
  "languageEnglish": {
    "current": "🇬🇧 Английский",
    "suggestion": "🇬🇧 Английский"
  },
  "languageRussian": {
    "current": "🇷🇺 Русский",
    "suggestion": "🇷🇺 Русский"
  },
  "buttons.disableNotifications": {
    "current": "❌ Отключить 🔔",
    "suggestion": "🔕 Отключить уведомления"
  },
  "buttons.enableNotifications": {
    "current": "✅ Включить 🔔",
    "suggestion": "🔔 Включить уведомления"
  },
  "buttons.setTime": {
    "current": "⏰ Установить время",
    "suggestion": "⏰ Время уведомлений"
  },
  "buttons.setUtcOffset": {
    "current": "🌍 Установить UTC сдвиг",
    "suggestion": "🌍 Часовой пояс"
  },
  "buttons.hideTranscriptions": {
    "current": "🔇 Скрыть расшифровки",
    "suggestion": "🔇 Скрыть текст"
  },
  "buttons.showTranscriptions": {
    "current": "🔊 Показать расшифровки",
    "suggestion": "📜 Показать текст"
  },
  "buttons.useRussian": {
    "current": "🇷🇺 Использовать русский",
    "suggestion": "🇷🇺 Русский"
  },
  "buttons.useEnglish": {
    "current": "🇬🇧 Использовать английский",
    "suggestion": "🇬🇧 Английский"
  },
  "backToMenuButton": {
    "current": "↩️ Меню",
    "suggestion": "↩️ В меню"
  },
  "setNotificationTimePrompt": {
    "current": "Пожалуйста, введите время для ежедневного напоминания о ведении журнала в 24-часовом формате.\n\nПример: '21:00' для 9 вечера.\n\nЭто время будет интерпретировано в ВАШЕМ ЛОКАЛЬНОМ ЧАСОВОМ ПОЯСЕ: {{currentOffsetDisplay}}\n\n(Мы конвертируем его в UTC перед сохранением)",
    "suggestion": "Укажите время для ежедневных напоминаний о дневнике (формат 24ч, например, <code>21:00</code>).\n\nВремя будет по вашему часовому поясу: <b>{{currentOffsetDisplay}}</b>.\n<small>(Мы сохраним его в UTC)</small>",
    "html_suggestion": "Укажите время для ежедневных напоминаний о дневнике (формат 24ч, например, <code>21:00</code>).\n\nВремя будет по вашему часовому поясу: <b>{{currentOffsetDisplay}}</b>.\n<small>(Мы сохраним его в UTC)</small>"
  },
  "notificationTimeSetConfirmation": {
    "current": "Отлично! Я буду отправлять вам уведомления в {{localTime}} по вашему времени ({{currentOffsetDisplay}}) 🌟",
    "suggestion": "Супер! Напоминания о дневнике будут приходить в <b>{{localTime}}</b> ({{currentOffsetDisplay}}) 🌟",
    "html_suggestion": "Супер! Напоминания о дневнике будут приходить в <b>{{localTime}}</b> ({{currentOffsetDisplay}}) 🌟"
  },
  "notificationTimeSaveError": {
    "current": "К сожалению, что-то пошло не так при сохранении времени уведомления.",
    "suggestion": "😔 Ошибка сохранения времени для дневника. Попробуйте ещё раз.",
    "html_suggestion": "😔 Ошибка сохранения времени для дневника. Попробуйте ещё раз."
  },
  "timeSettingCancelled": {
    "current": "Установка времени отменена.",
    "suggestion": "Установка времени для дневника отменена. ↩️",
    "html_suggestion": "Установка времени для дневника отменена. ↩️"
  },
  "invalidTimeFormat": {
    "current": "Пожалуйста, введите корректное время в 24-часовом формате (например, '21:00'). Или нажмите '❌ Отмена' для выхода.",
    "suggestion": "Неверный формат для времени дневника. Введите время как <code>21:00</code> или нажмите '❌ Отмена'.",
    "html_suggestion": "Неверный формат для времени дневника. Введите время как <code>21:00</code> или нажмите '❌ Отмена'."
  },
  "setUtcOffsetPrompt": {
    "current": "Пожалуйста, выберите или введите ваш сдвиг UTC (например, +2, -5, 0).\n\nВаш сдвиг UTC используется для корректного планирования уведомлений по вашему предпочтительному местному времени. Пример: UTC+2, UTC-5. Выберите опцию или введите вручную (например, \"+5:30\").",
    "suggestion": "Выберите или введите ваш часовой пояс (например, <code>+3</code>, <code>-5:30</code>). Это нужно для точных напоминаний о дневнике.\n\nМожно выбрать из списка или ввести вручную.",
    "html_suggestion": "Выберите или введите ваш часовой пояс (например, <code>+3</code>, <code>-5:30</code>). Это нужно для точных напоминаний о дневнике.\n\nМожно выбрать из списка или ввести вручную."
  },
  "detectedUtcOffsetInfo": {
    "current": "Мы думаем, ваш сдвиг может быть: UTC{{detectedOffset}}",
    "suggestion": "🌍 Похоже, ваш часовой пояс: <b>{{detectedOffset}}</b>",
    "html_suggestion": "🌍 Похоже, ваш часовой пояс: <b>{{detectedOffset}}</b>"
  },
  "cannotDetectUtcOffsetInfo": {
    "current": "Не удалось автоматически определить ваш UTC сдвиг.",
    "suggestion": "🤷 Не удалось определить ваш часовой пояс автоматически.",
    "html_suggestion": "🤷 Не удалось определить ваш часовой пояс автоматически."
  },
  "utcOffsetSetConfirmation": {
    "current": "Ваш UTC сдвиг установлен на UTC{{newOffset}}.",
    "suggestion": "✅ Часовой пояс установлен: <b>{{newOffset}}</b>.",
    "html_suggestion": "✅ Часовой пояс установлен: <b>{{newOffset}}</b>."
  },
  "utcOffsetSaveError": {
    "current": "К сожалению, что-то пошло не так при сохранении вашего UTC сдвига. Пожалуйста, попробуйте еще раз.",
    "suggestion": "😔 Ошибка сохранения часового пояса. Попробуйте снова.",
    "html_suggestion": "😔 Ошибка сохранения часового пояса. Попробуйте снова."
  },
  "timezoneSettingCancelled": {
    "current": "Установка UTC сдвига отменена.",
    "suggestion": "Установка часового пояса отменена. ↩️",
    "html_suggestion": "Установка часового пояса отменена. ↩️"
  },
  "invalidUtcOffsetFormat": {
    "current": "К сожалению, это не похоже на корректный UTC сдвиг. Пожалуйста, используйте форматы типа \"+2\", \"-5:30\", \"0\" или выберите из клавиатуры.",
    "suggestion": "Неверный формат часового пояса. Используйте <code>+2</code>, <code>-5:30</code>, <code>0</code> или выберите из предложенных.",
    "html_suggestion": "Неверный формат часового пояса. Используйте <code>+2</code>, <code>-5:30</code>, <code>0</code> или выберите из предложенных."
  }
}
``` 