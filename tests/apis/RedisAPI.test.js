import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock dependencies before imports
const mockClient = {
  set: jest.fn(),
  get: jest.fn(),
  keys: jest.fn(),
  del: jest.fn(),
  flushDb: jest.fn(),
};

const mockClientProvider = jest.fn().mockImplementation(() => ({
  client: mockClient,
}));

await jest.unstable_mockModule('../../cache/ClientProvider.js', () => ({
  default: mockClientProvider,
}));

await jest.unstable_mockModule('../../core/CoreAPI.js', () => ({
  default: jest.fn().mockImplementation(() => ({})),
}));

const { default: RedisAPI } = await import('../../apis/RedisAPI.js');

describe('RedisAPI', () => {
  let api;

  beforeEach(() => {
    jest.clearAllMocks();
    api = new RedisAPI(0);
    api.client = mockClient;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('setCache', () => {
    it('should set cache with key and value', async () => {
      const key = 'test-key';
      const value = 'test-value';

      await api.setCache(key, value);

      expect(mockClient.set).toHaveBeenCalledWith(key, value);
    });

    it('should set cache with JSON value', async () => {
      const key = 'test-key';
      const value = { name: 'test', id: 123 };

      await api.setCache(key, value);

      expect(mockClient.set).toHaveBeenCalledWith(key, value);
    });
  });

  describe('getCache', () => {
    it('should return cached value when key exists', async () => {
      const key = 'test-key';
      const value = 'test-value';
      mockClient.get.mockResolvedValue(value);

      const result = await api.getCache(key);

      expect(mockClient.get).toHaveBeenCalledWith(key);
      expect(result).toBe(value);
    });

    it('should return null when key does not exist', async () => {
      const key = 'non-existent-key';
      mockClient.get.mockResolvedValue(null);

      const result = await api.getCache(key);

      expect(mockClient.get).toHaveBeenCalledWith(key);
      expect(result).toBeNull();
    });

    it('should return null when key returns empty string', async () => {
      const key = 'empty-key';
      mockClient.get.mockResolvedValue('');

      const result = await api.getCache(key);

      expect(result).toBeNull();
    });
  });

  describe('getAllCache', () => {
    it('should return all cached values matching pattern', async () => {
      const key = 'test-prefix';
      const keys = ['test-prefix:1', 'test-prefix:2', 'test-prefix:3'];
      const values = [
        JSON.stringify({ id: 1, name: 'item1' }),
        JSON.stringify({ id: 2, name: 'item2' }),
        JSON.stringify({ id: 3, name: 'item3' }),
      ];

      mockClient.keys.mockResolvedValue(keys);
      mockClient.get
        .mockResolvedValueOnce(values[0])
        .mockResolvedValueOnce(values[1])
        .mockResolvedValueOnce(values[2]);

      const result = await api.getAllCache(key);

      expect(mockClient.keys).toHaveBeenCalledWith(`${key}:*`);
      expect(result).toEqual([
        { key: keys[0], value: { id: 1, name: 'item1' } },
        { key: keys[1], value: { id: 2, name: 'item2' } },
        { key: keys[2], value: { id: 3, name: 'item3' } },
      ]);
    });

    it('should return empty array when no keys match pattern', async () => {
      const key = 'non-existent-prefix';
      mockClient.keys.mockResolvedValue([]);

      const result = await api.getAllCache(key);

      expect(mockClient.keys).toHaveBeenCalledWith(`${key}:*`);
      expect(result).toEqual([]);
    });

    it('should handle invalid JSON gracefully', async () => {
      const key = 'test-prefix';
      const keys = ['test-prefix:1'];
      const invalidJson = 'invalid-json{';

      mockClient.keys.mockResolvedValue(keys);
      mockClient.get.mockResolvedValue(invalidJson);

      await expect(api.getAllCache(key)).rejects.toThrow();
    });
  });

  describe('deleteCache', () => {
    it('should delete cache by key', async () => {
      const key = 'test-key';

      await api.deleteCache(key);

      expect(mockClient.del).toHaveBeenCalledWith(key);
    });

    it('should delete cache successfully', async () => {
      const key = 'test-key';
      mockClient.del.mockResolvedValue(1);

      await api.deleteCache(key);

      expect(mockClient.del).toHaveBeenCalledWith(key);
    });
  });

  describe('flushCache', () => {
    it('should flush all cache from database', async () => {
      await api.flushCache();

      expect(mockClient.flushDb).toHaveBeenCalled();
    });

    it('should flush cache successfully', async () => {
      mockClient.flushDb.mockResolvedValue('OK');

      await api.flushCache();

      expect(mockClient.flushDb).toHaveBeenCalled();
    });
  });

  describe('lock', () => {
    it('should acquire lock when key is not locked', async () => {
      const key = 'lock-key';
      mockClient.set.mockResolvedValue('OK');

      const result = await api.lock(key);

      expect(mockClient.set).toHaveBeenCalledWith(key, '1', { NX: true, EX: 1000 });
      expect(result).toBe(true);
    });

    it('should return false when key is already locked', async () => {
      const key = 'lock-key';
      mockClient.set.mockResolvedValue(null);

      const result = await api.lock(key);

      expect(mockClient.set).toHaveBeenCalledWith(key, '1', { NX: true, EX: 1000 });
      expect(result).toBe(false);
    });

    it('should return false when set returns undefined', async () => {
      const key = 'lock-key';
      mockClient.set.mockResolvedValue(undefined);

      const result = await api.lock(key);

      expect(result).toBe(false);
    });
  });

  describe('unlock', () => {
    it('should unlock by deleting the key', async () => {
      const key = 'lock-key';

      await api.unlock(key);

      expect(mockClient.del).toHaveBeenCalledWith(key);
    });

    it('should unlock successfully', async () => {
      const key = 'lock-key';
      mockClient.del.mockResolvedValue(1);

      await api.unlock(key);

      expect(mockClient.del).toHaveBeenCalledWith(key);
    });
  });
});

