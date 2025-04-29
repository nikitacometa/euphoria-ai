import { notificationService } from './notification.service';
import { User } from '../database/models/user.model';
import { bot } from '../app';
import { convertToUTC, convertFromUTC } from '../utils/timezone';

// Mock dependencies
jest.mock('../database/models/user.model', () => ({
    User: {
        find: jest.fn(),
        findOne: jest.fn(),
        findOneAndUpdate: jest.fn(),
        findByIdAndUpdate: jest.fn(),
    }
}));

jest.mock('../app', () => ({
    bot: {
        api: {
            sendMessage: jest.fn()
        }
    }
}));

jest.mock('../utils/timezone', () => ({
    convertToUTC: jest.fn(),
    convertFromUTC: jest.fn(),
    formatTimeWithTimezone: jest.fn((time) => `${time} (Timezone)`),
}));

// Helper to reset mocks between tests
beforeEach(() => {
    jest.clearAllMocks();
});

describe('NotificationService', () => {
    describe('updateUserNotificationSettings', () => {
        test('should update notification settings with timezone conversion', async () => {
            // Setup mocks
            const mockUser = { 
                telegramId: 123456, 
                timezone: 'America/New_York', 
                notificationTime: '17:00' // 5 PM in UTC
            };
            
            (User.findOne as jest.Mock).mockResolvedValue(mockUser);
            (User.findOneAndUpdate as jest.Mock).mockResolvedValue({ ...mockUser, notificationTime: '21:00' });
            (convertToUTC as jest.Mock).mockReturnValue('21:00'); // 5 PM New York -> 9 PM UTC
            
            // Call the method
            await notificationService.updateUserNotificationSettings(
                123456,      // telegramId
                true,        // enabled
                '17:00',     // local time (5 PM in New York)
                'America/New_York' // timezone
            );
            
            // Verify the time conversion was handled correctly
            expect(convertToUTC).toHaveBeenCalledWith('17:00', 'America/New_York');
            expect(User.findOneAndUpdate).toHaveBeenCalledWith(
                { telegramId: 123456 },
                { 
                    $set: { 
                        notificationsEnabled: true,
                        notificationTime: '21:00', // Converted UTC time
                        timezone: 'America/New_York'
                    } 
                }
            );
        });
        
        test('should only update timezone if time is not provided', async () => {
            await notificationService.updateUserNotificationSettings(
                123456,      // telegramId
                true,        // enabled
                undefined,   // no time update
                'Europe/London' // timezone
            );
            
            expect(User.findOneAndUpdate).toHaveBeenCalledWith(
                { telegramId: 123456 },
                { 
                    $set: { 
                        notificationsEnabled: true,
                        timezone: 'Europe/London'
                    } 
                }
            );
            
            // Time conversion should not be called
            expect(convertToUTC).not.toHaveBeenCalled();
        });
    });
    
    describe('getUserNotificationTime', () => {
        test('should return time in user timezone', async () => {
            // Setup mocks
            const mockUser = { 
                telegramId: 123456, 
                timezone: 'America/New_York', 
                notificationTime: '21:00' // 9 PM in UTC
            };
            
            (User.findOne as jest.Mock).mockResolvedValue(mockUser);
            (convertFromUTC as jest.Mock).mockReturnValue('17:00'); // 9 PM UTC -> 5 PM New York
            
            // Call the method
            const result = await notificationService.getUserNotificationTime(123456);
            
            // Verify the correct values are returned
            expect(result).toEqual({
                localTime: '17:00',
                utcTime: '21:00',
                timezone: 'America/New_York'
            });
            
            expect(convertFromUTC).toHaveBeenCalledWith('21:00', 'America/New_York');
        });
        
        test('should return null if user or notification time not found', async () => {
            (User.findOne as jest.Mock).mockResolvedValue(null);
            
            const result = await notificationService.getUserNotificationTime(123456);
            expect(result).toBeNull();
            
            (User.findOne as jest.Mock).mockResolvedValue({ telegramId: 123456 }); // No notification time
            
            const result2 = await notificationService.getUserNotificationTime(123456);
            expect(result2).toBeNull();
        });
    });
    
    // Additional tests could be added for:
    // - checkAndSendNotifications method
    // - sendNotification method
    // - updateUserDisplaySettings method
    // - updateUserLanguageSettings method
}); 