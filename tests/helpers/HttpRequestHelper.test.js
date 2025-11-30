import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock dependencies before imports
const mockAxios = {
  get: jest.fn(),
  post: jest.fn(),
  isAxiosError: jest.fn(),
};

const mockStringHelper = {
  generateUUID: jest.fn().mockReturnValue('test-uuid-123'),
  truncateString: jest.fn((str) => str),
};

const mockLogHelper = {
  info3: jest.fn(),
  info4: jest.fn(),
  error: jest.fn(),
};

const mockCoreHelper = jest.fn().mockImplementation(() => ({
  logger: mockLogHelper,
}));

await jest.unstable_mockModule('axios', () => ({
  default: mockAxios,
  isAxiosError: mockAxios.isAxiosError,
}));

await jest.unstable_mockModule('../../helpers/StringHelper.js', () => ({
  default: mockStringHelper,
}));

await jest.unstable_mockModule('../../core/CoreHelper.js', () => ({
  default: mockCoreHelper,
}));

const { default: HttpRequestHelper } = await import('../../helpers/HttpRequestHelper.js');

describe('HttpRequestHelper', () => {
  let helper;

  beforeEach(() => {
    jest.clearAllMocks();
    helper = new HttpRequestHelper();
    helper.logger = mockLogHelper;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('get', () => {
    it('should make GET request and log response', async () => {
      const url = 'https://api.example.com/data';
      const response = {
        status: 200,
        data: { result: 'success' },
      };

      mockAxios.get.mockResolvedValue(response);

      const result = await helper.get(url);

      expect(mockStringHelper.generateUUID).toHaveBeenCalled();
      expect(mockAxios.get).toHaveBeenCalledWith(url);
      expect(mockLogHelper.info4).toHaveBeenCalled();
      expect(mockLogHelper.info3).toHaveBeenCalled();
      expect(result).toEqual(response);
    });

    it('should handle GET request with config', async () => {
      const url = 'https://api.example.com/data';
      const config = {
        headers: {
          Authorization: 'Bearer token123',
        },
      };
      const response = {
        status: 200,
        data: { result: 'success' },
      };

      mockAxios.get.mockResolvedValue(response);

      await helper.get(url, config);

      expect(mockAxios.get).toHaveBeenCalledWith(url, config);
    });

    it('should mask tokens in headers', async () => {
      const url = 'https://api.example.com/data';
      const config = {
        headers: {
          Authorization: 'Bearer secret-token',
          'X-Api-Token': 'api-token-123',
        },
      };
      const response = {
        status: 200,
        data: { result: 'success' },
      };

      mockAxios.get.mockResolvedValue(response);

      await helper.get(url, config);

      expect(mockLogHelper.info4).toHaveBeenCalled();
      const logCall = mockLogHelper.info4.mock.calls[0][0];
      expect(logCall).toContain('masked_by_gonextso');
    });
  });

  describe('post', () => {
    it('should make POST request and log response', async () => {
      const url = 'https://api.example.com/data';
      const data = { key: 'value' };
      const response = {
        status: 201,
        data: { result: 'created' },
      };

      mockAxios.post.mockResolvedValue(response);

      const result = await helper.post(url, data);

      expect(mockStringHelper.generateUUID).toHaveBeenCalled();
      expect(mockAxios.post).toHaveBeenCalledWith(url, data);
      expect(mockLogHelper.info4).toHaveBeenCalled();
      expect(mockLogHelper.info3).toHaveBeenCalled();
      expect(result).toEqual(response);
    });
  });

  describe('gpost', () => {
    it('should make POST request with gpost method', async () => {
      const url = 'https://api.example.com/data';
      const data = { key: 'value' };
      const response = {
        status: 201,
        data: { result: 'created' },
      };

      mockAxios.post.mockResolvedValue(response);

      const result = await helper.gpost(url, data);

      expect(mockStringHelper.generateUUID).toHaveBeenCalled();
      expect(mockAxios.post).toHaveBeenCalledWith(url, data);
      expect(mockLogHelper.info4).toHaveBeenCalled();
      expect(mockLogHelper.info3).toHaveBeenCalled();
      expect(result).toEqual(response);
    });
  });

  describe('error handling', () => {
    it('should handle axios errors', async () => {
      const url = 'https://api.example.com/data';
      const error = new Error('Network error');

      mockAxios.get.mockRejectedValue(error);

      await expect(helper.get(url)).rejects.toThrow('Network error');
      expect(mockLogHelper.error).toHaveBeenCalledWith(error);
    });

    it('should log processing time', async () => {
      const url = 'https://api.example.com/data';
      const response = {
        status: 200,
        data: { result: 'success' },
      };

      mockAxios.get.mockResolvedValue(response);

      await helper.get(url);

      expect(mockLogHelper.info3).toHaveBeenCalled();
      const logCalls = mockLogHelper.info3.mock.calls;
      const processingTimeCall = logCalls.find(call => call[0].includes('Processed in'));
      expect(processingTimeCall).toBeDefined();
    });
  });
});

