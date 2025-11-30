import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock dependencies before imports
const mockBillingQueries = {
  activeSub: 'query { currentAppInstallation { activeSubscriptions { id status } } }',
};

const mockShopifyGqlAPI = {
  query: jest.fn(),
};

const mockShopifyGqlAPIClass = jest.fn().mockImplementation(() => mockShopifyGqlAPI);

const mockCoreClass = jest.fn().mockImplementation(() => ({
  tenant: {},
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

await jest.unstable_mockModule('../../../models/shopify/queries/billing.js', () => ({
  default: mockBillingQueries,
}));

await jest.unstable_mockModule('../../../apis/ShopifyGqlAPI.js', () => ({
  default: mockShopifyGqlAPIClass,
}));

await jest.unstable_mockModule('../../../core/CoreClass.js', () => ({
  default: mockCoreClass,
}));

const { default: ShopifyBillingBusiness } = await import('../../../business/shopify/BillingBusiness.js');

describe('ShopifyBillingBusiness', () => {
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
    business = new ShopifyBillingBusiness(mockTenant);
    business.shopifyGqlAPI = mockShopifyGqlAPI;
    business.logger = {
      error: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with tenant and create ShopifyGqlAPI instance', () => {
      expect(mockShopifyGqlAPIClass).toHaveBeenCalledWith(mockTenant);
      expect(business.shopifyGqlAPI).toBeDefined();
    });
  });

  describe('getActiveSubscription', () => {
    it('should return active subscription when status is ACTIVE', async () => {
      const mockResponse = {
        data: {
          currentAppInstallation: {
            activeSubscriptions: [
              {
                id: 'sub-123',
                status: 'ACTIVE',
                name: 'Basic Plan',
              },
            ],
          },
        },
        errors: null,
      };

      mockShopifyGqlAPI.query.mockResolvedValue(mockResponse);

      const result = await business.getActiveSubscription();

      expect(mockShopifyGqlAPI.query).toHaveBeenCalledWith(mockBillingQueries.activeSub, {});
      expect(result).toEqual(mockResponse.data.currentAppInstallation.activeSubscriptions[0]);
    });

    it('should return empty string when no subscription exists', async () => {
      const mockResponse = {
        data: {
          currentAppInstallation: {
            activeSubscriptions: [],
          },
        },
        errors: null,
      };

      mockShopifyGqlAPI.query.mockResolvedValue(mockResponse);

      const result = await business.getActiveSubscription();

      expect(result).toBe('');
    });

    it('should return empty string when subscription status is not ACTIVE', async () => {
      const mockResponse = {
        data: {
          currentAppInstallation: {
            activeSubscriptions: [
              {
                id: 'sub-123',
                status: 'CANCELLED',
                name: 'Basic Plan',
              },
            ],
          },
        },
        errors: null,
      };

      mockShopifyGqlAPI.query.mockResolvedValue(mockResponse);

      const result = await business.getActiveSubscription();

      expect(result).toBe('');
    });

    it('should return empty string when subscription is null', async () => {
      const mockResponse = {
        data: {
          currentAppInstallation: {
            activeSubscriptions: [null],
          },
        },
        errors: null,
      };

      mockShopifyGqlAPI.query.mockResolvedValue(mockResponse);

      const result = await business.getActiveSubscription();

      expect(result).toBe('');
    });

    it('should return empty string and log error when GraphQL errors occur', async () => {
      const mockResponse = {
        data: null,
        errors: [
          { message: 'Error 1' },
          { message: 'Error 2' },
        ],
      };

      mockShopifyGqlAPI.query.mockResolvedValue(mockResponse);

      const result = await business.getActiveSubscription();

      expect(business.logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Error 1, Error 2',
        })
      );
      expect(result).toBe('');
    });

    it('should handle single GraphQL error', async () => {
      const mockResponse = {
        data: null,
        errors: [
          { message: 'Single error' },
        ],
      };

      mockShopifyGqlAPI.query.mockResolvedValue(mockResponse);

      const result = await business.getActiveSubscription();

      expect(business.logger.error).toHaveBeenCalled();
      expect(result).toBe('');
    });

    it('should return first active subscription when multiple exist', async () => {
      const mockResponse = {
        data: {
          currentAppInstallation: {
            activeSubscriptions: [
              {
                id: 'sub-1',
                status: 'ACTIVE',
                name: 'Plan 1',
              },
              {
                id: 'sub-2',
                status: 'ACTIVE',
                name: 'Plan 2',
              },
            ],
          },
        },
        errors: null,
      };

      mockShopifyGqlAPI.query.mockResolvedValue(mockResponse);

      const result = await business.getActiveSubscription();

      expect(result).toEqual(mockResponse.data.currentAppInstallation.activeSubscriptions[0]);
    });

    it('should handle API errors', async () => {
      const error = new Error('Network error');

      mockShopifyGqlAPI.query.mockRejectedValue(error);

      await expect(business.getActiveSubscription()).rejects.toThrow('Network error');
    });
  });
});

