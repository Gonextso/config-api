import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import HttpStatusCodes from '../../enums/HttpStatusCodes.js';

// Mock dependencies before imports
const mockCoreController = {
  response: jest.fn(),
};

const mockCoreControllerClass = jest.fn().mockImplementation(() => mockCoreController);

await jest.unstable_mockModule('../../core/CoreControler.js', () => ({
  default: mockCoreControllerClass,
}));

const { default: AnalyticsController } = await import('../../controllers/AnalyticsController.js');

describe('AnalyticsController', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: jest.fn().mockReturnThis(),
      type: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('get', () => {
    it('should return success status', async () => {
      await AnalyticsController.get(mockReq, mockRes);

      expect(mockCoreController.response).toHaveBeenCalledWith(mockRes, {
        status: HttpStatusCodes.SUCCESS,
      });
    });
  });
});

