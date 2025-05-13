# Creative Phase: Entry Message List UI Design

## Challenge

In the current journal entry creation flow, users send multiple messages (text, voice, video) that form a single entry, but there's no visual feedback showing what messages have been contributed to the current entry. We need to design a clean, informative message list that appears in the reply after each message, showing all contributions to the current entry.

## UI Requirements

1. List all messages contributed to the current entry
2. Differentiate between message types visually
3. Show preview of text messages (first 20 characters)
4. Show duration for voice/video messages
5. Support both English and Russian localization 
6. Maintain clear, readable formatting in Telegram's HTML

## Design Approach

### Message Type Indicators

Use emoji prefixes to visually distinguish message types:
- 📝 Text messages
- 🎤 Voice messages
- 🎥 Video messages
- 📎 File/document messages

### Format Template

```
<b>Current Entry:</b>

1. 📝 "First few words..." (text)
2. 🎤 Voice message (0:45)
3. 🎥 Video message (1:23)
```

### Implementation Considerations

1. **Message Preview Function**:
   ```typescript
   function getMessagePreview(message: IMessage): string {
     switch(message.type) {
       case MessageType.TEXT:
         // Get first 20 chars or less of the text
         const preview = message.text?.substring(0, 20) || '';
         const previewText = preview + (message.text && message.text.length > 20 ? '...' : '');
         return `📝 "${previewText}" (${t('common.text', user)})`;
         
       case MessageType.VOICE:
         return `🎤 ${t('common.voiceMessage', user)} (${formatDuration(message)})`;
         
       case MessageType.VIDEO:
         return `🎥 ${t('common.videoMessage', user)} (${formatDuration(message)})`;
       
       default:
         return `📎 ${t('common.fileMessage', user)}`;
     }
   }
   ```

2. **Duration Formatting**:
   ```typescript
   function formatDuration(message: IMessage): string {
     // Telegram provides duration in seconds for voice/video
     const durationSec = message.duration || 0;
     
     if (durationSec < 60) {
       return `${durationSec}${t('common.seconds', user)}`;
     }
     
     const minutes = Math.floor(durationSec / 60);
     const seconds = durationSec % 60;
     
     if (seconds === 0) {
       return `${minutes}${t('common.minutes', user)}`;
     }
     
     return `${minutes}:${seconds.toString().padStart(2, '0')}`;
   }
   ```

3. **Complete Message List Formatting**:
   ```typescript
   function formatMessageList(messages: IMessage[], user: IUser): string {
     if (!messages.length) return '';
     
     const messageHeader = t('journal.currentEntry', user);
     const messageItems = messages.map((msg, idx) => 
       `${idx + 1}. ${getMessagePreview(msg)}`
     ).join('\n');
     
     return `\n<b>${messageHeader}</b>\n\n${messageItems}\n`;
   }
   ```

## Layout Design

### English Version
```
<b>Current Entry:</b>

1. 📝 "What a beautiful day..." (text)
2. 🎤 Voice message (0:45)
3. 🎥 Video message (1:23)

What else would you like to add? You can also press:
✅ - to save and analyze your entry
🍑 - to just analyze without saving
❌ - to cancel this entry
```

### Russian Version
```
<b>Текущая запись:</b>

1. 📝 "Какой прекрасный ден..." (текст)
2. 🎤 Голосовое сообщение (0:45)
3. 🎥 Видео сообщение (1:23)

Что еще хотите добавить? Вы также можете нажать:
✅ - сохранить и проанализировать запись
🍑 - только проанализировать без сохранения
❌ - отменить эту запись
```

## Localization Keys

For this feature, we'll need the following localization keys:

```json
{
  "common": {
    "text": "text",
    "voiceMessage": "Voice message",
    "videoMessage": "Video message",
    "fileMessage": "File",
    "seconds": "s",
    "minutes": "m"
  },
  "journal": {
    "currentEntry": "Current Entry:",
    "whatElseAdd": "What else would you like to add? You can also press:",
    "saveAnalyze": "to save and analyze your entry",
    "analyzeOnly": "to just analyze without saving",
    "cancelEntry": "to cancel this entry"
  }
}
```

## User Experience Flow

1. User starts a new entry
2. User sends first message (text/voice/video)
3. Bot responds with acknowledgment + empty list
4. User sends second message
5. Bot responds with acknowledgment + list showing two messages
6. Process continues as user adds more messages
7. Each message addition updates the displayed list in the bot's response

## Visual Separation

To ensure the message list is visually distinct from the bot's instructions:

1. Use a bold header (`<b>Current Entry:</b>`)
2. Add empty lines before and after the list
3. Use numbered list format (1., 2., 3.) for clear organization
4. Include a divider line (e.g., `\n─────────────────\n`) if the entry becomes long

## Edge Cases

1. **Very Long Entries**: If the list exceeds Telegram's message length limit, truncate with "... and X more messages"
2. **Empty Messages**: Skip or show generic placeholder for messages with no content
3. **Media Without Duration**: Handle cases where duration metadata might be missing
4. **RTL Languages**: Ensure formatting works if Russian text includes RTL characters 