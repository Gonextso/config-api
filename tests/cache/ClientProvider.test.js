import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import CacheDatabases from '../../enums/CacheDatabases.js';

// Mock dependencies before imports
const mockSystemClient = { name: 'systemClient' };
const mockNebimClient = { name: 'nebimClient' };
const mockShopifyClient = { name: 'shopifyClient' };

const { default: ClientProvider } = await import('../../cache/ClientProvider.js');

describe('ClientProvider', () => {
  beforeEach(() => {
    // Set static clients
    ClientProvider.systemClient = mockSystemClient;
    ClientProvider.nebimClient = mockNebimClient;
    ClientProvider.shopifyClient = mockShopifyClient;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should assign systemClient when dbIndex is SystemCache', () => {
      const provider = new ClientProvider(CacheDatabases.DB_NAMES.SystemCache);

      expect(provider.client).toBe(mockSystemClient);
    });

    it('should assign nebimClient when dbIndex is NebimCache', () => {
      const provider = new ClientProvider(CacheDatabases.DB_NAMES.NebimCache);

      expect(provider.client).toBe(mockNebimClient);
    });

    it('should assign shopifyClient when dbIndex is ShopifyCache', () => {
      const provider = new ClientProvider(CacheDatabases.DB_NAMES.ShopifyCache);

      expect(provider.client).toBe(mockShopifyClient);
    });

    it('should not assign client for unknown dbIndex', () => {
      const provider = new ClientProvider('UnknownIndex');

      expect(provider.client).toBeUndefined();
    });
  });
});

