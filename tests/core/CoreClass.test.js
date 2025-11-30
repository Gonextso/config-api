import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import ClientError from '../../models/error/ClientError.js';

// Mock dependencies before imports
const mockLogHelper = {
  info: jest.fn(),
  info2: jest.fn(),
  error: jest.fn(),
};

const mockLogHelperClass = jest.fn().mockImplementation(() => mockLogHelper);

const mockCLSHelper = {
  get: jest.fn(),
};

await jest.unstable_mockModule('../../helpers/LogHelper.js', () => ({
  default: mockLogHelperClass,
}));

await jest.unstable_mockModule('../../helpers/CLSHelper.js', () => ({
  default: mockCLSHelper,
}));

const { default: CoreClass } = await import('../../core/CoreClass.js');

describe('CoreClass', () => {
  let coreClass;
  let mockTenant;

  beforeEach(() => {
    mockTenant = {
      _id: 'test-tenant-id',
      name: 'test-tenant',
    };

    mockCLSHelper.get.mockReturnValue('test-trace-id');
    jest.clearAllMocks();
    coreClass = new CoreClass(mockTenant);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with tenant', () => {
      expect(coreClass.tenant).toEqual(mockTenant);
      expect(coreClass.logger).toBeDefined();
      expect(coreClass.traceId).toBe('test-trace-id');
    });

    it('should initialize logger with tenant', () => {
      expect(mockLogHelperClass).toHaveBeenCalledWith(mockTenant);
    });

    it('should get traceId from CLSHelper', () => {
      expect(mockCLSHelper.get).toHaveBeenCalledWith('traceId');
    });
  });

  describe('throws', () => {
    it('should throw Error by default', () => {
      expect(() => coreClass.throws('Test error')).toThrow('Test error');
      expect(() => coreClass.throws('Test error')).toThrow(Error);
    });

    it('should throw ClientError when isClientError is true', () => {
      expect(() => coreClass.throws('Client error', true)).toThrow('Client error');
      expect(() => coreClass.throws('Client error', true)).toThrow(ClientError);
    });

    it('should throw Error when isClientError is false', () => {
      expect(() => coreClass.throws('Server error', false)).toThrow('Server error');
      expect(() => coreClass.throws('Server error', false)).toThrow(Error);
    });
  });

  describe('exit', () => {
    let originalExit;
    let exitCode;

    beforeEach(() => {
      originalExit = process.exit;
      exitCode = null;
      process.exit = jest.fn((code) => {
        exitCode = code;
      });
    });

    afterEach(() => {
      process.exit = originalExit;
    });

    it('should log error and exit with code 1', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      coreClass.exit('Test exit reason');

      expect(consoleSpy).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(1);

      consoleSpy.mockRestore();
    });
  });
});

