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

const mockCoreClass = jest.fn().mockImplementation((tenant) => ({
  tenant,
  logger: mockLogHelper,
  traceId: 'test-trace-id',
}));

await jest.unstable_mockModule('../../helpers/LogHelper.js', () => ({
  default: mockLogHelperClass,
}));

await jest.unstable_mockModule('../../helpers/CLSHelper.js', () => ({
  default: mockCLSHelper,
}));

await jest.unstable_mockModule('../../core/CoreClass.js', () => ({
  default: mockCoreClass,
}));

const { default: CoreHelper } = await import('../../core/CoreHelper.js');

describe('CoreHelper', () => {
  let helper;
  let mockTenant;

  beforeEach(() => {
    mockTenant = {
      _id: 'test-tenant-id',
      name: 'test-tenant',
    };

    mockCLSHelper.get.mockReturnValue('test-trace-id');
    jest.clearAllMocks();
    helper = new CoreHelper();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should extend CoreClass', () => {
      expect(mockCoreClass).toHaveBeenCalled();
      expect(helper.logger).toBeDefined();
      expect(helper.traceId).toBe('test-trace-id');
    });
  });
});

