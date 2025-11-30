import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

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

const mockHttpRequestHelper = {
  get: jest.fn(),
  post: jest.fn(),
  gpost: jest.fn(),
};

const mockHttpRequestHelperClass = jest.fn().mockImplementation(() => mockHttpRequestHelper);

await jest.unstable_mockModule('../../helpers/LogHelper.js', () => ({
  default: mockLogHelperClass,
}));

await jest.unstable_mockModule('../../helpers/CLSHelper.js', () => ({
  default: mockCLSHelper,
}));

await jest.unstable_mockModule('../../helpers/HttpRequestHelper.js', () => ({
  default: mockHttpRequestHelperClass,
}));

const { default: CoreAPI } = await import('../../core/CoreAPI.js');

describe('CoreAPI', () => {
  let coreAPI;
  let mockTenant;

  beforeEach(() => {
    mockTenant = {
      _id: 'test-tenant-id',
      name: 'test-tenant',
    };

    mockCLSHelper.get.mockReturnValue('test-trace-id');
    jest.clearAllMocks();
    coreAPI = new CoreAPI();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance', () => {
      expect(coreAPI.logger).toBeDefined();
      expect(coreAPI.traceId).toBe('test-trace-id');
    });

    it('should initialize httpRequest', () => {
      expect(mockHttpRequestHelperClass).toHaveBeenCalled();
      expect(coreAPI.httpRequest).toBeDefined();
    });

    it('should have httpRequest property', () => {
      expect(coreAPI.httpRequest).toBe(mockHttpRequestHelper);
    });
  });
});

