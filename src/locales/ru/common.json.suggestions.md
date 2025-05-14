## Suggestions for src/locales/ru/common.json

Here are the suggested changes for the Russian localization strings in `src/locales/ru/common.json`.
Each original key is followed by the current Russian text, my suggested alternative, and a proposed HTML formatted version where applicable. For button texts, only the text with an emoji is suggested.

```json
{
  "welcome": {
    "current": "Добро пожаловать!",
    "suggestion": "👋 Привет!",
    "html_suggestion": "👋 <b>Привет!</b>"
  },
  "yes": {
    "current": "Да",
    "suggestion": "✅ Да"
  },
  "no": {
    "current": "Нет",
    "suggestion": "❌ Нет"
  },
  "save": {
    "current": "Сохранить",
    "suggestion": "💾 Сохранить"
  },
  "cancel": {
    "current": "Отмена",
    "suggestion": "↩️ Отмена"
  },
  "back": {
    "current": "Назад",
    "suggestion": "◀️ Назад"
  },
  "next": {
    "current": "Далее",
    "suggestion": "▶️ Далее"
  },
  "continue": {
    "current": "Продолжить",
    "suggestion": "➡️ Продолжить"
  },
  "text": {
    "current": "текст",
    "suggestion": "Текст",
    "html_suggestion": "Текст"
  },
  "voiceMessage": {
    "current": "Голосовое сообщение",
    "suggestion": "🎤 Голосовое",
    "html_suggestion": "🎤 <b>Голосовое сообщение</b>"
  },
  "videoMessage": {
    "current": "Видео сообщение",
    "suggestion": "🎬 Кружок",
    "html_suggestion": "🎬 <b>Кружок</b>"
  },
  "messageType.video": {
    "current": "Видео",
    "suggestion": "Видео",
    "html_suggestion": "Видео"
  },
  "messageType.voice": {
    "current": "Голосовая заметка",
    "suggestion": "Голосовое",
    "html_suggestion": "Голосовое"
  },
  "fileMessage": {
    "current": "Файл",
    "suggestion": "📎 Файл",
    "html_suggestion": "📎 <b>Файл</b>"
  },
  "seconds": {
    "current": "сек",
    "suggestion": "сек.",
    "html_suggestion": "сек."
  },
  "secondsSuffix": {
    "current": "сек",
    "suggestion": " с",
    "html_suggestion": " с"
  },
  "minutes": {
    "current": "мин",
    "suggestion": "мин.",
    "html_suggestion": "мин."
  },
  "minutesSuffix": {
    "current": "мин.",
    "suggestion": " м",
    "html_suggestion": " м"
  },
  "loading": {
    "current": "Загрузка...",
    "suggestion": "⏳ Загрузка...",
    "html_suggestion": "⏳ <i>Загрузка...</i>"
  },
  "loadingEmoji": {
    "current": "⏳",
    "suggestion": "⏳"
  },
  "error": {
    "current": "Ошибка",
    "suggestion": "⚠️ Ошибка!",
    "html_suggestion": "⚠️ <b>Ошибка!</b>"
  },
  "entry": {
    "current": "Запись",
    "suggestion": "Запись",
    "html_suggestion": "Запись"
  },
  "settings": {
    "current": "Настройки",
    "suggestion": "⚙️ Настройки",
    "html_suggestion": "⚙️ <b>Настройки</b>"
  },
  "menu": {
    "current": "Меню",
    "suggestion": "Меню",
    "html_suggestion": "Меню"
  },
  "areYouSure": {
    "current": "Вы уверены?",
    "suggestion": "🤔 Уверены?",
    "html_suggestion": "🤔 Вы <b>уверены</b>?"
  },
  "confirm": {
    "current": "Подтвердить",
    "suggestion": "✅ Подтвердить"
  },
  "discard": {
    "current": "Отбросить",
    "suggestion": "🗑️ Удалить"
  },
  "mainMenu.greeting": {
    "current": "Привет, {{name}}! Что на повестке дня? Записи, инсайты или настройки?",
    "suggestion": "Привет, {{name}}! 👋\nЧем займёмся сегодня? Новая запись, поиск инсайтов или заглянем в настройки?",
    "html_suggestion": "Привет, {{name}}! 👋\nЧем займёмся сегодня? Может, <b>новая запись</b>, поиск <b>инсайтов</b> или заглянем в <b>настройки</b>?"
  },
  "mainMenu.buttons.newEntry": {
    "current": "📝 Новая запись",
    "suggestion": "📝 Новая запись"
  },
  "mainMenu.buttons.journalHistory": {
    "current": "📚 История записей",
    "suggestion": "📚 История"
  },
  "mainMenu.buttons.askJournal": {
    "current": "🤔 Спросить журнал",
    "suggestion": "💡 Спросить Дневник"
  },
  "mainMenu.buttons.settings": {
    "current": "⚙️ Настройки",
    "suggestion": "⚙️ Настройки"
  },
  "common.backToMainMenu": {
    "current": "↩️ Меню",
    "suggestion": "🏠 В меню"
  },
  "messageType.text": {
    "current": "Текст",
    "suggestion": "Текст",
    "html_suggestion": "Текст"
  },
  "core:cancelCommand.sessionsReset": {
    "current": "✨ Все активные сессии сброшены. Возвращаюсь в главное меню.",
    "suggestion": "✨ Все активные сеансы завершены. Возвращаю вас в главное меню!",
    "html_suggestion": "✨ Все активные сеансы <b>завершены</b>. Возвращаю вас в главное меню!"
  },
  "core:helpCommand.fullText": {
    "current": "\n<b>Войди в Бесконечность ♾️</b>\n\n<code>/howto</code> - <i>Я покажу тебе классные способы моего использования</i>\n\n<code>/start</code> - <i>Перезапустить бота или вернуться в главное меню</i>\n<code>/menu</code> - <i>Показать главное меню с кнопками</i>\n<code>/journal_chat</code> - <i>Пообщаться с ИИ твоего журнала</i>\n<code>/new_entry</code> - <i>Сразу создать новую запись в журнале</i>\n<code>/history</code> - <i>Просмотреть свои прошлые записи</i>\n<code>/settings</code> - <i>Настроить уведомления, язык интерфейса и прочее</i>\n<code>/cancel</code> - <i>Выйти из текущей операции (для тех, кто боится обязательств)</i>\n<code>/reset</code> - <i>То же, что и cancel, но звучит драматичнее</i>\n<code>/help</code> - <i>Ты сейчас это читаешь! Уму непостижимо, да?</i>\n\n<b>💡 ПРОФИ СОВЕТЫ:</b>\n• Записывай голосовые/видео сообщения для более легкого ведения журнала\n• Используй Чат Журнала для исследования инсайтов по твоим записям\n• Включи уведомления, чтобы выработать регулярную привычку ведения журнала\n• Пробуй разные типы записей, чтобы запечатлеть весь свой опыт\n\n<b>👀 Текущие Ограничения:</b>\n• Голосовые сообщения макс. 5 минут\n\n<i>Помни: я здесь, чтобы быть твоим цифровым доверенным лицом — все записи приватны и защищены!</i>\n",
    "suggestion": "<b>Ключ к Бесконечности ♾️</b>\n\n<code>/howto</code> - <i>🚀 Покажу крутые фишки!</i>\n\n<code>/start</code> - <i>перезапуск или 🏠 главное меню</i>\n<code>/menu</code> - <i>📋 показать основное меню</i>\n<code>/journal_chat</code> - <i>💬 пообщаться с AI-дневником</i>\n<code>/new_entry</code> - <i>✍️ быстрая запись</i>\n<code>/history</code> - <i>📜 архив записей</i>\n<code>/settings</code> - <i>⚙️ все настройки тут</i>\n<code>/cancel</code> - <i>🛑 стоп-кран (для нерешительных)</i>\n<code>/reset</code> - <i>🔄 то же, что /cancel, но с драмой</i>\n<code>/help</code> - <i>ℹ️ ты уже здесь! Невероятно, правда?</i>\n\n<b>💡 ПРО-СОВЕТЫ:</b>\n• 🎤 Записывай голосовые/видео – это проще!\n• 💬 Ищи инсайты в Чате Дневника.\n• 🔔 Включи уведомления для регулярности.\n• 🎨 Экспериментируй с типами записей!\n\n<b>👀 ВАЖНО ЗНАТЬ (ограничения):</b>\n• 🎤 Голосовые – до 5 минут.\n\n<i>Помни: я твой цифровой сейф 🗝️ – всё конфиденциально и под защитой!</i>",
    "html_suggestion": "<b>Ключ к Бесконечности ♾️</b>\n\n<code>/howto</code> - <i>🚀 Покажу крутые фишки!</i>\n\n<code>/start</code> - <i>перезапуск или 🏠 главное меню</i>\n<code>/menu</code> - <i>📋 показать основное меню</i>\n<code>/journal_chat</code> - <i>💬 пообщаться с AI-дневником</i>\n<code>/new_entry</code> - <i>✍️ быстрая запись</i>\n<code>/history</code> - <i>📜 архив записей</i>\n<code>/settings</code> - <i>⚙️ все настройки тут</i>\n<code>/cancel</code> - <i>🛑 стоп-кран (для нерешительных)</i>\n<code>/reset</code> - <i>🔄 то же, что /cancel, но с драмой</i>\n<code>/help</code> - <i>ℹ️ ты уже здесь! Невероятно, правда?</i>\n\n<b>💡 ПРО-СОВЕТЫ:</b>\n• 🎤 Записывай голосовые/видео – это проще!\n• 💬 Ищи инсайты в Чате Дневника.\n• 🔔 Включи уведомления для регулярности.\n• 🎨 Экспериментируй с типами записей!\n\n<b>👀 ВАЖНО ЗНАТЬ (ограничения):</b>\n• 🎤 Голосовые – до 5 минут.\n\n<i>Помни: я твой цифровой сейф 🗝️ – всё конфиденциально и под защитой!</i>"
  },
  "core:checkNotifications.checking": {
    "current": "⏳ Проверка состояния системы уведомлений...",
    "suggestion": "⏳ Проверяю статус уведомлений...",
    "html_suggestion": "⏳ <i>Проверяю статус уведомлений...</i>"
  },
  "core:checkNotifications.reportTitle": {
    "current": "Состояние Системы Уведомлений",
    "suggestion": "📊 Статус Уведомлений",
    "html_suggestion": "📊 Статус Уведомлений"
  },
  "core:checkNotifications.systemHealth": {
    "current": "Состояние системы",
    "suggestion": "⚙️ Состояние системы:",
    "html_suggestion": "⚙️ <b>Состояние системы:</b>"
  },
  "core:checkNotifications.activeUsers": {
    "current": "Активных пользователей с уведомлениями: {{count}}",
    "suggestion": "🔔 Активных подписок: {{count}}",
    "html_suggestion": "🔔 Активных подписок: <b>{{count}}</b>"
  },
  "core:checkNotifications.recentErrorsHeader": {
    "current": "Недавние ошибки ({{count}}})",
    "suggestion": "🐞 Недавние ошибки ({{count}}):",
    "html_suggestion": "🐞 <b>Недавние ошибки ({{count}}):</b>"
  },
  "core:checkNotifications.noRecentErrors": {
    "current": "Недавних ошибок уведомлений нет! 🎉",
    "suggestion": "🎉 Ура! Ошибок в уведомлениях нет.",
    "html_suggestion": "🎉 Ура! Ошибок в уведомлениях <b>нет</b>."
  },
  "common:unknown": {
    "current": "неизвестно",
    "suggestion": "🤷 Неизвестно",
    "html_suggestion": "<i>Неизвестно</i>"
  },
  "core:notifyAll.starting": {
    "current": "🚀 Начинаю рассылку уведомлений всем пользователям...",
    "suggestion": "🚀 Запускаю рассылку для всех...",
    "html_suggestion": "🚀 <i>Запускаю рассылку для всех...</i>"
  },
  "core:notifyAll.noUsers": {
    "current": "❌ В базе данных нет пользователей.",
    "suggestion": "🤷 Пользователей для рассылки пока нет.",
    "html_suggestion": "🤷 Пользователей для рассылки пока нет."
  },
  "core:notifyAll.preparing": {
    "current": "📤 Готовлюсь отправить уведомления {{userCount}} пользователям. Это может занять некоторое время...",
    "suggestion": "📤 Готовлю уведомления для {{userCount}} пользователей. Минуточку...",
    "html_suggestion": "📤 Готовлю уведомления для <b>{{userCount}}</b> пользователей. <i>Минуточку...</i>"
  },
  "core:notifyAll.completeTitle": {
    "current": "Рассылка Уведомлений Завершена",
    "suggestion": "✅ Рассылка Завершена!",
    "html_suggestion": "✅ Рассылка Завершена!"
  },
  "core:notifyAll.totalUsers": {
    "current": "Всего пользователей",
    "suggestion": "👥 Всего пользователей:",
    "html_suggestion": "👥 <b>Всего пользователей:</b>"
  },
  "core:notifyAll.successful": {
    "current": "Успешных уведомлений",
    "suggestion": "👍 Успешно:",
    "html_suggestion": "👍 <b>Успешно:</b>"
  },
  "core:notifyAll.failed": {
    "current": "Неудачных уведомлений",
    "suggestion": "👎 Неудачно:",
    "html_suggestion": "👎 <b>Неудачно:</b>"
  },
  "core:notifyAll.errorDetailsTitle": {
    "current": "Детали ошибок (показаны первые {{count}} пользователей)",
    "suggestion": "📋 Детали ошибок (первые {{count}}):",
    "html_suggestion": "📋 Детали ошибок (первые {{count}}):"
  }
}
```

</rewritten_file>