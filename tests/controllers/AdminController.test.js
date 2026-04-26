import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import HttpStatusCodes from '../../enums/HttpStatusCodes.js';

// Mock dependencies before imports
const mockCoreController = {
  response: jest.fn(),
};

const mockCoreControllerClass = jest.fn().mockImplementation(() => mockCoreController);

const mockCryptoHelper = {
  encrypt: jest.fn(),
  generateHashedKey: jest.fn(),
};

const mockTenantModel = {
  find: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  updateOne: jest.fn(),
  deleteMany: jest.fn(),
};

const mockOrderSyncBatchModel = {
  find: jest.fn(),
  findOne: jest.fn(),
};

const mockRequestLogModel = {
  find: jest.fn(),
  distinctUrls: jest.fn(),
  findOne: jest.fn(),
};

const mockUuidHelper = {
  isValidUuid: jest.fn(),
};

await jest.unstable_mockModule('../../core/CoreControler.js', () => ({
  default: mockCoreControllerClass,
}));

await jest.unstable_mockModule('../../helpers/CryptoHelper.js', () => ({
  default: mockCryptoHelper,
}));

await jest.unstable_mockModule('../../models/db/postgres/Tenant.js', () => ({
  default: mockTenantModel,
}));

await jest.unstable_mockModule('../../models/db/postgres/OrderSyncBatch.js', () => ({
  default: mockOrderSyncBatchModel,
}));

await jest.unstable_mockModule('../../models/db/postgres/RequestLog.js', () => ({
  default: mockRequestLogModel,
}));

await jest.unstable_mockModule('../../helpers/UuidHelper.js', () => ({
  default: mockUuidHelper,
}));

const { default: AdminController } = await import('../../controllers/AdminController.js');

