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
  hashKey: jest.fn(),
};

const mockTenant = {
  save: jest.fn(),
  apiKey: '',
};

const mockTenantModel = jest.fn().mockImplementation((data) => ({
  ...data,
  ...mockTenant,
}));

mockTenantModel.deleteMany = jest.fn();

await jest.unstable_mockModule('../../core/CoreControler.js', () => ({
  default: mockCoreControllerClass,
}));

await jest.unstable_mockModule('../../helpers/CryptoHelper.js', () => ({
  default: mockCryptoHelper,
}));

await jest.unstable_mockModule('../../models/db/Tenant.js', () => ({
  default: mockTenantModel,
}));

const { default: AdminController } = await import('../../controllers/AdminController.js');

describe('AdminController', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    mockReq = {
      body: {},
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
    mockTenant.save.mockResolvedValue(undefined);
    mockTenantModel.deleteMany.mockResolvedValue({ deletedCount: 5 });
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
      expect(mockTenant.save).toHaveBeenCalled();
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
      expect(mockTenant.save).toHaveBeenCalled();
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
      expect(mockTenant.save).toHaveBeenCalled();
    });

    it('should create tenant without credentials', async () => {
      mockReq.body = {
        name: 'test-tenant',
      };

      await AdminController.createTestTenant(mockReq, mockRes);

      expect(mockCryptoHelper.encrypt).not.toHaveBeenCalled();
      expect(mockTenant.save).toHaveBeenCalled();
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
});

