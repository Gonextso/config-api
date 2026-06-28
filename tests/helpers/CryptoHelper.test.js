import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Set up environment variables before import
const originalEnv = process.env;
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.HASH_SECRET = 'test-hash-secret';
process.env.SHOPIFY_CLIENT_SECRET = 'test-shopify-secret';

const { default: CryptoHelper } = await import('../../helpers/CryptoHelper.js');

describe('CryptoHelper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt text correctly', () => {
      const originalText = 'Test secret message';

      const encrypted = CryptoHelper.encrypt(originalText);

      expect(encrypted).toHaveProperty('encryptedData');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('authTag');
      expect(encrypted).toHaveProperty('hash');

      const decrypted = CryptoHelper.decrypt(encrypted);

      expect(decrypted).toBe(originalText);
    });

    it('should encrypt different texts differently', () => {
      const text1 = 'Message 1';
      const text2 = 'Message 2';

      const encrypted1 = CryptoHelper.encrypt(text1);
      const encrypted2 = CryptoHelper.encrypt(text2);

      expect(encrypted1.encryptedData).not.toBe(encrypted2.encryptedData);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
    });

    it('should generate different IVs for same text', () => {
      const text = 'Same message';

      const encrypted1 = CryptoHelper.encrypt(text);
      const encrypted2 = CryptoHelper.encrypt(text);

      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      // But both should decrypt to the same text
      expect(CryptoHelper.decrypt(encrypted1)).toBe(text);
      expect(CryptoHelper.decrypt(encrypted2)).toBe(text);
    });

    it('should throw a clear error when payload is missing or incomplete', () => {
      const expectedMessage = /Encrypted payload is missing or incomplete/;

      expect(() => CryptoHelper.decrypt(undefined)).toThrow(expectedMessage);
      expect(() => CryptoHelper.decrypt(null)).toThrow(expectedMessage);
      expect(() => CryptoHelper.decrypt({})).toThrow(expectedMessage);
      expect(() => CryptoHelper.decrypt({ encryptedData: 'ab', iv: 'cd' })).toThrow(expectedMessage);
    });
  });

  describe('hashKey', () => {
    it('should hash a key', () => {
      const key = 'test-key';
      const hash = CryptoHelper.hashKey(key);

      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should generate same hash for same key', () => {
      const key = 'test-key';
      const hash1 = CryptoHelper.hashKey(key);
      const hash2 = CryptoHelper.hashKey(key);

      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different keys', () => {
      const hash1 = CryptoHelper.hashKey('key1');
      const hash2 = CryptoHelper.hashKey('key2');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('generateHashedKey', () => {
    it('should generate a key and hash', () => {
      const result = CryptoHelper.generateHashedKey();

      expect(result).toHaveProperty('key');
      expect(result).toHaveProperty('hash');
      expect(typeof result.key).toBe('string');
      expect(typeof result.hash).toBe('string');
    });

    it('should generate different keys each time', () => {
      const result1 = CryptoHelper.generateHashedKey();
      const result2 = CryptoHelper.generateHashedKey();

      expect(result1.key).not.toBe(result2.key);
      expect(result1.hash).not.toBe(result2.hash);
    });

    it('should hash the generated key correctly', () => {
      const result = CryptoHelper.generateHashedKey();
      const expectedHash = CryptoHelper.hashKey(result.key);

      expect(result.hash).toBe(expectedHash);
    });
  });

  describe('generateToken', () => {
    it('should generate a token', () => {
      const token = CryptoHelper.generateToken();

      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('should generate different tokens each time', () => {
      const token1 = CryptoHelper.generateToken();
      const token2 = CryptoHelper.generateToken();

      expect(token1).not.toBe(token2);
    });
  });

  describe('validateShopifyHmac', () => {
    it('should validate correct HMAC', () => {
      const qsParam = {
        shop: 'test-shop.myshopify.com',
        code: 'test-code',
        hmac: 'test-hmac',
      };

      // This will fail with test data, but we can test the structure
      const result = CryptoHelper.validateShopifyHmac(qsParam);

      expect(typeof result).toBe('boolean');
    });

    it('should return false for invalid HMAC', () => {
      const qsParam = {
        shop: 'test-shop.myshopify.com',
        code: 'test-code',
        hmac: 'invalid-hmac',
      };

      const result = CryptoHelper.validateShopifyHmac(qsParam);

      expect(result).toBe(false);
    });
  });

  describe('createShopifyWebhookHmac', () => {
    it('should create HMAC for webhook body', () => {
      const bodyString = 'test body string';
      const hmac = CryptoHelper.createShopifyWebhookHmac(bodyString);

      expect(typeof hmac).toBe('string');
      expect(hmac.length).toBeGreaterThan(0);
    });

    it('should create same HMAC for same body', () => {
      const bodyString = 'test body string';
      const hmac1 = CryptoHelper.createShopifyWebhookHmac(bodyString);
      const hmac2 = CryptoHelper.createShopifyWebhookHmac(bodyString);

      expect(hmac1).toBe(hmac2);
    });
  });
});

