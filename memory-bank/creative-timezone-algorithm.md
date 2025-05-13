# Creative Phase: Timezone Handling Algorithm Design

## Challenge

The current timezone handling implementation using IANA timezone strings (e.g., "America/New_York", "Europe/London") is causing inconsistencies in notification scheduling. Previous attempts to fix this issue have not been fully successful.

## Simplified Approach: UTC Offset Model

### Core Concept

Replace complex IANA timezone handling with a simple UTC offset approach:

1. **User Model Change**: 
   - Replace `timezone: string` (IANA format) with `utcOffset: string` (e.g., "+2", "-5")
   
2. **Time Representation**:
   - Store notification times in the database as UTC time
   - Apply UTC offset for display and user input

### Algorithm Components

#### 1. User Input

During onboarding or settings, present users with simple UTC offset options:
```
UTC-12  UTC-11  UTC-10  ...  UTC+0  ...  UTC+12  UTC+13  UTC+14
```

#### 2. Time Conversion Functions

**From Local to UTC**: 
```typescript
function localTimeToUTC(localTime: string, utcOffset: string): string {
  // Parse the local time (HH:MM)
  const [hours, minutes] = localTime.split(':').map(Number);
  
  // Parse the UTC offset
  const offsetHours = parseInt(utcOffset);
  
  // Subtract the offset to get UTC time
  let utcHours = hours - offsetHours;
  
  // Handle day wrapping
  if (utcHours < 0) utcHours += 24;
  if (utcHours >= 24) utcHours -= 24;
  
  // Format and return
  return `${utcHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}
```

**From UTC to Local**:
```typescript
function utcToLocalTime(utcTime: string, utcOffset: string): string {
  // Parse the UTC time (HH:MM)
  const [hours, minutes] = utcTime.split(':').map(Number);
  
  // Parse the UTC offset
  const offsetHours = parseInt(utcOffset);
  
  // Add the offset to get local time
  let localHours = hours + offsetHours;
  
  // Handle day wrapping
  if (localHours < 0) localHours += 24;
  if (localHours >= 24) localHours -= 24;
  
  // Format and return
  return `${localHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}
```

#### 3. Notification Scheduling

When scheduling notifications:

1. User sets a local time (e.g., "09:00")
2. System converts to UTC using their UTC offset
3. Store this UTC time in the database
4. When calculating the next notification:
   - Take the UTC notification time
   - Create a Date object for today at that UTC time
   - If that time has already passed, schedule for tomorrow

```typescript
function calculateNextNotification(utcTimeString: string): Date {
  // Parse UTC time
  const [hours, minutes] = utcTimeString.split(':').map(Number);
  
  // Create date for today at specified UTC time
  const nextDate = new Date();
  nextDate.setUTCHours(hours, minutes, 0, 0);
  
  // If this time has already passed today, schedule for tomorrow
  if (nextDate.getTime() <= Date.now()) {
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  }
  
  return nextDate;
}
```

#### 4. Time Display

When displaying notification time to user:

1. Convert UTC time from database to local time using their UTC offset
2. Format with clear timezone indication: "9:00 (UTC+2)"

```typescript
function formatTimeForDisplay(utcTime: string, utcOffset: string): string {
  const localTime = utcToLocalTime(utcTime, utcOffset);
  const sign = parseInt(utcOffset) >= 0 ? '+' : '';
  return `${localTime} (UTC${sign}${utcOffset})`;
}
```

### Migration Strategy

1. Add a one-time migration script to update existing users:
   - For users with IANA timezones, guess the closest UTC offset
   - For users with no timezone, default to UTC+0
   - Update their notification times based on the new offset

2. Approximate mapping from common IANA to UTC offset:
   ```typescript
   const TIMEZONE_TO_OFFSET = {
     'America/New_York': '-5',
     'Europe/London': '+0',
     'Europe/Paris': '+1',
     'Europe/Moscow': '+3',
     'Asia/Tokyo': '+9',
     // ... more mappings
   };
   ```

### Advantages of this Approach

1. **Simplicity**: Straightforward arithmetic instead of complex timezone libraries
2. **Consistency**: UTC offsets don't change with daylight saving time
3. **User-Friendly**: UTC offset selection is easier for users to understand
4. **Performance**: Faster calculations with less dependency on external libraries
5. **Resilience**: Less prone to edge cases and timezone library bugs

### Testing Cases

1. **Basic Conversion**:
   - UTC+2, local time "14:00" → UTC time "12:00"
   - UTC-5, local time "09:00" → UTC time "14:00"

2. **Cross-Day Scenarios**:
   - UTC+2, local time "01:00" → UTC time "23:00" (previous day)
   - UTC-10, local time "22:00" → UTC time "08:00" (next day)

3. **Notification Scheduling**:
   - Current time: 15:00 UTC
   - User timezone: UTC+2 (their local time is 17:00)
   - Notification time set: 18:00 local (16:00 UTC)
   - Next notification should be today at 16:00 UTC

4. **Edge Offsets**:
   - Handle UTC+14 and UTC-12 (extreme cases) 