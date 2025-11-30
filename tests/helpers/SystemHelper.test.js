import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock dependencies before imports
const mockSystemCache = {
  lock: jest.fn(),
  unlock: jest.fn(),
};

const mockSystemCacheClass = jest.fn().mockImplementation(() => mockSystemCache);

const mockLogHelper = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

const mockCoreClass = jest.fn().mockImplementation(() => ({
  logger: mockLogHelper,
}));

await jest.unstable_mockModule('../../cache/SystemCache.js', () => ({
  default: mockSystemCacheClass,
}));

await jest.unstable_mockModule('../../core/CoreClass.js', () => ({
  default: mockCoreClass,
}));

const { default: SystemHelper } = await import('../../helpers/SystemHelper.js');

describe('SystemHelper', () => {
  let mockTenant;

  beforeEach(() => {
    mockTenant = {
      _id: 'test-tenant-id',
      name: 'test-tenant',
    };

    SystemHelper.logger = mockLogHelper;
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createTransaction', () => {
    it('should execute work when lock is acquired', async () => {
      const transactionId = 'test-transaction-id';
      const workResult = 'work-result';
      const work = jest.fn().mockResolvedValue(workResult);

      mockSystemCache.lock.mockResolvedValue(true);
      mockSystemCache.unlock.mockResolvedValue(undefined);

      const result = await SystemHelper.createTransaction(mockTenant, transactionId, work);

      expect(mockSystemCacheClass).toHaveBeenCalledWith(mockTenant);
      expect(mockSystemCache.lock).toHaveBeenCalledWith(transactionId);
      expect(work).toHaveBeenCalled();
      expect(mockSystemCache.unlock).toHaveBeenCalledWith(transactionId);
      expect(result).toBe(workResult);
    });

    it('should return undefined when lock is not acquired', async () => {
      const transactionId = 'test-transaction-id';
      const work = jest.fn().mockResolvedValue('work-result');

      mockSystemCache.lock.mockResolvedValue(false);

      const result = await SystemHelper.createTransaction(mockTenant, transactionId, work);

      expect(mockSystemCache.lock).toHaveBeenCalledWith(transactionId);
      expect(work).not.toHaveBeenCalled();
      expect(mockSystemCache.unlock).not.toHaveBeenCalled();
      expect(mockLogHelper.warn).toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it('should unlock even if work throws error', async () => {
      const transactionId = 'test-transaction-id';
      const error = new Error('Work error');
      const work = jest.fn().mockRejectedValue(error);

      mockSystemCache.lock.mockResolvedValue(true);
      mockSystemCache.unlock.mockResolvedValue(undefined);

      await expect(SystemHelper.createTransaction(mockTenant, transactionId, work)).rejects.toThrow('Work error');

      expect(mockSystemCache.unlock).toHaveBeenCalledWith(transactionId);
    });
  });

  describe('wait', () => {
    it('should wait for specified milliseconds', async () => {
      jest.useFakeTimers();
      
      const waitPromise = SystemHelper.wait(1000);

      // Verify that setTimeout was called (it's called internally)
      expect(jest.getTimerCount()).toBe(1);

      jest.advanceTimersByTime(1000);
      await waitPromise;

      jest.useRealTimers();
    });
  });
});

