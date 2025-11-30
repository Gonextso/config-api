import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import CacheDatabases from '../../enums/CacheDatabases.js';

// Mock dependencies before imports
const mockRedisAPI = {
  setCache: jest.fn(),
  getCache: jest.fn(),
  getAllCache: jest.fn(),
  deleteCache: jest.fn(),
  flushCache: jest.fn(),
  lock: jest.fn(),
  unlock: jest.fn(),
};

const mockRedisAPIClass = jest.fn().mockImplementation(() => mockRedisAPI);

const mockCoreClass = jest.fn().mockImplementation(() => ({
  tenant: {},
  logger: {
    info: jest.fn(),
    info2: jest.fn(),
    error: jest.fn(),
  },
  throws: jest.fn((message) => {
    throw new Error(message);
  }),
}));

await jest.unstable_mockModule('../../apis/RedisAPI.js', () => ({
  default: mockRedisAPIClass,
}));

await jest.unstable_mockModule('../../core/CoreClass.js', () => ({
  default: mockCoreClass,
}));

const { default: CoreCache } = await import('../../core/CoreCache.js');

describe('CoreCache', () => {
  let cache;
  let mockTenant;

  beforeEach(() => {
    mockTenant = {
      _id: 'test-tenant-id',
      name: 'test-tenant',
    };

    jest.clearAllMocks();
    cache = new CoreCache(mockTenant);
    cache.tenant = mockTenant;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with tenant', () => {
      expect(cache.tenant).toEqual(mockTenant);
      expect(cache.redis).toBeDefined();
    });

    it('should throw error when tenant is not provided', () => {
      expect(() => new CoreCache(null)).toThrow('tenant must be provided');
    });

    it('should initialize RedisAPI with database from constructor name', () => {
      // CoreCache constructor uses CacheDatabases.DB_NAMES[this.constructor.name]
      // which would be CacheDatabases.DB_NAMES['CoreCache']
      expect(mockRedisAPIClass).toHaveBeenCalled();
    });
  });

  describe('set', () => {
    it('should set string value', async () => {
      const key = 'test-key';
      const value = 'test-value';

      await cache.set(key, value);

      expect(mockRedisAPI.setCache).toHaveBeenCalledWith(
        `${mockTenant.name}:${key}`,
        value
      );
    });

    it('should stringify and set object value', async () => {
      const key = 'test-key';
      const value = { test: 'object' };

      await cache.set(key, value);

      expect(mockRedisAPI.setCache).toHaveBeenCalledWith(
        `${mockTenant.name}:${key}`,
        JSON.stringify(value)
      );
    });

    it('should handle nested objects', async () => {
      const key = 'test-key';
      const value = { nested: { data: 'value' } };

      await cache.set(key, value);

      expect(mockRedisAPI.setCache).toHaveBeenCalledWith(
        `${mockTenant.name}:${key}`,
        JSON.stringify(value)
      );
    });
  });

  describe('get', () => {
    it('should get string value', async () => {
      const key = 'test-key';
      const value = 'test-value';

      mockRedisAPI.getCache.mockResolvedValue(value);

      const result = await cache.get(key);

      expect(mockRedisAPI.getCache).toHaveBeenCalledWith(`${mockTenant.name}:${key}`);
      expect(result).toBe(value);
    });

    it('should parse JSON value when value contains {', async () => {
      const key = 'test-key';
      const value = JSON.stringify({ test: 'object' });

      mockRedisAPI.getCache.mockResolvedValue(value);

      const result = await cache.get(key);

      expect(result).toEqual({ test: 'object' });
    });

    it('should return string value when it does not contain {', async () => {
      const key = 'test-key';
      const value = 'simple-string';

      mockRedisAPI.getCache.mockResolvedValue(value);

      const result = await cache.get(key);

      expect(result).toBe(value);
    });

    it('should return null when value is null', async () => {
      const key = 'test-key';

      mockRedisAPI.getCache.mockResolvedValue(null);

      const result = await cache.get(key);

      expect(result).toBeNull();
    });
  });

  describe('getAll', () => {
    it('should get all cache with key prefix', async () => {
      const key = 'test-key';
      const mockValues = [
        { key: 'test-tenant:test-key:1', value: { data: 'value1' } },
      ];

      mockRedisAPI.getAllCache.mockResolvedValue(mockValues);

      const result = await cache.getAll(key);

      expect(mockRedisAPI.getAllCache).toHaveBeenCalledWith(
        `${mockTenant.name}:${key}`
      );
      expect(result).toEqual(mockValues);
    });

    it('should get all cache without key prefix', async () => {
      const mockValues = [
        { key: 'test-tenant:key1', value: { data: 'value1' } },
      ];

      mockRedisAPI.getAllCache.mockResolvedValue(mockValues);

      const result = await cache.getAll();

      expect(mockRedisAPI.getAllCache).toHaveBeenCalledWith(mockTenant.name);
      expect(result).toEqual(mockValues);
    });
  });

  describe('delete', () => {
    it('should delete cache by key', async () => {
      const key = 'test-key';

      await cache.delete(key);

      expect(mockRedisAPI.deleteCache).toHaveBeenCalledWith(
        `${mockTenant.name}:${key}`
      );
    });
  });

  describe('deleteAll', () => {
    it('should delete all cache with tenant prefix', async () => {
      await cache.deleteAll();

      expect(mockRedisAPI.deleteCache).toHaveBeenCalledWith(
        `${mockTenant.name}:*`
      );
    });
  });

  describe('flush', () => {
    it('should flush all cache', async () => {
      await cache.flush();

      expect(mockRedisAPI.flushCache).toHaveBeenCalled();
    });
  });

  describe('lock', () => {
    it('should lock with tenant prefix', async () => {
      const transactionId = 'transaction-123';
      mockRedisAPI.lock.mockResolvedValue(true);

      const result = await cache.lock(transactionId);

      expect(mockRedisAPI.lock).toHaveBeenCalledWith(
        `${mockTenant.name}:${transactionId}`
      );
      expect(result).toBe(true);
    });

    it('should return false when lock fails', async () => {
      const transactionId = 'transaction-123';
      mockRedisAPI.lock.mockResolvedValue(false);

      const result = await cache.lock(transactionId);

      expect(result).toBe(false);
    });
  });

  describe('unlock', () => {
    it('should unlock with tenant prefix', async () => {
      const transactionId = 'transaction-123';

      await cache.unlock(transactionId);

      expect(mockRedisAPI.unlock).toHaveBeenCalledWith(
        `${mockTenant.name}:${transactionId}`
      );
    });
  });
});

