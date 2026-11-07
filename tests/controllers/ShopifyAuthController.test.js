import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import HttpStatusCodes from '../../enums/HttpStatusCodes.js';

const mockTenant = {
  findOne: jest.fn(),
};

const mockCoreController = {
  response: jest.fn(),
  httpRequest: {
    post: jest.fn(),
  },
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
};

await jest.unstable_mockModule('../../models/db/postgres/Tenant.js', () => ({
  default: mockTenant,
}));

await jest.unstable_mockModule('../../apis/ShopifyGqlAPI.js', () => ({
  default: jest.fn(),
}));

await jest.unstable_mockModule('../../helpers/CryptoHelper.js', () => ({
  default: { hashKey: jest.fn(() => 'hashed-token') },
}));

await jest.unstable_mockModule('../../business/shopify/StoreBusiness.js', () => ({
  default: jest.fn(),
}));

await jest.unstable_mockModule('../../helpers/SystemHelper.js', () => ({
  default: { createTransaction: jest.fn((_meta, _key, work) => work()) },
}));

await jest.unstable_mockModule('../../models/db/postgres/SuccessOrder.js', () => ({
  default: {},
}));

await jest.unstable_mockModule('../../models/db/postgres/FailedOrder.js', () => ({
  default: {},
}));

await jest.unstable_mockModule('../../models/db/postgres/RequestLog.js', () => ({
  default: {},
}));

await jest.unstable_mockModule('../../models/db/postgres/OrderSyncBatch.js', () => ({
  default: {},
}));

await jest.unstable_mockModule('../../cache/NebimCache.js', () => ({
  default: jest.fn(),
}));

await jest.unstable_mockModule('../../cache/ShopifyCache.js', () => ({
  default: jest.fn(),
}));

await jest.unstable_mockModule('../../enums/SystemCodes.js', () => ({
  default: {},
}));

await jest.unstable_mockModule('../../business/shopify/BillingBusiness.js', () => ({
  default: jest.fn(),
}));

await jest.unstable_mockModule('../../helpers/LogHelper.js', () => ({
  default: jest.fn().mockImplementation(() => ({ info2: jest.fn(), warn: jest.fn(), error: jest.fn() })),
}));

const mockTokenService = { storeTokens: jest.fn() };

await jest.unstable_mockModule('../../helpers/ShopifyTokenService.js', () => ({
  default: mockTokenService,
}));

await jest.unstable_mockModule('../../helpers/SubscriptionPlanMap.js', () => ({
  resolveSubscriptionPlan: jest.fn(),
  planBillingLimits: jest.fn(),
}));

await jest.unstable_mockModule('../../core/CoreControler.js', () => ({
  default: jest.fn().mockImplementation(() => mockCoreController),
}));

const { default: ShopifyAuthController } = await import('../../controllers/ShopifyAuthController.js');
const { default: AppTokenHelper } = await import('../../helpers/AppTokenHelper.js');

