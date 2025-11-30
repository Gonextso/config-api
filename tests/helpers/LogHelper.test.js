import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock dependencies before imports
const mockChalk = {
  green: jest.fn((str) => str),
  yellow: jest.fn((str) => str),
  red: jest.fn((str) => str),
  blue: jest.fn((str) => str),
  cyan: jest.fn((str) => str),
  magenta: jest.fn((str) => str),
  yellowBright: jest.fn((str) => str),
  blueBright: jest.fn((str) => str),
  rgb: jest.fn(() => (str) => str),
};

const mockCLSHelper = {
  get: jest.fn().mockReturnValue('test-trace-id'),
};

const mockStringHelper = {
  truncateString: jest.fn((str) => str),
};

await jest.unstable_mockModule('chalk', () => ({
  default: mockChalk,
}));

await jest.unstable_mockModule('../../helpers/CLSHelper.js', () => ({
  default: mockCLSHelper,
}));

await jest.unstable_mockModule('../../helpers/StringHelper.js', () => ({
  default: mockStringHelper,
}));

const { default: LogHelper } = await import('../../helpers/LogHelper.js');

describe('LogHelper', () => {
  let logger;
  let mockTenant;
  let consoleSpy;

  beforeEach(() => {
    mockTenant = {
      _id: 'test-tenant-id',
      name: 'test-tenant',
    };

    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    jest.clearAllMocks();
    logger = new LogHelper(mockTenant);
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should create instance with tenant', () => {
      expect(logger.tenant).toEqual(mockTenant);
    });

    it('should handle null tenant', () => {
      const loggerWithoutTenant = new LogHelper(null);
      expect(loggerWithoutTenant.tenant).toBeNull();
    });
  });

  describe('info', () => {
    it('should log info message', () => {
      logger.info('Test message');

      expect(consoleSpy).toHaveBeenCalled();
      expect(mockStringHelper.truncateString).toHaveBeenCalledWith('Test message');
    });
  });

  describe('info2', () => {
    it('should log info2 message', () => {
      logger.info2('Test message');

      expect(consoleSpy).toHaveBeenCalled();
      expect(mockStringHelper.truncateString).toHaveBeenCalledWith('Test message');
    });
  });

  describe('info3', () => {
    it('should log info3 message', () => {
      logger.info3('Test message');

      expect(consoleSpy).toHaveBeenCalled();
      expect(mockStringHelper.truncateString).toHaveBeenCalledWith('Test message');
    });
  });

  describe('info4', () => {
    it('should log info4 message', () => {
      logger.info4('Test message');

      expect(consoleSpy).toHaveBeenCalled();
      expect(mockStringHelper.truncateString).toHaveBeenCalledWith('Test message');
    });
  });

  describe('warn', () => {
    it('should log warning message', () => {
      logger.warn('Warning message');

      expect(consoleSpy).toHaveBeenCalled();
      expect(mockStringHelper.truncateString).toHaveBeenCalledWith('Warning message');
    });
  });

  describe('warn2', () => {
    it('should log warn2 message', () => {
      logger.warn2('Warning message');

      expect(consoleSpy).toHaveBeenCalled();
      expect(mockStringHelper.truncateString).toHaveBeenCalledWith('Warning message');
    });
  });

  describe('error', () => {
    it('should log error message', () => {
      const error = new Error('Test error');
      logger.error(error);

      expect(consoleSpy).toHaveBeenCalled();
      expect(mockStringHelper.truncateString).toHaveBeenCalled();
    });
  });

  describe('success', () => {
    it('should log success message', () => {
      logger.success('Success message');

      expect(consoleSpy).toHaveBeenCalled();
      expect(mockStringHelper.truncateString).toHaveBeenCalledWith('Success message');
    });
  });

  describe('success2', () => {
    it('should log success2 message', () => {
      logger.success2('Success message');

      expect(consoleSpy).toHaveBeenCalled();
      expect(mockStringHelper.truncateString).toHaveBeenCalledWith('Success message');
    });
  });

  describe('request', () => {
    it('should log request message', () => {
      logger.request('Request message');

      expect(consoleSpy).toHaveBeenCalled();
      expect(mockStringHelper.truncateString).toHaveBeenCalledWith('Request message');
    });
  });
});

