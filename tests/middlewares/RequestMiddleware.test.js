import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock dependencies before imports
const mockNamespace = {
  run: jest.fn((callback) => {
    callback();
  }),
  set: jest.fn(),
  get: jest.fn(),
};

const mockCLSHelper = {
  run: mockNamespace.run,
  set: mockNamespace.set,
  get: mockNamespace.get,
};

const mockStringHelper = {
  generateId: jest.fn().mockReturnValue('test-trace-id-123'),
};

await jest.unstable_mockModule('../../helpers/CLSHelper.js', () => ({
  default: mockCLSHelper,
}));

await jest.unstable_mockModule('../../helpers/StringHelper.js', () => ({
  default: mockStringHelper,
}));

const { default: RequestMiddleware } = await import('../../middlewares/RequestMiddleware.js');

describe('RequestMiddleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      setHeader: jest.fn(),
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('setTraceId', () => {
    it('should set trace ID in namespace and request', async () => {
      await RequestMiddleware.setTraceId(mockReq, mockRes, mockNext);

      expect(mockStringHelper.generateId).toHaveBeenCalled();
      expect(mockCLSHelper.run).toHaveBeenCalled();
      expect(mockCLSHelper.set).toHaveBeenCalledWith('traceId', 'test-trace-id-123');
      expect(mockReq.traceId).toBe('test-trace-id-123');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Trace-Id', 'test-trace-id-123');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should call next inside namespace.run callback', async () => {
      let callbackExecuted = false;
      mockCLSHelper.run.mockImplementation((callback) => {
        callback();
        callbackExecuted = true;
      });

      await RequestMiddleware.setTraceId(mockReq, mockRes, mockNext);

      expect(callbackExecuted).toBe(true);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should generate unique trace ID for each request', async () => {
      mockStringHelper.generateId
        .mockReturnValueOnce('trace-id-1')
        .mockReturnValueOnce('trace-id-2');

      await RequestMiddleware.setTraceId(mockReq, mockRes, mockNext);
      expect(mockReq.traceId).toBe('trace-id-1');

      const mockReq2 = {};
      const mockRes2 = { setHeader: jest.fn() };
      const mockNext2 = jest.fn();

      await RequestMiddleware.setTraceId(mockReq2, mockRes2, mockNext2);
      expect(mockReq2.traceId).toBe('trace-id-2');
    });
  });

  describe('setEcommerceIdAsShopify', () => {
    it('should set ecommerceId to shopify', async () => {
      await RequestMiddleware.setEcommerceIdAsShopify(mockReq, mockRes, mockNext);

      expect(mockReq.ecommerceId).toBe('shopify');
      expect(mockNext).toHaveBeenCalled();
    });
  });
});