describe('ShopifyAuthController.storeOfflineToken', () => {
  const mockRes = {};
  const tenant = { id: 'tenant-1', name: 'demo-store' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('stores the pair for the authenticated tenant', async () => {
    mockTokenService.storeTokens.mockResolvedValue({ stored: true });
    const body = {
      accessToken: 'shpat_new',
      accessTokenExpiresAt: '2026-11-07T18:00:00.000Z',
      refreshToken: 'shprt_new',
      refreshTokenExpiresAt: '2027-02-05T17:00:00.000Z',
    };

    await ShopifyAuthController.storeOfflineToken({ tenant, body }, mockRes);

    expect(mockTokenService.storeTokens).toHaveBeenCalledWith('tenant-1', body);
    expect(mockCoreController.response).toHaveBeenCalledWith(mockRes, {
      status: HttpStatusCodes.SUCCESS,
      content: { stored: true },
    });
  });

  it('rejects a request without an access token', async () => {
    await ShopifyAuthController.storeOfflineToken({ tenant, body: { refreshToken: 'shprt' } }, mockRes);

    expect(mockTokenService.storeTokens).not.toHaveBeenCalled();
    expect(mockCoreController.response).toHaveBeenCalledWith(mockRes, {
      status: HttpStatusCodes.BAD_REQUEST,
      info: 'accessToken is required',
    });
  });
});

describe('ShopifyAuthController.initializeTenant app token checks', () => {
  const SECRET = 'test-app-secret';
  let mockRes;

  beforeEach(() => {
    process.env.SHOPIFY_CLIENT_SECRET = SECRET;
    mockRes = {};
    jest.clearAllMocks();
  });

  const request = (bearerShop, name, secret = SECRET) => ({
    headers: {
      authorization: `Bearer ${AppTokenHelper.mint(bearerShop, { secret })}`,
      'x-shopify-access-token': 'shpat_offline',
    },
    body: { name },
  });

  it('rejects a bearer token with an invalid signature', async () => {
    await ShopifyAuthController.initializeTenant(request('demo-store.myshopify.com', 'demo-store', 'wrong'), mockRes);

    expect(mockCoreController.response).toHaveBeenCalledWith(mockRes, expect.objectContaining({
      status: HttpStatusCodes.UNAUTHORIZED,
      info: 'Unauthorized access: Invalid token signature',
    }));
  });

  it('rejects a body tenant name that differs from the authenticated shop', async () => {
    await ShopifyAuthController.initializeTenant(request('demo-store.myshopify.com', 'victim-store'), mockRes);

    expect(mockCoreController.response).toHaveBeenCalledWith(mockRes, expect.objectContaining({
      status: HttpStatusCodes.UNAUTHORIZED,
      info: 'Tenant name does not match the authenticated shop',
    }));
  });
});

describe('ShopifyAuthController consent webhooks', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    process.env.INTEGRATION_API_HOST = 'http://integration-api/rest/integration/v1';

    mockReq = {
      get: jest.fn().mockReturnValue('test-shop.myshopify.com'),
      body: {},
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      type: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    jest.clearAllMocks();
    mockReq.get.mockReturnValue('test-shop.myshopify.com');
    mockCoreController.response.mockReturnValue(mockRes);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleEmailConsent', () => {
    it('should forward subscribed email consent to integration-api', async () => {
      mockReq.body = {
        email_address: 'bob@biller.com',
        email_marketing_consent: {
          state: 'subscribed',
          consent_updated_at: '2024-02-01T12:30:00Z',
        },
      };
      mockTenant.findOne.mockResolvedValue({ id: 'tenant-1' });
      mockCoreController.httpRequest.post.mockResolvedValue({
        data: { content: { CustomerCode: 'CUST001' } },
      });

      await ShopifyAuthController.handleEmailConsent(mockReq, mockRes);

      expect(mockCoreController.httpRequest.post).toHaveBeenCalledWith(
        'http://integration-api/rest/integration/v1/shopify/nebim/customer/consent/email',
        {
          email: 'bob@biller.com',
          phone: undefined,
          consents: {
            email: {
              date: '2024-02-01T12:30:00Z',
              is_opt_in: true,
            },
          },
        },
        {
          headers: {
            'x-tenant-id': 'tenant-1',
          },
        },
      );
      expect(mockCoreController.response).toHaveBeenCalledWith(mockRes, {
        isSuccess: true,
        status: HttpStatusCodes.SUCCESS,
        content: { CustomerCode: 'CUST001' },
      });
    });

    it('should ack Shopify when customer is not in Nebim', async () => {
      mockReq.body = {
        email_address: 'bob@biller.com',
        email_marketing_consent: {
          state: 'subscribed',
          consent_updated_at: '2024-02-01T12:30:00Z',
        },
      };
      mockTenant.findOne.mockResolvedValue({ id: 'tenant-1' });
      mockCoreController.httpRequest.post.mockRejectedValue({
        response: { status: 404 },
      });

      await ShopifyAuthController.handleEmailConsent(mockReq, mockRes);

      expect(mockCoreController.response).toHaveBeenCalledWith(mockRes, {
        isSuccess: true,
        status: HttpStatusCodes.SUCCESS,
        info: 'Customer not found in Nebim',
      });
    });

    it('should return bad request when email is missing', async () => {
      mockReq.body = {
        email_marketing_consent: {
          state: 'subscribed',
          consent_updated_at: '2024-02-01T12:30:00Z',
        },
      };
      mockTenant.findOne.mockResolvedValue({ id: 'tenant-1' });

      await ShopifyAuthController.handleEmailConsent(mockReq, mockRes);

      expect(mockCoreController.httpRequest.post).not.toHaveBeenCalled();
      expect(mockCoreController.response).toHaveBeenCalledWith(mockRes, {
        isSuccess: false,
        status: HttpStatusCodes.BAD_REQUEST,
        info: 'Missing email_address',
      });
    });

    it('should return bad request when consent_updated_at is missing', async () => {
      mockReq.body = {
        email_address: 'bob@biller.com',
        email_marketing_consent: {
          state: 'not_subscribed',
          consent_updated_at: null,
        },
      };
      mockTenant.findOne.mockResolvedValue({ id: 'tenant-1' });

      await ShopifyAuthController.handleEmailConsent(mockReq, mockRes);

      expect(mockCoreController.httpRequest.post).not.toHaveBeenCalled();
      expect(mockCoreController.response).toHaveBeenCalledWith(mockRes, {
        isSuccess: false,
        status: HttpStatusCodes.BAD_REQUEST,
        info: 'Missing consent_updated_at',
      });
    });
  });

  describe('handleGsmConsent', () => {
    it('should return bad request when phone is missing', async () => {
      mockReq.body = {
        phone: null,
        sms_marketing_consent: {
          state: 'subscribed',
          consent_updated_at: '2024-02-02T08:15:00Z',
        },
      };
      mockTenant.findOne.mockResolvedValue({ id: 'tenant-1' });

      await ShopifyAuthController.handleGsmConsent(mockReq, mockRes);

      expect(mockCoreController.httpRequest.post).not.toHaveBeenCalled();
      expect(mockCoreController.response).toHaveBeenCalledWith(mockRes, {
        isSuccess: false,
        status: HttpStatusCodes.BAD_REQUEST,
        info: 'Missing phone',
      });
    });
  });
});
