import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import HttpStatusCodes from '../../enums/HttpStatusCodes.js';

// Mock dependencies before imports
const mockLogHelper = {
  info: jest.fn(),
  info2: jest.fn(),
  error: jest.fn(),
};

const mockLogHelperClass = jest.fn().mockImplementation(() => mockLogHelper);

const mockCLSHelper = {
  get: jest.fn(),
};

const mockHttpRequestHelper = {
  get: jest.fn(),
  post: jest.fn(),
  gpost: jest.fn(),
};

const mockHttpRequestHelperClass = jest.fn().mockImplementation(() => mockHttpRequestHelper);

await jest.unstable_mockModule('../../helpers/LogHelper.js', () => ({
  default: mockLogHelperClass,
}));

await jest.unstable_mockModule('../../helpers/CLSHelper.js', () => ({
  default: mockCLSHelper,
}));

await jest.unstable_mockModule('../../helpers/HttpRequestHelper.js', () => ({
  default: mockHttpRequestHelperClass,
}));

const { default: CoreController } = await import('../../core/CoreControler.js');

describe('CoreController', () => {
  let controller;
  let mockRes;

  beforeEach(() => {
    mockCLSHelper.get.mockReturnValue('test-trace-id');
    jest.clearAllMocks();
    controller = new CoreController();
    controller.logger = mockLogHelper;

    mockRes = {
      status: jest.fn().mockReturnThis(),
      type: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('response', () => {
    it('should send success response with content', async () => {
      const content = { data: 'test' };

      await controller.response(mockRes, {
        status: HttpStatusCodes.SUCCESS,
        content,
      });

      expect(mockRes.status).toHaveBeenCalledWith(HttpStatusCodes.SUCCESS.code);
      expect(mockRes.type).toHaveBeenCalledWith('json');
      expect(mockRes.send).toHaveBeenCalled();
      
      const sentData = JSON.parse(mockRes.send.mock.calls[0][0]);
      expect(sentData.statusCode).toBe(HttpStatusCodes.SUCCESS.code);
      expect(sentData.isSuccess).toBe(true);
      expect(sentData.content).toEqual(content);
    });

    it('should send error response with error object', async () => {
      const error = new Error('Test error');

      await controller.response(mockRes, {
        status: HttpStatusCodes.SERVER_ERROR,
        error,
      });

      expect(mockLogHelper.error).toHaveBeenCalledWith(error);
      expect(mockRes.status).toHaveBeenCalledWith(HttpStatusCodes.SERVER_ERROR.code);
      
      const sentData = JSON.parse(mockRes.send.mock.calls[0][0]);
      expect(sentData.statusCode).toBe(HttpStatusCodes.SERVER_ERROR.code);
      expect(sentData.isSuccess).toBe(false);
      expect(sentData.error.message).toBe('Test error');
    });

    it('should include error stack in dev/local environment', async () => {
      const originalEnv = process.env.ENV;
      process.env.ENV = 'dev';
      
      const error = new Error('Test error');
      error.stack = 'Error stack trace';

      await controller.response(mockRes, {
        status: HttpStatusCodes.SERVER_ERROR,
        error,
      });

      const sentData = JSON.parse(mockRes.send.mock.calls[0][0]);
      expect(sentData.error.stack).toBe('Error stack trace');

      process.env.ENV = originalEnv;
    });

    it('should not include error stack in production environment', async () => {
      const originalEnv = process.env.ENV;
      process.env.ENV = 'production';
      
      const error = new Error('Test error');
      error.stack = 'Error stack trace';

      await controller.response(mockRes, {
        status: HttpStatusCodes.SERVER_ERROR,
        error,
      });

      const sentData = JSON.parse(mockRes.send.mock.calls[0][0]);
      expect(sentData.error.stack).toBeUndefined();

      process.env.ENV = originalEnv;
    });

    it('should use default status and content when not provided', async () => {
      await controller.response(mockRes, {
        status: HttpStatusCodes.SUCCESS,
        content: {},
      });

      expect(mockRes.status).toHaveBeenCalledWith(HttpStatusCodes.SUCCESS.code);
      
      const sentData = JSON.parse(mockRes.send.mock.calls[0][0]);
      expect(sentData.statusCode).toBe(HttpStatusCodes.SUCCESS.code);
      expect(sentData.content).toEqual({});
    });

    it('should use info parameter when provided', async () => {
      await controller.response(mockRes, {
        status: HttpStatusCodes.SUCCESS,
        info: 'Custom info message',
      });

      const sentData = JSON.parse(mockRes.send.mock.calls[0][0]);
      expect(sentData.info).toBe('Custom info message');
    });

    it('should use status message when info not provided', async () => {
      await controller.response(mockRes, {
        status: HttpStatusCodes.SUCCESS,
      });

      const sentData = JSON.parse(mockRes.send.mock.calls[0][0]);
      expect(sentData.info).toBe(HttpStatusCodes.SUCCESS.message);
    });

    it('should handle string content', async () => {
      await controller.response(mockRes, {
        status: HttpStatusCodes.SUCCESS,
        content: 'string content',
      });

      const sentData = JSON.parse(mockRes.send.mock.calls[0][0]);
      expect(sentData.content).toBe('string content');
    });

    it('should handle null content', async () => {
      await controller.response(mockRes, {
        status: HttpStatusCodes.SUCCESS,
        content: null,
      });

      const sentData = JSON.parse(mockRes.send.mock.calls[0][0]);
      expect(sentData.content).toEqual({});
    });

    it('should include headers when provided', async () => {
      const headers = { 'X-Custom-Header': 'value' };

      await controller.response(mockRes, {
        status: HttpStatusCodes.SUCCESS,
        headers,
      });

      const sentData = JSON.parse(mockRes.send.mock.calls[0][0]);
      expect(sentData.headers).toEqual(headers);
    });

    it('should throw error when res is missing', async () => {
      await expect(controller.response(null, {
        status: HttpStatusCodes.SUCCESS,
      })).rejects.toThrow('Check required parameters');
    });

    it('should throw error when status is missing', async () => {
      await expect(controller.response(mockRes, {})).rejects.toThrow('Check required parameters');
    });
  });
});

