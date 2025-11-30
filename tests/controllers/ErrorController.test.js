import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import HttpStatusCodes from '../../enums/HttpStatusCodes.js';

// Mock dependencies before imports
const mockCoreController = {
  response: jest.fn(),
};

const mockCoreControllerClass = jest.fn().mockImplementation(() => mockCoreController);

const mockClientError = class ClientError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ClientError';
  }
};

await jest.unstable_mockModule('../../core/CoreControler.js', () => ({
  default: mockCoreControllerClass,
}));

await jest.unstable_mockModule('../../models/error/ClientError.js', () => ({
  default: mockClientError,
}));

const { default: ErrorController } = await import('../../controllers/ErrorController.js');

describe('ErrorController', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockReq = {
      url: '/test/url',
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      type: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('notFound', () => {
    it('should return NOT_FOUND status with URL info', async () => {
      await ErrorController.notFound(mockReq, mockRes);

      expect(mockCoreController.response).toHaveBeenCalledWith(mockRes, {
        status: HttpStatusCodes.NOT_FOUND,
        info: `Requested url: ${mockReq.url} not found`,
      });
    });
  });

  describe('errorHandler', () => {
    it('should return BAD_REQUEST for ClientError', async () => {
      const error = new mockClientError('Client error message');

      await ErrorController.errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockCoreController.response).toHaveBeenCalledWith(mockRes, {
        status: HttpStatusCodes.BAD_REQUEST,
        info: 'Client error message',
      });
    });

    it('should return SERVER_ERROR for non-ClientError', async () => {
      const error = new Error('Server error');

      await ErrorController.errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockCoreController.response).toHaveBeenCalledWith(mockRes, {
        status: HttpStatusCodes.SERVER_ERROR,
        error,
      });
    });
  });
});

