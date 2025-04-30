import config, {
  telegramConfig,
  openAIConfig,
  databaseConfig,
  loggingConfig,
  supportConfig
} from '../index';
import { validateEnv } from '../validation';

// Mock the validation module
jest.mock('../validation', () => ({
  validateEnv: jest.fn()
}));

describe('Config module', () => {
  beforeEach(() => {
    // Reset and setup mock
    jest.clearAllMocks();
    
    // Mock the return value of validateEnv
    (validateEnv as jest.Mock).mockReturnValue({
      TELEGRAM_API_TOKEN: 'test-token',
      OPENAI_API_KEY: 'test-key',
      GPT_VERSION: 'test-version',
      MONGODB_HOST: 'test-host',
      MONGODB_PORT: 12345,
      MONGODB_USER: 'test-user',
      MONGODB_PASSWORD: 'test-password',
      MONGODB_DATABASE: 'test-db',
      MONGO_EXPRESS_PORT: 8081,
      LOG_LEVEL: 2,
      MAX_VOICE_MESSAGE_LENGTH_SECONDS: 300,
      SUPPORT_CHAT_ID: 'test-chat',
      ADMIN_IDS: '123,456',
      NOTIFICATION_ALERT_THRESHOLD: 3,
      MAX_NOTIFICATION_RETRIES: 3
    });
  });
  
  it('should call validateEnv when imported', () => {
    // Require the module again to ensure validateEnv is called
    jest.isolateModules(() => {
      require('../index');
      expect(validateEnv).toHaveBeenCalled();
    });
  });
  
  it('should correctly map environment variables to config objects', () => {
    // Reimport to get the latest values
    jest.isolateModules(() => {
      const { 
        telegramConfig,
        openAIConfig,
        databaseConfig,
        loggingConfig,
        supportConfig,
        default: config 
      } = require('../index');
      
      // Check telegramConfig
      expect(telegramConfig.apiToken).toBe('test-token');
      expect(telegramConfig.maxVoiceMessageLengthSeconds).toBe(300);
      
      // Check openAIConfig
      expect(openAIConfig.apiKey).toBe('test-key');
      expect(openAIConfig.gptVersion).toBe('test-version');
      
      // Check databaseConfig
      expect(databaseConfig.host).toBe('test-host');
      expect(databaseConfig.port).toBe('12345');
      expect(databaseConfig.user).toBe('test-user');
      expect(databaseConfig.password).toBe('test-password');
      expect(databaseConfig.name).toBe('test-db');
      expect(databaseConfig.expressPort).toBe('8081');
      expect(databaseConfig.uri).toBe('mongodb://test-user:test-password@test-host:12345/test-db?authSource=admin');
      
      // Check loggingConfig
      expect(loggingConfig.level).toBe(2);
      
      // Check supportConfig
      expect(supportConfig.supportChatId).toBe('test-chat');
      expect(supportConfig.adminIds).toEqual([123, 456]);
      expect(supportConfig.notificationAlertThreshold).toBe(3);
      expect(supportConfig.maxNotificationRetries).toBe(3);
      
      // Check consolidated config
      expect(config.telegram).toBe(telegramConfig);
      expect(config.openai).toBe(openAIConfig);
      expect(config.database).toBe(databaseConfig);
      expect(config.logging).toBe(loggingConfig);
      expect(config.support).toBe(supportConfig);
    });
  });
  
  it('should generate MongoDB URI correctly without credentials', () => {
    (validateEnv as jest.Mock).mockReturnValue({
      TELEGRAM_API_TOKEN: 'test-token',
      OPENAI_API_KEY: 'test-key',
      GPT_VERSION: 'test-version',
      MONGODB_HOST: 'test-host',
      MONGODB_PORT: 12345,
      MONGODB_USER: '',
      MONGODB_PASSWORD: '',
      MONGODB_DATABASE: 'test-db',
      MONGO_EXPRESS_PORT: 8081,
      LOG_LEVEL: 2,
      MAX_VOICE_MESSAGE_LENGTH_SECONDS: 300,
      SUPPORT_CHAT_ID: 'test-chat',
      ADMIN_IDS: '123,456',
      NOTIFICATION_ALERT_THRESHOLD: 3,
      MAX_NOTIFICATION_RETRIES: 3
    });
    
    jest.isolateModules(() => {
      const { databaseConfig } = require('../index');
      expect(databaseConfig.uri).toBe('mongodb://test-host:12345/test-db');
    });
  });
}); 