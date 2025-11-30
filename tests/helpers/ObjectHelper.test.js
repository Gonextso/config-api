import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

const { default: ObjectHelper } = await import('../../helpers/ObjectHelper.js');

describe('ObjectHelper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('deepMerge', () => {
    it('should merge two objects', () => {
      const target = { a: 1, b: 2 };
      const source = { c: 3, d: 4 };

      const result = ObjectHelper.deepMerge(target, source);

      expect(result).toEqual({ a: 1, b: 2, c: 3, d: 4 });
    });

    it('should merge nested objects', () => {
      const target = { a: { b: 1 } };
      const source = { a: { c: 2 } };

      const result = ObjectHelper.deepMerge(target, source);

      expect(result).toEqual({ a: { b: 1, c: 2 } });
    });

    it('should skip password field', () => {
      const target = { a: 1 };
      const source = { password: 'secret', b: 2 };

      const result = ObjectHelper.deepMerge(target, source);

      expect(result).toEqual({ a: 1, b: 2 });
      expect(result.password).toBeUndefined();
    });

    it('should skip apiKey field', () => {
      const target = { a: 1 };
      const source = { apiKey: 'secret-key', b: 2 };

      const result = ObjectHelper.deepMerge(target, source);

      expect(result).toEqual({ a: 1, b: 2 });
      expect(result.apiKey).toBeUndefined();
    });

    it('should handle arrays by replacing them', () => {
      const target = { items: [1, 2] };
      const source = { items: [3, 4] };

      const result = ObjectHelper.deepMerge(target, source);

      expect(result.items).toEqual([3, 4]);
    });

    it('should overwrite target values with source values', () => {
      const target = { a: 1, b: 2 };
      const source = { a: 10, b: 20 };

      const result = ObjectHelper.deepMerge(target, source);

      expect(result).toEqual({ a: 10, b: 20 });
    });

    it('should handle null and undefined values', () => {
      const target = { a: 1 };
      const source = { b: null, c: undefined };

      const result = ObjectHelper.deepMerge(target, source);

      expect(result).toEqual({ a: 1, b: null, c: undefined });
    });

    it('should create nested objects when they do not exist in target', () => {
      const target = { a: 1 };
      const source = { nested: { value: 2 } };

      const result = ObjectHelper.deepMerge(target, source);

      expect(result).toEqual({ a: 1, nested: { value: 2 } });
    });
  });

  describe('isEmpty', () => {
    it('should return true for empty object', () => {
      expect(ObjectHelper.isEmpty({})).toBe(true);
    });

    it('should return false for object with properties', () => {
      expect(ObjectHelper.isEmpty({ a: 1 })).toBe(false);
    });

    it('should return false for object created with constructor', () => {
      const obj = new Object();
      expect(ObjectHelper.isEmpty(obj)).toBe(true);
    });

    it('should return false for object with null values', () => {
      expect(ObjectHelper.isEmpty({ a: null })).toBe(false);
    });
  });
});