describe('AdminController', () => {
  let mockReq;
  let mockRes;
  const tenantId = '550e8400-e29b-41d4-a716-446655440000';
  const mockTenant = {
    id: tenantId,
    name: 'Test Tenant',
    shopify: {
      billing: {
        planKey: 'PRO',
        limits: {
          order: { used: 20 },
          product_details: { used: 55 },
        },
      },
      schedules: {
        nebim: {
          product: {
            inventory: { isActive: true },
            details: { isActive: false },
          },
          order: {
            create_and_cancel: { isActive: true },
            status: { isActive: false },
          },
        },
        redention: {
          logs: { isActive: true },
        },
      },
    },
  };

  beforeEach(() => {
    mockReq = {
      body: {},
      params: {},
      query: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      type: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();
    mockCryptoHelper.encrypt.mockReturnValue({
      encryptedData: 'encrypted',
      iv: 'iv',
      authTag: 'tag',
    });
    mockCryptoHelper.generateHashedKey.mockReturnValue({
      hash: 'hashed-key',
      key: 'decoded-key',
    });
    mockUuidHelper.isValidUuid.mockReturnValue(true);
    mockTenantModel.findById.mockResolvedValue(mockTenant);
    mockTenantModel.find.mockResolvedValue([mockTenant]);
    mockTenantModel.create.mockResolvedValue(mockTenant);
    mockTenantModel.updateOne.mockResolvedValue(mockTenant);
    mockTenantModel.deleteMany.mockResolvedValue({ deletedCount: 5 });
    mockOrderSyncBatchModel.find.mockResolvedValue([]);
    mockOrderSyncBatchModel.findOne.mockResolvedValue(null);
    mockRequestLogModel.find.mockResolvedValue([]);
    mockRequestLogModel.distinctUrls.mockResolvedValue([]);
    mockRequestLogModel.findOne.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('health', () => {
    it('should return success status', async () => {
      await AdminController.health(mockReq, mockRes);

      expect(mockCoreController.response).toHaveBeenCalledWith(mockRes, {
        status: HttpStatusCodes.SUCCESS,
      });
    });
  });

  describe('createTestTenant', () => {
    it('should create tenant with encrypted shopify apiKey', async () => {
      mockReq.body = {
        name: 'test-tenant',
        shopify: {
          apiKey: 'plain-api-key',
        },
      };

      await AdminController.createTestTenant(mockReq, mockRes);

      expect(mockCryptoHelper.encrypt).toHaveBeenCalledWith('plain-api-key');
      expect(mockCryptoHelper.generateHashedKey).toHaveBeenCalled();
      expect(mockTenantModel.create).toHaveBeenCalled();
      expect(mockCoreController.response).toHaveBeenCalledWith(mockRes, {
        status: HttpStatusCodes.CREATED,
        content: {
          tenant: expect.any(Object),
          decodedApiKey: 'decoded-key',
        },
      });
    });

    it('should create tenant with encrypted nebim password', async () => {
      mockReq.body = {
        name: 'test-tenant',
        nebim: {
          password: 'plain-password',
        },
      };

      await AdminController.createTestTenant(mockReq, mockRes);

      expect(mockCryptoHelper.encrypt).toHaveBeenCalledWith('plain-password');
      expect(mockTenantModel.create).toHaveBeenCalled();
    });

    it('should create tenant with both shopify and nebim credentials', async () => {
      mockReq.body = {
        name: 'test-tenant',
        shopify: {
          apiKey: 'plain-api-key',
        },
        nebim: {
          password: 'plain-password',
        },
      };

      await AdminController.createTestTenant(mockReq, mockRes);

      expect(mockCryptoHelper.encrypt).toHaveBeenCalledTimes(2);
      expect(mockTenantModel.create).toHaveBeenCalled();
    });

    it('should create tenant without credentials', async () => {
      mockReq.body = {
        name: 'test-tenant',
      };

      await AdminController.createTestTenant(mockReq, mockRes);

      expect(mockCryptoHelper.encrypt).not.toHaveBeenCalled();
      expect(mockTenantModel.create).toHaveBeenCalled();
    });
  });

  describe('deleteAllTenants', () => {
    it('should delete all tenants', async () => {
      await AdminController.deleteAllTenants(mockReq, mockRes);

      expect(mockTenantModel.deleteMany).toHaveBeenCalledWith({});
      expect(mockCoreController.response).toHaveBeenCalledWith(mockRes, {
        status: HttpStatusCodes.SUCCESS,
        content: { message: 'All tenants deleted successfully.' },
      });
    });
  });

  describe('new admin endpoints', () => {
    it('should return tenants list', async () => {
      await AdminController.getTenants(mockReq, mockRes);
      expect(mockTenantModel.find).toHaveBeenCalledWith({});
      expect(mockCoreController.response).toHaveBeenCalledWith(mockRes, {
        status: HttpStatusCodes.SUCCESS,
        content: [{ id: tenantId, name: 'Test Tenant' }],
      });
    });

    it('should return BAD_REQUEST for invalid tenant id', async () => {
      mockUuidHelper.isValidUuid.mockReturnValue(false);
      mockReq.params = { tenant_id: 'bad-id' };
      await AdminController.getTenantById(mockReq, mockRes);
      expect(mockCoreController.response).toHaveBeenCalledWith(mockRes, {
        status: HttpStatusCodes.BAD_REQUEST,
        info: 'Invalid UUID format.',
      });
    });

    it('should return paged logs for tenant', async () => {
      mockReq.params = { tenant_id: tenantId };
      mockReq.query = {};
      mockRequestLogModel.find.mockResolvedValue([{ id: 'log-1' }]);
      mockRequestLogModel.distinctUrls.mockResolvedValue(['/orders/sync']);
      await AdminController.getTenantLogs(mockReq, mockRes);
      expect(mockRequestLogModel.find).toHaveBeenCalledWith({
        tenant: tenantId,
        url: undefined,
        method: undefined,
        status: undefined,
        traceId: undefined,
      });
      expect(mockCoreController.response).toHaveBeenCalledWith(mockRes, {
        status: HttpStatusCodes.SUCCESS,
        content: {
          urls: ['/orders/sync'],
          statuses: [],
          data: [{ id: 'log-1' }],
        },
      });
    });

    it('should patch tenant billing', async () => {
      mockReq.params = { tenant_id: tenantId };
      mockReq.body = { billing: { planKey: 'COMMUNITY' } };
      await AdminController.patchTenantBilling(mockReq, mockRes);
      expect(mockTenantModel.updateOne).toHaveBeenCalledWith(
        { id: tenantId },
        { shopify: { billing: { planKey: 'COMMUNITY' } } },
      );
      expect(mockCoreController.response).toHaveBeenCalledWith(mockRes, {
        status: HttpStatusCodes.SUCCESS,
        content: mockTenant.shopify.billing,
      });
    });

    it('should return job detail by id', async () => {
      mockReq.params = { tenant_id: tenantId, job_id: 'job-1' };
      mockOrderSyncBatchModel.findOne.mockResolvedValue({ id: 'job-1', process: 'SYNC_ORDERS' });
      await AdminController.getTenantJobById(mockReq, mockRes);
      expect(mockOrderSyncBatchModel.findOne).toHaveBeenCalledWith({ id: 'job-1', tenant: tenantId });
      expect(mockCoreController.response).toHaveBeenCalledWith(mockRes, {
        status: HttpStatusCodes.SUCCESS,
        content: { id: 'job-1', process: 'SYNC_ORDERS' },
      });
    });
  });
});

