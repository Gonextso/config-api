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
  default: {},
}));

await jest.unstable_mockModule('../../business/shopify/StoreBusiness.js', () => ({
  default: jest.fn(),
}));

await jest.unstable_mockModule('../../helpers/SystemHelper.js', () => ({
  default: {},
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
  default: jest.fn(),
}));

await jest.unstable_mockModule('../../helpers/SubscriptionPlanMap.js', () => ({
  resolveSubscriptionPlan: jest.fn(),
  planBillingLimits: jest.fn(),
}));

await jest.unstable_mockModule('../../core/CoreControler.js', () => ({
  default: jest.fn().mockImplementation(() => mockCoreController),
}));

const { default: ShopifyAuthController } = await import('../../controllers/ShopifyAuthController.js');

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
