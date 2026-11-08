import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock dependencies before imports
const mockHttpRequest = {
  gpost: jest.fn(),
  get: jest.fn(),
  post: jest.fn(),
};

const mockCoreAPI = jest.fn().mockImplementation(() => ({
  httpRequest: mockHttpRequest,
}));

await jest.unstable_mockModule('../../core/CoreAPI.js', () => ({
  default: mockCoreAPI,
}));

const mockTokenService = { getAccessToken: jest.fn() };

await jest.unstable_mockModule('../../helpers/ShopifyTokenService.js', () => ({
  default: mockTokenService,
}));

const { default: ShopifyGqlAPI } = await import('../../apis/ShopifyGqlAPI.js');

describe('ShopifyGqlAPI', () => {
  let api;
  let mockTenant;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      SHOPIFY_API_VERSION: '2024-01',
      SHOPIFY_CLIENT_ID: 'test-client-id',
      SHOPIFY_CLIENT_SECRET: 'test-client-secret',
    };

    mockTenant = {
      shopify: {
        name: 'test-shop',
        decryptedApiKey: 'test-api-key',
      },
    };

    jest.clearAllMocks();
    api = new ShopifyGqlAPI(mockTenant);
    api.httpRequest = mockHttpRequest;
  });

  afterEach(() => {
    jest.clearAllMocks();
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('should initialize with tenant config', () => {
      expect(api.config).toEqual(mockTenant.shopify);
    });

    it('should handle undefined tenant', () => {
      const apiWithoutTenant = new ShopifyGqlAPI();
      expect(apiWithoutTenant.config).toBeUndefined();
    });
  });

  describe('query', () => {
    it('should execute GraphQL query with correct headers', async () => {
      const query = 'query { shop { name } }';
      const variables = { id: '123' };
      const mockResponse = {
        data: {
          data: {
            shop: {
              name: 'Test Shop',
            },
          },
        },
      };

      mockHttpRequest.gpost.mockResolvedValue(mockResponse);

      const result = await api.query(query, variables);

      expect(mockHttpRequest.gpost).toHaveBeenCalledWith(
        `https://${mockTenant.shopify.name}.myshopify.com/admin/api/${process.env.SHOPIFY_API_VERSION}/graphql.json`,
        {
          query,
          variables,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': mockTenant.shopify.decryptedApiKey,
          },
        }
      );
      expect(result).toEqual(mockResponse.data);
    });

    it('should execute GraphQL query without variables', async () => {
      const query = 'query { shop { name } }';
      const mockResponse = {
        data: {
          data: {
            shop: {
              name: 'Test Shop',
            },
          },
        },
      };

      mockHttpRequest.gpost.mockResolvedValue(mockResponse);

      const result = await api.query(query);

      expect(mockHttpRequest.gpost).toHaveBeenCalledWith(
        expect.any(String),
        {
          query,
          variables: undefined,
        },
        expect.any(Object)
      );
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle GraphQL errors', async () => {
      const query = 'query { invalid }';
      const mockErrorResponse = {
        data: {
          errors: [
            {
              message: 'Field "invalid" doesn\'t exist',
            },
          ],
        },
      };

      mockHttpRequest.gpost.mockResolvedValue(mockErrorResponse);

      const result = await api.query(query);

      expect(result).toEqual(mockErrorResponse.data);
    });
  });

  describe('getShopInfo', () => {
    it('should get shop info with correct headers', async () => {
      const shop = 'test-shop';
      const accessToken = 'test-access-token';
      const mockResponse = {
        data: {
          shop: {
            name: 'Test Shop',
            domain: 'test-shop.myshopify.com',
            email: 'test@example.com',
          },
        },
      };

      mockHttpRequest.get.mockResolvedValue(mockResponse);

      const result = await api.getShopInfo(shop, accessToken);

      expect(mockHttpRequest.get).toHaveBeenCalledWith(
        `https://${shop}.myshopify.com/admin/api/${process.env.SHOPIFY_API_VERSION}/shop.json`,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': accessToken,
          },
        }
      );
      expect(result).toEqual(mockResponse.data.shop);
    });

    it('should handle different shop names', async () => {
      const shop = 'another-shop';
      const accessToken = 'test-access-token';
      const mockResponse = {
        data: {
          shop: {
            name: 'Another Shop',
          },
        },
      };

      mockHttpRequest.get.mockResolvedValue(mockResponse);

      const result = await api.getShopInfo(shop, accessToken);

      expect(mockHttpRequest.get).toHaveBeenCalledWith(
        `https://${shop}.myshopify.com/admin/api/${process.env.SHOPIFY_API_VERSION}/shop.json`,
        expect.any(Object)
      );
      expect(result).toEqual(mockResponse.data.shop);
    });

    it('should handle API errors', async () => {
      const shop = 'test-shop';
      const accessToken = 'invalid-token';
      const error = new Error('Unauthorized');

      mockHttpRequest.get.mockRejectedValue(error);

      await expect(api.getShopInfo(shop, accessToken)).rejects.toThrow('Unauthorized');
    });
  });

  describe('getAccessToken', () => {
    it('should get access token with token exchange grant', async () => {
      const shop = 'test-shop';
      const idToken = 'test-id-token';
      const mockResponse = {
        data: {
          access_token: 'test-access-token',
        },
      };

      mockHttpRequest.post.mockResolvedValue(mockResponse);

      const result = await api.getAccessToken(shop, idToken);

      // The implementation adds .myshopify.com to the shop parameter
      expect(mockHttpRequest.post).toHaveBeenCalledWith(
        `https://${shop}.myshopify.com/admin/oauth/access_token`,
        {
          client_id: process.env.SHOPIFY_CLIENT_ID,
          client_secret: process.env.SHOPIFY_CLIENT_SECRET,
          grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
          subject_token: idToken,
          subject_token_type: 'urn:ietf:params:oauth:token-type:id_token',
          requested_token_type: 'urn:shopify:params:oauth:token-type:online-access-token',
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      expect(result).toBe('test-access-token');
    });

    it('should handle different id tokens', async () => {
      const shop = 'test-shop';
      const idToken = 'another-id-token';
      const mockResponse = {
        data: {
          access_token: 'another-access-token',
        },
      };

      mockHttpRequest.post.mockResolvedValue(mockResponse);

      const result = await api.getAccessToken(shop, idToken);

      expect(result).toBe('another-access-token');
    });

    it('should handle OAuth errors', async () => {
      const shop = 'test-shop';
      const idToken = 'invalid-token';
      const error = new Error('Invalid token');

      mockHttpRequest.post.mockRejectedValue(error);

      await expect(api.getAccessToken(shop, idToken)).rejects.toThrow('Invalid token');
    });

    it('should use environment variables for client credentials', async () => {
      const shop = 'test-shop';
      const idToken = 'test-id-token';
      const mockResponse = {
        data: {
          access_token: 'token',
        },
      };

      mockHttpRequest.post.mockResolvedValue(mockResponse);

      await api.getAccessToken(shop, idToken);

      expect(mockHttpRequest.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          client_id: 'test-client-id',
          client_secret: 'test-client-secret',
        }),
        expect.any(Object)
      );
    });
  });

  describe('token resolution for stored tenants', () => {
    const unauthorized = () => Object.assign(new Error('Request failed with status code 401'), { response: { status: 401 } });

    beforeEach(() => {
      api.tenant = { id: 'tenant-1' };
      mockTokenService.getAccessToken.mockReset();
    });

    it('uses the token from ShopifyTokenService instead of the request-time copy', async () => {
      mockTokenService.getAccessToken.mockResolvedValue('shpat_service');
      mockHttpRequest.gpost.mockResolvedValue({ data: { data: { ok: true } } });

      await api.query('query { shop { id } }');

      expect(mockTokenService.getAccessToken).toHaveBeenCalledWith('tenant-1', 'test-shop.myshopify.com', { rejectedToken: undefined });
      expect(mockHttpRequest.gpost.mock.calls[0][2].headers['X-Shopify-Access-Token']).toBe('shpat_service');
    });

    it('falls back to the request-time token when the service has none', async () => {
      mockTokenService.getAccessToken.mockResolvedValue(null);
      mockHttpRequest.gpost.mockResolvedValue({ data: { data: {} } });

      await api.query('query { shop { id } }');

      expect(mockHttpRequest.gpost.mock.calls[0][2].headers['X-Shopify-Access-Token']).toBe('test-api-key');
    });

    it('retries once with a refreshed token after a 401', async () => {
      mockTokenService.getAccessToken
        .mockResolvedValueOnce('shpat_stale')
        .mockResolvedValueOnce('shpat_refreshed');
      mockHttpRequest.gpost
        .mockRejectedValueOnce(unauthorized())
        .mockResolvedValueOnce({ data: { data: { ok: true } } });

      const result = await api.query('query { shop { id } }');

      expect(result).toEqual({ data: { ok: true } });
      expect(mockTokenService.getAccessToken).toHaveBeenLastCalledWith('tenant-1', 'test-shop.myshopify.com', { rejectedToken: 'shpat_stale' });
      expect(mockHttpRequest.gpost.mock.calls[1][2].headers['X-Shopify-Access-Token']).toBe('shpat_refreshed');
    });

    it('rethrows the 401 when no newer token is available', async () => {
      mockTokenService.getAccessToken.mockResolvedValue('shpat_same');
      mockHttpRequest.gpost.mockRejectedValue(unauthorized());

      await expect(api.query('query { shop { id } }')).rejects.toThrow('401');
      expect(mockHttpRequest.gpost).toHaveBeenCalledTimes(1);
    });

    it('does not retry non-401 errors', async () => {
      mockTokenService.getAccessToken.mockResolvedValue('shpat_ok');
      mockHttpRequest.gpost.mockRejectedValue(Object.assign(new Error('boom'), { response: { status: 500 } }));

      await expect(api.query('query { shop { id } }')).rejects.toThrow('boom');
      expect(mockTokenService.getAccessToken).toHaveBeenCalledTimes(1);
    });
  });
});
