import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import HttpStatusCodes from '../../enums/HttpStatusCodes.js';
import mongoose from 'mongoose';

// Mock dependencies before imports
const mockTenant = {
  _id: '507f1f77bcf86cd799439011',
  name: 'test-tenant',
  shopify: {
    apiKey: {
      encryptedData: 'encrypted-data',
      iv: 'iv-value',
      authTag: 'auth-tag',
    },
  },
  nebim: {
    password: {
      encryptedData: 'encrypted-password',
      iv: 'iv-value',
      authTag: 'auth-tag',
    },
  },
};

const mockTenantModel = {
  findById: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(mockTenant),
  }),
};

const mockCryptoHelper = {
  decrypt: jest.fn().mockReturnValue('decrypted-api-key'),
};

const mockCoreController = {
  response: jest.fn(),
};

const mockCoreControllerClass = jest.fn().mockImplementation(() => mockCoreController);

await jest.unstable_mockModule('../../models/db/Tenant.js', () => ({
  default: mockTenantModel,
}));

await jest.unstable_mockModule('../../helpers/CryptoHelper.js', () => ({
  default: mockCryptoHelper,
}));

await jest.unstable_mockModule('../../core/CoreControler.js', () => ({
  default: mockCoreControllerClass,
}));

const { default: ConfigMiddleware } = await import('../../middlewares/ConfigMiddleware.js');

describe('ConfigMiddleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockReq = {
      headers: {},
      get: jest.fn(),
    };
    mockRes = {};
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('setConfigViaTenantId', () => {
    it('should set tenant config when valid tenant ID is provided', async () => {
      const tenantId = '507f1f77bcf86cd799439011';
      mockReq.headers['x-tenant-id'] = tenantId;

      await ConfigMiddleware.setConfigViaTenantId(mockReq, mockRes, mockNext);

      expect(mockTenantModel.findById).toHaveBeenCalledWith(tenantId);
      expect(mockCryptoHelper.decrypt).toHaveBeenCalledWith(mockTenant.shopify.apiKey);
      expect(mockReq.tenant).toBeDefined();
      expect(mockReq.tenant.shopify.decyrptedApiKey).toBe('decrypted-api-key');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should use req.get when header is not in headers object', async () => {
      const tenantId = '507f1f77bcf86cd799439011';
      mockReq.get.mockReturnValue(tenantId);

      await ConfigMiddleware.setConfigViaTenantId(mockReq, mockRes, mockNext);

      expect(mockReq.get).toHaveBeenCalledWith('x-tenant-id');
      expect(mockTenantModel.findById).toHaveBeenCalledWith(tenantId);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should return BAD_REQUEST when tenant ID is missing', async () => {
      await ConfigMiddleware.setConfigViaTenantId(mockReq, mockRes, mockNext);

      expect(mockCoreController.response).toHaveBeenCalledWith(mockRes, {
        status: HttpStatusCodes.BAD_REQUEST,
        info: "'x-tenant-id' header is required.",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return BAD_REQUEST when tenant ID is invalid ObjectId', async () => {
      mockReq.headers['x-tenant-id'] = 'invalid-id';

      await ConfigMiddleware.setConfigViaTenantId(mockReq, mockRes, mockNext);

      expect(mockCoreController.response).toHaveBeenCalledWith(mockRes, {
        status: HttpStatusCodes.BAD_REQUEST,
        info: 'Invalid mongo object id format.',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return NOT_FOUND when tenant is not found', async () => {
      const tenantId = '507f1f77bcf86cd799439011';
      mockReq.headers['x-tenant-id'] = tenantId;

      mockTenantModel.findById.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(null),
      });

      await ConfigMiddleware.setConfigViaTenantId(mockReq, mockRes, mockNext);

      expect(mockCoreController.response).toHaveBeenCalledWith(mockRes, {
        status: HttpStatusCodes.NOT_FOUND,
        info: 'Tenant not found.',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should select encrypted fields from tenant', async () => {
      const tenantId = '507f1f77bcf86cd799439011';
      mockReq.headers['x-tenant-id'] = tenantId;

      const selectMock = jest.fn().mockReturnThis();
      const leanMock = jest.fn().mockResolvedValue(mockTenant);
      
      mockTenantModel.findById.mockReturnValue({
        select: selectMock,
        lean: leanMock,
      });

      await ConfigMiddleware.setConfigViaTenantId(mockReq, mockRes, mockNext);

      expect(selectMock).toHaveBeenCalledWith('+shopify.apiKey.encryptedData');
      expect(selectMock).toHaveBeenCalledWith('+shopify.apiKey.iv');
      expect(selectMock).toHaveBeenCalledWith('+shopify.apiKey.authTag');
      // ConfigMiddleware only selects shopify.apiKey fields, not nebim.password
    });
  });
});

