import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock dependencies before imports
const mockCoreCache = jest.fn().mockImplementation((tenant) => ({
  tenant,
  redis: {},
}));

await jest.unstable_mockModule('../../core/CoreCache.js', () => ({
  default: mockCoreCache,
}));

const { default: SystemCache } = await import('../../cache/SystemCache.js');

describe('SystemCache', () => {
  let cache;
  let mockTenant;

  beforeEach(() => {
    mockTenant = {
      _id: 'test-tenant-id',
      name: 'test-tenant',
    };

    jest.clearAllMocks();
    cache = new SystemCache(mockTenant);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should extend CoreCache', () => {
      expect(mockCoreCache).toHaveBeenCalledWith(mockTenant);
      expect(cache.tenant).toEqual(mockTenant);
    });

    it('should have tenant property', () => {
      expect(cache.tenant).toBeDefined();
      expect(cache.tenant).toEqual(mockTenant);
    });
  });
});

