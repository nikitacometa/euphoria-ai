import { getLogger, createLogger, createComponentLogger, createUserLogger, LogLevel } from '../index';
import { NullLogger } from '../null-logger';

// Mock the environment variable
const originalNodeEnv = process.env.NODE_ENV;

// Mock external modules
jest.mock('../../../config', () => ({
  LOG_LEVEL: 2, // INFO
}));

// Mock the logger implementations
jest.mock('../console-logger');
jest.mock('../pino-logger');
jest.mock('../null-logger');

describe('Logger Module', () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Reset modules to ensure clean tests
    jest.resetModules();
    
    // Mock the NullLogger implementation
    (NullLogger as jest.Mock).mockImplementation(() => ({
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      child: jest.fn().mockImplementation((ctx) => ({
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
        childContext: ctx
      }))
    }));
  });
  
  afterEach(() => {
    // Restore original environment
    process.env.NODE_ENV = originalNodeEnv;
  });
  
  it('should provide a default root logger', () => {
    // Import the module again to trigger initialization
    const loggerModule = require('../index');
    
    // Get the default root logger
    const logger = loggerModule.default;
    
    // Verify it exists and has expected methods
    expect(logger).toBeDefined();
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.child).toBe('function');
  });
  
  it('should provide helper functions to create loggers', () => {
    // Import the module again
    const loggerModule = require('../index');
    
    // Test the helper functions
    expect(typeof loggerModule.getLogger).toBe('function');
    expect(typeof loggerModule.createLogger).toBe('function');
    expect(typeof loggerModule.createComponentLogger).toBe('function');
    expect(typeof loggerModule.createUserLogger).toBe('function');
  });
  
  it('should create component loggers with component context', () => {
    // Import the module again
    const loggerModule = require('../index');
    
    // Create a component logger
    const componentLogger = loggerModule.createComponentLogger('TestComponent');
    
    // Verify it has the right context
    expect(componentLogger.childContext).toEqual({ component: 'TestComponent' });
  });
  
  it('should create user loggers with user context', () => {
    // Import the module again
    const loggerModule = require('../index');
    
    // Create a user logger
    const userLogger = loggerModule.createUserLogger('user123', 'testuser');
    
    // Verify it has the right context
    expect(userLogger.childContext).toEqual({ userId: 'user123', username: 'testuser' });
  });
  
  it('should handle user logger without username', () => {
    // Import the module again
    const loggerModule = require('../index');
    
    // Create a user logger without username
    const userLogger = loggerModule.createUserLogger('user123');
    
    // Verify it has the right context
    expect(userLogger.childContext).toEqual({ userId: 'user123' });
  });
}); 