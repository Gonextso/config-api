import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock dependencies before imports
const mockStoreQueries = {
  dummy: 'query { publications { nodes { id } } }',
};

const mockShopifyGqlAPI = {
  query: jest.fn(),
  getShopInfo: jest.fn(),
};

const mockShopifyGqlAPIClass = jest.fn().mockImplementation(() => mockShopifyGqlAPI);

const mockCoreClass = jest.fn().mockImplementation(() => ({
  tenant: {},
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

await jest.unstable_mockModule('../../../models/shopify/queries/store.js', () => ({
  default: mockStoreQueries,
}));

await jest.unstable_mockModule('../../../apis/ShopifyGqlAPI.js', () => ({
  default: mockShopifyGqlAPIClass,
}));

await jest.unstable_mockModule('../../../core/CoreClass.js', () => ({
  default: mockCoreClass,
}));

const { default: ShopifyStoreBusiness } = await import('../../../business/shopify/StoreBusiness.js');

describe('ShopifyStoreBusiness', () => {
  let business;
  let mockTenant;

  beforeEach(() => {
    mockTenant = {
      _id: 'test-tenant-id',
      name: 'test-tenant',
      shopify: {
        name: 'test-shop',
        decryptedApiKey: 'test-api-key',
      },
    };

    jest.clearAllMocks();
    business = new ShopifyStoreBusiness(mockTenant);
    business.api = mockShopifyGqlAPI;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with tenant and create ShopifyGqlAPI instance', () => {
      expect(mockShopifyGqlAPIClass).toHaveBeenCalledWith(mockTenant);
      expect(business.api).toBeDefined();
    });
  });

  describe('checkStore', () => {
    it('should return true when publications exist', async () => {
      const mockResponse = {
        data: {
          publications: {
            nodes: [{ id: '1' }, { id: '2' }],
          },
        },
      };

      mockShopifyGqlAPI.query.mockResolvedValue(mockResponse);

      const result = await business.checkStore();

      expect(mockShopifyGqlAPI.query).toHaveBeenCalledWith(mockStoreQueries.dummy);
      expect(result).toBe(true);
    });

    it('should return false when no publications exist', async () => {
      const mockResponse = {
        data: {
          publications: {
            nodes: [],
          },
        },
      };

      mockShopifyGqlAPI.query.mockResolvedValue(mockResponse);

      const result = await business.checkStore();

      expect(mockShopifyGqlAPI.query).toHaveBeenCalledWith(mockStoreQueries.dummy);
      expect(result).toBe(false);
    });

    it('should throw error when publications is null', async () => {
      const mockResponse = {
        data: {
          publications: null,
        },
      };

      mockShopifyGqlAPI.query.mockResolvedValue(mockResponse);

      await expect(business.checkStore()).rejects.toThrow();
    });
  });

  describe('getShop', () => {
    it('should get shop info using API', async () => {
      const shop = 'test-shop';
      const accessToken = 'test-access-token';
      const mockShopInfo = {
        name: 'Test Shop',
        domain: 'test-shop.myshopify.com',
        email: 'test@example.com',
      };

      mockShopifyGqlAPI.getShopInfo.mockResolvedValue(mockShopInfo);

      const result = await business.getShop(shop, accessToken);

      expect(mockShopifyGqlAPI.getShopInfo).toHaveBeenCalledWith(shop, accessToken);
      expect(result).toEqual(mockShopInfo);
    });

    it('should handle different shop names and tokens', async () => {
      const shop = 'another-shop';
      const accessToken = 'another-token';
      const mockShopInfo = {
        name: 'Another Shop',
      };

      mockShopifyGqlAPI.getShopInfo.mockResolvedValue(mockShopInfo);

      const result = await business.getShop(shop, accessToken);

      expect(mockShopifyGqlAPI.getShopInfo).toHaveBeenCalledWith(shop, accessToken);
      expect(result).toEqual(mockShopInfo);
    });

    it('should handle API errors', async () => {
      const shop = 'test-shop';
      const accessToken = 'invalid-token';
      const error = new Error('Unauthorized');

      mockShopifyGqlAPI.getShopInfo.mockRejectedValue(error);

      await expect(business.getShop(shop, accessToken)).rejects.toThrow('Unauthorized');
    });
  });
});

