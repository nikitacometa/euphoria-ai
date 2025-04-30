import { validateEnv, envSchema } from '../validation';
import { LogLevel } from '../../utils/logger';

describe('Config validation', () => {
  // Save original process.env
  const originalEnv = process.env;
  
  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
    // Clean up any test variables
    delete process.env.TELEGRAM_API_TOKEN;
    delete process.env.OPENAI_API_KEY;
  });
  
  afterAll(() => {
    // Restore original process.env
    process.env = originalEnv;
  });
  
  describe('validateEnv', () => {
    it('should throw an error when required variables are missing', () => {
      // Both variables are required
      expect(() => validateEnv()).toThrow();
    });
    
    it('should pass validation when required variables are provided', () => {
      // Set required variables
      process.env.TELEGRAM_API_TOKEN = 'test-token';
      process.env.OPENAI_API_KEY = 'test-key';
      
      expect(() => validateEnv()).not.toThrow();
    });
    
    it('should use default values when optional variables are not provided', () => {
      // Set required variables
      process.env.TELEGRAM_API_TOKEN = 'test-token';
      process.env.OPENAI_API_KEY = 'test-key';
      
      // Call validateEnv and check default values
      const env = validateEnv();
      
      expect(env.GPT_VERSION).toBe('gpt-4-turbo');
      expect(env.MONGODB_HOST).toBe('localhost');
      expect(env.MONGODB_PORT).toBe(27017);
      expect(env.MONGODB_DATABASE).toBe('euphoria');
      expect(env.LOG_LEVEL).toBe(LogLevel.INFO);
      expect(env.MAX_VOICE_MESSAGE_LENGTH_SECONDS).toBe(300);
    });
    
    it('should parse LOG_LEVEL correctly', () => {
      // Set required variables
      process.env.TELEGRAM_API_TOKEN = 'test-token';
      process.env.OPENAI_API_KEY = 'test-key';
      process.env.LOG_LEVEL = '3';
      
      const env = validateEnv();
      expect(env.LOG_LEVEL).toBe(LogLevel.DEBUG);
    });
    
    it('should throw an error for invalid LOG_LEVEL', () => {
      // Set required variables
      process.env.TELEGRAM_API_TOKEN = 'test-token';
      process.env.OPENAI_API_KEY = 'test-key';
      process.env.LOG_LEVEL = '5'; // Invalid
      
      expect(() => validateEnv()).toThrow();
    });
    
    it('should parse MONGODB_PORT as a number', () => {
      // Set required variables
      process.env.TELEGRAM_API_TOKEN = 'test-token';
      process.env.OPENAI_API_KEY = 'test-key';
      process.env.MONGODB_PORT = '12345';
      
      const env = validateEnv();
      expect(env.MONGODB_PORT).toBe(12345);
    });
    
    it('should throw an error for invalid MONGODB_PORT', () => {
      // Set required variables
      process.env.TELEGRAM_API_TOKEN = 'test-token';
      process.env.OPENAI_API_KEY = 'test-key';
      process.env.MONGODB_PORT = 'invalid-port';
      
      expect(() => validateEnv()).toThrow();
    });
  });
}); 