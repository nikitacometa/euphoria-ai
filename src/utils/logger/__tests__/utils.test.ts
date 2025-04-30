import { LogLevel } from '../types';
import { createErrorContext, createRequestContext, parseLogLevel } from '../utils';

describe('Logger Utils', () => {
  describe('parseLogLevel', () => {
    it('should parse numeric log levels', () => {
      expect(parseLogLevel(0)).toBe(LogLevel.ERROR);
      expect(parseLogLevel(1)).toBe(LogLevel.WARN);
      expect(parseLogLevel(2)).toBe(LogLevel.INFO);
      expect(parseLogLevel(3)).toBe(LogLevel.DEBUG);
    });
    
    it('should parse string numeric log levels', () => {
      expect(parseLogLevel('0')).toBe(LogLevel.ERROR);
      expect(parseLogLevel('1')).toBe(LogLevel.WARN);
      expect(parseLogLevel('2')).toBe(LogLevel.INFO);
      expect(parseLogLevel('3')).toBe(LogLevel.DEBUG);
    });
    
    it('should parse string name log levels', () => {
      expect(parseLogLevel('error')).toBe(LogLevel.ERROR);
      expect(parseLogLevel('warn')).toBe(LogLevel.WARN);
      expect(parseLogLevel('info')).toBe(LogLevel.INFO);
      expect(parseLogLevel('debug')).toBe(LogLevel.DEBUG);
    });
    
    it('should be case-insensitive for string names', () => {
      expect(parseLogLevel('ERROR')).toBe(LogLevel.ERROR);
      expect(parseLogLevel('Warn')).toBe(LogLevel.WARN);
      expect(parseLogLevel('InFo')).toBe(LogLevel.INFO);
      expect(parseLogLevel('Debug')).toBe(LogLevel.DEBUG);
    });
    
    it('should handle invalid inputs', () => {
      expect(parseLogLevel(undefined)).toBe(LogLevel.INFO); // Default
      expect(parseLogLevel(null as unknown as string)).toBe(LogLevel.INFO);
      expect(parseLogLevel(5)).toBe(LogLevel.INFO); // Out of range
      expect(parseLogLevel('invalid')).toBe(LogLevel.INFO);
    });
    
    it('should respect custom defaults', () => {
      expect(parseLogLevel(undefined, LogLevel.ERROR)).toBe(LogLevel.ERROR);
      expect(parseLogLevel('invalid', LogLevel.DEBUG)).toBe(LogLevel.DEBUG);
    });
  });
  
  describe('createErrorContext', () => {
    it('should extract error properties', () => {
      const error = new Error('Test error');
      error.name = 'TestError';
      
      const context = createErrorContext(error);
      
      expect(context.errorName).toBe('TestError');
      expect(context.errorMessage).toBe('Test error');
      expect(context.errorStack).toBe(error.stack);
    });
    
    it('should include custom error context', () => {
      const error = new Error('Test error');
      (error as any).context = { userId: '123', requestId: 'req1' };
      
      const context = createErrorContext(error);
      
      expect(context.userId).toBe('123');
      expect(context.requestId).toBe('req1');
    });
  });
  
  describe('createRequestContext', () => {
    it('should extract request properties', () => {
      const req = {
        id: 'req123',
        method: 'GET',
        path: '/api/users',
        ip: '127.0.0.1'
      };
      
      const context = createRequestContext(req);
      
      expect(context.requestId).toBe('req123');
      expect(context.method).toBe('GET');
      expect(context.path).toBe('/api/users');
      expect(context.ip).toBe('127.0.0.1');
    });
    
    it('should handle alternative property names', () => {
      const req = {
        requestId: 'req456',
        url: '/api/products'
      };
      
      const context = createRequestContext(req);
      
      expect(context.requestId).toBe('req456');
      expect(context.path).toBe('/api/products');
    });
    
    it('should generate a requestId if not provided', () => {
      const req = {
        method: 'POST'
      };
      
      const context = createRequestContext(req);
      
      expect(context.requestId).toMatch(/^req_\d+_[a-z0-9]+$/);
      expect(context.method).toBe('POST');
    });
    
    it('should handle minimal or empty requests', () => {
      const context = createRequestContext({});
      
      expect(context.requestId).toMatch(/^req_\d+_[a-z0-9]+$/);
      expect(context.method).toBe('UNKNOWN');
      expect(context.path).toBe('UNKNOWN');
      expect(context.ip).toBe('UNKNOWN');
    });
  });
}); 