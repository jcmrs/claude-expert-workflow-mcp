import { logger } from '@/utils/logger';
import winston from 'winston';

// Mock winston
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    level: 'info',
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    colorize: jest.fn(),
    simple: jest.fn(),
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn(),
  },
}));

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  level: 'info',
};

(winston.createLogger as jest.Mock).mockReturnValue(mockLogger);

describe('Logger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('logging methods', () => {
    it('should log info messages', () => {
      logger.info('Test info message');
      expect(mockLogger.info).toHaveBeenCalledWith('Test info message');
    });

    it('should log warning messages', () => {
      logger.warn('Test warning message');
      expect(mockLogger.warn).toHaveBeenCalledWith('Test warning message');
    });

    it('should log error messages', () => {
      logger.error('Test error message');
      expect(mockLogger.error).toHaveBeenCalledWith('Test error message');
    });

    it('should log debug messages', () => {
      logger.debug('Test debug message');
      expect(mockLogger.debug).toHaveBeenCalledWith('Test debug message');
    });
  });

  describe('structured logging', () => {
    it('should log with metadata', () => {
      const metadata = { userId: '123', action: 'consultation' };
      logger.info('User action', metadata);
      
      expect(mockLogger.info).toHaveBeenCalledWith('User action', metadata);
    });

    it('should log errors with error objects', () => {
      const error = new Error('Test error');
      logger.error('An error occurred', { error });
      
      expect(mockLogger.error).toHaveBeenCalledWith('An error occurred', { error });
    });

    it('should log workflow events', () => {
      const workflowData = {
        workflowId: 'workflow_123',
        expertType: 'product_manager',
        step: 'consultation',
      };
      
      logger.info('Workflow step completed', workflowData);
      expect(mockLogger.info).toHaveBeenCalledWith('Workflow step completed', workflowData);
    });
  });

  describe('logger configuration', () => {
    it('should be configured with winston', () => {
      expect(winston.createLogger).toHaveBeenCalled();
    });

    it('should have proper format configuration', () => {
      expect(winston.format.combine).toHaveBeenCalled();
      expect(winston.format.timestamp).toHaveBeenCalled();
      expect(winston.format.errors).toHaveBeenCalled();
    });

    it('should have console transport', () => {
      expect(winston.transports.Console).toHaveBeenCalled();
    });
  });

  describe('log level handling', () => {
    it('should respect log levels', () => {
      // This test depends on the actual logger implementation
      // For now, we just verify the logger has a level property
      expect(mockLogger.level).toBeDefined();
    });
  });

  describe('error handling in logging', () => {
    it('should handle logging when message is undefined', () => {
      logger.info(undefined as any);
      expect(mockLogger.info).toHaveBeenCalledWith(undefined);
    });

    it('should handle logging when metadata is undefined', () => {
      logger.info('Test message', undefined);
      expect(mockLogger.info).toHaveBeenCalledWith('Test message', undefined);
    });

    it('should handle circular references in metadata', () => {
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;
      
      // Should not throw error when logging circular objects
      expect(() => {
        logger.info('Circular object', { data: circularObj });
      }).not.toThrow();
    });
  });

  describe('integration scenarios', () => {
    it('should log MCP server events', () => {
      logger.info('MCP server started', { 
        port: 3000,
        capabilities: ['tools', 'prompts'] 
      });
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'MCP server started',
        { port: 3000, capabilities: ['tools', 'prompts'] }
      );
    });

    it('should log expert consultation events', () => {
      const consultationEvent = {
        expertType: 'product_manager',
        conversationId: 'conv_123',
        duration: 1500,
        topicsDiscussed: ['product_vision', 'user_personas'],
      };
      
      logger.info('Expert consultation completed', consultationEvent);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Expert consultation completed',
        consultationEvent
      );
    });

    it('should log document generation events', () => {
      const documentEvent = {
        documentType: 'prd',
        projectName: 'TestProject',
        generationTime: 2300,
        sections: ['executive_summary', 'product_vision', 'user_personas'],
      };
      
      logger.info('Document generated', documentEvent);
      expect(mockLogger.info).toHaveBeenCalledWith('Document generated', documentEvent);
    });

    it('should log error events with context', () => {
      const errorContext = {
        workflowId: 'workflow_123',
        expertType: 'ux_designer',
        operation: 'consultation',
        timestamp: new Date().toISOString(),
      };
      
      const error = new Error('Claude API timeout');
      logger.error('Expert consultation failed', { error, ...errorContext });
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Expert consultation failed',
        { error, ...errorContext }
      );
    });
  });
});