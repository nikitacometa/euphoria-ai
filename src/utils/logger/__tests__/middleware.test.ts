import { Context, Middleware, MiddlewareFn } from 'grammy';
import { createLoggerMiddleware } from '../middleware';
import { ILogger } from '../types';

// Workaround for the TypeScript issues with Grammy types
type AnyContext = any;

describe('Logger Middleware', () => {
  // Mock context and next function
  let mockCtx: Partial<AnyContext>;
  let mockNext: jest.Mock;
  let mockLogger: ILogger;
  
  beforeEach(() => {
    // Reset mocks
    mockCtx = {
      update: { update_id: 12345 },
      chat: { id: 67890, type: 'private', first_name: 'Test', title: 'Test Chat' },
      from: { id: 101112, username: 'testuser', is_bot: false, first_name: 'Test' }
    };
    
    mockNext = jest.fn().mockResolvedValue(undefined);
    
    // Mock logger
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      child: jest.fn().mockImplementation(() => mockLogger)
    };
  });
  
  it('should create child logger with context and attach to context', async () => {
    // Create middleware
    const middleware = createLoggerMiddleware({ logger: mockLogger }) as MiddlewareFn<AnyContext>;
    
    // Execute middleware
    await middleware(mockCtx as AnyContext, mockNext);
    
    // Verify logger was created with context and attached
    expect(mockLogger.child).toHaveBeenCalledWith(expect.objectContaining({
      requestId: expect.any(String),
      updateId: 12345,
      chatId: 67890,
      userId: 101112,
      username: 'testuser'
    }));
    
    // Check that logger was attached to context
    expect((mockCtx as any).logger).toBe(mockLogger);
  });
  
  it('should log at the start and completion of request handling', async () => {
    // Create middleware
    const middleware = createLoggerMiddleware({ logger: mockLogger }) as MiddlewareFn<AnyContext>;
    
    // Execute middleware
    await middleware(mockCtx as AnyContext, mockNext);
    
    // Verify start log
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Handling'));
    
    // Verify completion log
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Completed in'));
    
    // Verify next was called
    expect(mockNext).toHaveBeenCalled();
  });
  
  it('should log detailed info at debug level when configured', async () => {
    // Create middleware with debug level
    const middleware = createLoggerMiddleware({ 
      logger: mockLogger,
      level: 'debug'
    }) as MiddlewareFn<AnyContext>;
    
    // Execute middleware
    await middleware(mockCtx as AnyContext, mockNext);
    
    // Verify debug logs
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Handling'),
      expect.objectContaining({ update: expect.any(String) })
    );
    
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Completed in'));
  });
  
  it('should skip start logging when logStart is false', async () => {
    // Create middleware with logStart: false
    const middleware = createLoggerMiddleware({ 
      logger: mockLogger,
      logStart: false
    }) as MiddlewareFn<AnyContext>;
    
    // Execute middleware
    await middleware(mockCtx as AnyContext, mockNext);
    
    // Verify no start log
    expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Handling'));
    
    // But still logs completion
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Completed in'));
  });
  
  it('should log errors that occur during processing', async () => {
    // Create an error to throw
    const testError = new Error('Test error');
    mockNext.mockRejectedValue(testError);
    
    // Create middleware
    const middleware = createLoggerMiddleware({ logger: mockLogger }) as MiddlewareFn<AnyContext>;
    
    // Execute middleware and catch the error
    await expect(middleware(mockCtx as AnyContext, mockNext)).rejects.toThrow(testError);
    
    // Verify error log
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Error processing request'),
      expect.objectContaining({
        errorName: 'Error',
        errorMessage: 'Test error',
        errorStack: expect.any(String)
      })
    );
  });
  
  it('should respect error filter when provided', async () => {
    // Create an error to throw
    const testError = new Error('Test error');
    testError.name = 'TestError';
    mockNext.mockRejectedValue(testError);
    
    // Create middleware with error filter
    const middleware = createLoggerMiddleware({ 
      logger: mockLogger,
      shouldLogError: (err) => err.name !== 'TestError' // Don't log TestError
    }) as MiddlewareFn<AnyContext>;
    
    // Execute middleware and catch the error
    await expect(middleware(mockCtx as AnyContext, mockNext)).rejects.toThrow(testError);
    
    // Verify error was not logged
    expect(mockLogger.error).not.toHaveBeenCalled();
  });
  
  it('should properly detect update types', async () => {
    // Test different update types
    const updateTypes = [
      { updateObj: { message: {} }, expected: 'message' },
      { updateObj: { edited_message: {} }, expected: 'edited_message' },
      { updateObj: { callback_query: {} }, expected: 'callback_query' },
      { updateObj: { unknown_type: {} }, expected: 'unknown' }
    ];
    
    for (const { updateObj, expected } of updateTypes) {
      // Create a new context for each test
      const testCtx = { 
        ...mockCtx,
        update: { ...updateObj, update_id: 12345 }
      };
      
      // Create middleware
      const middleware = createLoggerMiddleware({ logger: mockLogger }) as MiddlewareFn<AnyContext>;
      
      // Execute middleware
      await middleware(testCtx as AnyContext, mockNext);
      
      // Verify correct update type was logged
      expect(mockLogger.info).toHaveBeenCalledWith(`Handling ${expected}`);
      
      // Reset mock
      jest.clearAllMocks();
    }
  });
}); 