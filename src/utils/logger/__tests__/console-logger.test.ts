import { ConsoleLogger } from '../console-logger';
import { LogLevel } from '../types';

describe('ConsoleLogger', () => {
  let originalConsole: Console;
  
  beforeEach(() => {
    // Save original console methods
    originalConsole = { ...console };
    
    // Mock console methods
    console.error = jest.fn();
    console.warn = jest.fn();
    console.info = jest.fn();
    console.debug = jest.fn();
  });
  
  afterEach(() => {
    // Restore original console methods
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
    console.info = originalConsole.info;
    console.debug = originalConsole.debug;
  });
  
  it('should log at appropriate levels', () => {
    const logger = new ConsoleLogger({ name: 'test', level: LogLevel.INFO });
    
    logger.error('Error message');
    logger.warn('Warning message');
    logger.info('Info message');
    logger.debug('Debug message');
    
    expect(console.error).toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
    expect(console.info).toHaveBeenCalled();
    expect(console.debug).not.toHaveBeenCalled(); // Debug is higher than INFO
  });
  
  it('should include context in log messages', () => {
    const logger = new ConsoleLogger({ name: 'test', level: LogLevel.DEBUG });
    const context = { userId: '123', action: 'test' };
    
    logger.info('Message with context', context);
    
    // Check that the context was included
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('{"userId":"123","action":"test"}')
    );
  });
  
  it('should create child loggers with combined context', () => {
    const logger = new ConsoleLogger({ 
      name: 'parent',
      level: LogLevel.DEBUG,
      baseContext: { service: 'auth' } 
    });
    
    const childLogger = logger.child({ userId: '123' });
    childLogger.info('Child logger message');
    
    // Check that the message includes both contexts
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('{"service":"auth","userId":"123"}')
    );
  });
  
  it('should respect log level settings', () => {
    const logger = new ConsoleLogger({ name: 'test', level: LogLevel.ERROR });
    
    logger.error('Error message');
    logger.warn('Warning message');
    
    expect(console.error).toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled(); // WARN is higher than ERROR in our enum
    
    // Change the log level
    logger.setLevel(LogLevel.WARN);
    
    logger.warn('Warning message after level change');
    expect(console.warn).toHaveBeenCalled();
  });
}); 