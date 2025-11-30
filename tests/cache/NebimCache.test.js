import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import CacheFields from '../../enums/CacheFields.js';

// Mock dependencies before imports
const mockCoreCache = {
  get: jest.fn(),
  logger: {
    info: jest.fn(),
  },
};

const mockCoreCacheClass = jest.fn().mockImplementation((tenant) => {
  const instance = {
    ...mockCoreCache,
    tenant,
  };
  return instance;
});

const mockStringHelper = {
  compareStrings: jest.fn(),
};

await jest.unstable_mockModule('../../core/CoreCache.js', () => ({
  default: mockCoreCacheClass,
}));

await jest.unstable_mockModule('../../helpers/StringHelper.js', () => ({
  default: mockStringHelper,
}));

const { default: NebimCache } = await import('../../cache/NebimCache.js');

describe('NebimCache', () => {
  let cache;
  let mockTenant;

  beforeEach(() => {
    mockTenant = {
      _id: 'test-tenant-id',
      name: 'test-tenant',
    };

    jest.clearAllMocks();
    cache = new NebimCache(mockTenant);
    cache.get = mockCoreCache.get;
    cache.logger = mockCoreCache.logger;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAddressCode', () => {
    it('should find address code matching city and district', async () => {
      const allAddressCodes = [
        {
          CityDescription: 'Istanbul',
          DistrictDescription: 'Kadikoy',
          Code: 'IST-KAD',
        },
        {
          CityDescription: 'Ankara',
          DistrictDescription: 'Cankaya',
          Code: 'ANK-CAN',
        },
      ];

      mockCoreCache.get.mockResolvedValue(allAddressCodes);
      mockStringHelper.compareStrings
        .mockReturnValueOnce(true) // DistrictDescription match
        .mockReturnValueOnce(true); // CityDescription match

      const result = await cache.findAddressCode({
        city: 'Istanbul',
        district: 'Kadikoy',
      });

      expect(mockCoreCache.get).toHaveBeenCalledWith(CacheFields.NEBIM.ADDRESS_CODES);
      expect(mockStringHelper.compareStrings).toHaveBeenCalledWith('Kadikoy', 'Kadikoy');
      expect(mockStringHelper.compareStrings).toHaveBeenCalledWith('Istanbul', 'Istanbul');
      expect(result).toEqual(allAddressCodes[0]);
    });

    it('should return undefined when no matching address found', async () => {
      const allAddressCodes = [
        {
          CityDescription: 'Istanbul',
          DistrictDescription: 'Kadikoy',
          Code: 'IST-KAD',
        },
      ];

      mockCoreCache.get.mockResolvedValue(allAddressCodes);
      mockStringHelper.compareStrings.mockReturnValue(false);

      const result = await cache.findAddressCode({
        city: 'Ankara',
        district: 'Cankaya',
      });

      expect(result).toBeUndefined();
    });

    it('should handle empty address codes array', async () => {
      mockCoreCache.get.mockResolvedValue([]);

      const result = await cache.findAddressCode({
        city: 'Istanbul',
        district: 'Kadikoy',
      });

      expect(mockCoreCache.get).toHaveBeenCalledWith(CacheFields.NEBIM.ADDRESS_CODES);
      expect(result).toBeUndefined();
    });

    it('should handle null address codes', async () => {
      mockCoreCache.get.mockResolvedValue(null);

      const result = await cache.findAddressCode({
        city: 'Istanbul',
        district: 'Kadikoy',
      });

      expect(result).toBeUndefined();
    });

    it('should log address count', async () => {
      const allAddressCodes = [
        { CityDescription: 'Istanbul', DistrictDescription: 'Kadikoy' },
        { CityDescription: 'Ankara', DistrictDescription: 'Cankaya' },
      ];

      mockCoreCache.get.mockResolvedValue(allAddressCodes);
      mockStringHelper.compareStrings.mockReturnValue(false);

      await cache.findAddressCode({
        city: 'Istanbul',
        district: 'Kadikoy',
      });

      expect(cache.logger.info).toHaveBeenCalledWith('2 addresses fetched from cache');
    });
  });
});

