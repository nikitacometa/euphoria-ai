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
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn(),
        countDocuments: jest.fn()
    }
}));

jest.mock('../app', () => ({
    bot: {
        api: {
            sendMessage: jest.fn()
        },
        token: 'mock-token'
    }
}));

jest.mock('../utils/timezone', () => ({
    convertToUTC: jest.fn(),
    convertFromUTC: jest.fn(),
    formatTimeWithTimezone: jest.fn((time) => `${time} (Timezone)`),
}));

// Mock logger to prevent console noise during tests
jest.mock('../utils/logger', () => ({
    createLogger: () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    })
}));

// Helper to reset mocks between tests
beforeEach(() => {
    jest.clearAllMocks();
    // Reset interval if exists
    const service = notificationService as any;
    if (service.checkInterval) {
        clearInterval(service.checkInterval);
        service.checkInterval = null;
    }
});

describe('NotificationService', () => {
    describe('Service Lifecycle', () => {
        test('should start notification service', () => {
            const service = notificationService as any;
            
            // Start the service
            service.start();
            
            // Verify interval was set
            expect(service.checkInterval).toBeTruthy();
            
            // Clean up
            service.stop();
        });

        test('should stop notification service', () => {
            const service = notificationService as any;
            
            // Start then stop
            service.start();
            service.stop();
            
            // Verify interval was cleared
            expect(service.checkInterval).toBeNull();
        });

        test('should not start service twice', () => {
            const service = notificationService as any;
            
            // Start twice
            service.start();
            const firstInterval = service.checkInterval;
            service.start();
            
            // Verify same interval
            expect(service.checkInterval).toBe(firstInterval);
            
            // Clean up
            service.stop();
        });
    });

    describe('Basic Notification', () => {
        test('should send notification with correct message format', async () => {
            const mockUser = {
                _id: 'test123',
                telegramId: 12345,
                firstName: 'Test',
                notificationTime: '14:00',
                timezone: 'UTC'
            };

            // Call private send method
            await (notificationService as any).sendNotification(mockUser);

            // Verify message format
            expect(bot.api.sendMessage).toHaveBeenCalledWith(
                12345,
                expect.stringContaining('Hey Test 😏'),
                expect.objectContaining({
                    parse_mode: 'HTML',
                    reply_markup: expect.any(Object)
                })
            );
        });

        test('should handle notification failure gracefully', async () => {
            const mockUser = {
                _id: 'test123',
                telegramId: 12345,
                firstName: 'Test'
            };

            // Mock findByIdAndUpdate to resolve
            (User.findByIdAndUpdate as jest.Mock).mockResolvedValue({});

            // Mock the sendNotification method to always fail
            const originalSendNotification = (notificationService as any).sendNotification;
            (notificationService as any).sendNotification = jest.fn().mockRejectedValue(new Error('Network error'));

            try {
                // Should throw after max retries
                await (notificationService as any).sendNotificationWithRetries(mockUser);
            } catch (error) {
                // Verify error was logged
                expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
                    'test123',
                    expect.objectContaining({
                        lastNotificationError: 'Network error'
                    })
                );
            } finally {
                // Restore original method
                (notificationService as any).sendNotification = originalSendNotification;
            }
        });
    });

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

    describe('checkAndSendNotifications', () => {
        beforeEach(() => {
            // Mock Date.now() to return a fixed timestamp
            jest.useFakeTimers();
            jest.setSystemTime(new Date('2023-06-15T14:30:00.000Z'));
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        test('should find users with matching notification time and not recently notified', async () => {
            const currentUTCTime = '14:30';
            const oneDayAgo = new Date('2023-06-14T14:30:00.000Z');

            // Mock database query
            (User.find as jest.Mock).mockResolvedValue([]);

            await (notificationService as any).checkAndSendNotifications();

            // Verify correct query was used
            expect(User.find).toHaveBeenCalledWith({
                notificationsEnabled: true,
                notificationTime: currentUTCTime,
                $or: [
                    { lastNotificationSent: { $exists: false } },
                    { lastNotificationSent: { $lt: oneDayAgo } }
                ]
            });
        });

        test('should send notifications in parallel and handle errors', async () => {
            // Mock expected users
            const mockUsers = [
                { _id: 'user1', telegramId: 111111, firstName: 'User1' },
                { _id: 'user2', telegramId: 222222, firstName: 'User2' }
            ];
            
            // Mock database query
            (User.find as jest.Mock).mockResolvedValue(mockUsers);
            
            // Mock successful message sending for first user
            (bot.api.sendMessage as jest.Mock)
                .mockResolvedValueOnce({ message_id: 1 })  // First user success
                .mockRejectedValueOnce(new Error('User blocked bot')); // Second user fails
                
            // Mock DB update for notification tracking
            (User.findByIdAndUpdate as jest.Mock).mockResolvedValue({});
            
            // Call the private method directly
            const originalSendNotificationWithRetries = (notificationService as any).sendNotificationWithRetries;
            (notificationService as any).sendNotificationWithRetries = jest.fn()
                .mockResolvedValueOnce(undefined) // First user succeeds
                .mockRejectedValueOnce(new Error('User blocked bot')); // Second user fails
                
            try {
                await (notificationService as any).checkAndSendNotifications();
                
                // Verify both users were processed
                expect((notificationService as any).sendNotificationWithRetries).toHaveBeenCalledTimes(2);
                
                // Restore original method to not affect other tests
                (notificationService as any).sendNotificationWithRetries = originalSendNotificationWithRetries;
            } catch (error) {
                // Restore original method to not affect other tests
                (notificationService as any).sendNotificationWithRetries = originalSendNotificationWithRetries;
                throw error;
            }
        });
    });
    
    describe('checkHealth', () => {
        test('should return true when system is healthy', async () => {
            // Mock database check - fix exec chain for type safety
            (User.findOne as jest.Mock).mockReturnValue({
                select: jest.fn().mockReturnThis(),
                lean: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue({ telegramId: 123456 })
            });
            
            // Call the method
            const isHealthy = await notificationService.checkHealth();
            
            // Should be healthy
            expect(isHealthy).toBe(true);
        });
        
        test('should return false when database is unavailable', async () => {
            // Mock database failure - fix exec chain for type safety
            (User.findOne as jest.Mock).mockReturnValue({
                select: jest.fn().mockReturnThis(),
                lean: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue(null)
            });
            
            // Call the method
            const isHealthy = await notificationService.checkHealth();
            
            // Should not be healthy
            expect(isHealthy).toBe(false);
        });
        
        test('should return false when Telegram API token is missing', async () => {
            // Mock database success - fix exec chain for type safety
            (User.findOne as jest.Mock).mockReturnValue({
                select: jest.fn().mockReturnThis(),
                lean: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue({ telegramId: 123456 })
            });
            
            // Mock missing token (using defineProperty to handle read-only property)
            const originalToken = bot.token;
            Object.defineProperty(bot, 'token', {
                value: '',
                writable: true
            });
            
            // Call the method
            const isHealthy = await notificationService.checkHealth();
            
            // Restore token
            Object.defineProperty(bot, 'token', {
                value: originalToken,
                writable: true
            });
            
            // Should not be healthy
            expect(isHealthy).toBe(false);
        });
    });
    
    describe('sendNotificationWithRetries', () => {
        test('should retry failed notifications up to max attempts', async () => {
            // Mock a user
            const mockUser = { _id: 'user1', telegramId: 111111, firstName: 'User1' };
            
            // Mock database operations
            (User.findByIdAndUpdate as jest.Mock).mockResolvedValue({});
            
            // Mock bot sending message to fail first two times then succeed
            const originalSendNotification = (notificationService as any).sendNotification;
            (notificationService as any).sendNotification = jest.fn()
                .mockRejectedValueOnce(new Error('Network error'))
                .mockRejectedValueOnce(new Error('Server busy'))
                .mockResolvedValueOnce(undefined);
                
            // Mock setTimeout to execute immediately
            jest.spyOn(global, 'setTimeout').mockImplementation((cb: any) => {
                cb();
                return 1 as any;
            });
            
            // Call the method with the user
            await (notificationService as any).sendNotificationWithRetries(mockUser);
            
            // Should have attempted 3 times (original + 2 retries)
            expect((notificationService as any).sendNotification).toHaveBeenCalledTimes(3);
            
            // Restore original methods
            (notificationService as any).sendNotification = originalSendNotification;
        });
    });
}); 