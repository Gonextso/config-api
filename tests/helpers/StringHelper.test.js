import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

const { default: StringHelper } = await import('../../helpers/StringHelper.js');

describe('StringHelper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('truncateString', () => {
    it('should return string as-is when length is less than maxLength', () => {
      const str = 'Short string';
      const result = StringHelper.truncateString(str, 100);

      expect(result).toBe(str);
    });

    it('should truncate string when length exceeds maxLength', () => {
      const str = 'a'.repeat(3000);
      const result = StringHelper.truncateString(str, 2500);

      // truncateString takes maxLength - 3 chars and adds "... [truncated by gonextso StringHelper]" (40 chars)
      // So total length is (maxLength - 3) + 40 = maxLength + 37
      expect(result.length).toBe(2500 + 37);
      expect(result).toContain('... [truncated by gonextso StringHelper]');
    });

    it('should use default maxLength of 2500', () => {
      const str = 'a'.repeat(3000);
      const result = StringHelper.truncateString(str);

      expect(result.length).toBe(2500 + 37);
      expect(result).toContain('... [truncated by gonextso StringHelper]');
    });

    it('should return null when str is null', () => {
      const result = StringHelper.truncateString(null);

      expect(result).toBeNull();
    });

    it('should return undefined when str is undefined', () => {
      const result = StringHelper.truncateString(undefined);

      expect(result).toBeUndefined();
    });

    it('should return empty string when str is empty string', () => {
      const result = StringHelper.truncateString('');

      expect(result).toBe('');
    });
  });

  describe('compareStrings', () => {
    it('should return true for identical strings', () => {
      expect(StringHelper.compareStrings('test', 'test')).toBe(true);
    });

    it('should return true for strings with different case', () => {
      expect(StringHelper.compareStrings('Test', 'TEST')).toBe(true);
    });

    it('should return true for strings with accents after normalization', () => {
      expect(StringHelper.compareStrings('café', 'cafe')).toBe(true);
    });

    it('should return false for different strings', () => {
      expect(StringHelper.compareStrings('test', 'different')).toBe(false);
    });

    it('should handle null values', () => {
      expect(StringHelper.compareStrings(null, null)).toBe(true);
      expect(StringHelper.compareStrings(null, 'test')).toBe(false);
      expect(StringHelper.compareStrings('test', null)).toBe(false);
    });
  });

  describe('normalizeString', () => {
    it('should convert to lowercase', () => {
      expect(StringHelper.normalizeString('TEST')).toBe('test');
    });

    it('should remove accents', () => {
      expect(StringHelper.normalizeString('café')).toBe('cafe');
    });

    it('should handle null', () => {
      expect(StringHelper.normalizeString(null)).toBe('');
    });

    it('should handle undefined', () => {
      expect(StringHelper.normalizeString(undefined)).toBe('');
    });
  });

  describe('generateUUID', () => {
    it('should generate a UUID string', () => {
      const uuid = StringHelper.generateUUID();

      expect(typeof uuid).toBe('string');
      expect(uuid.length).toBeGreaterThan(0);
    });

    it('should generate different UUIDs', () => {
      const uuid1 = StringHelper.generateUUID();
      const uuid2 = StringHelper.generateUUID();

      expect(uuid1).not.toBe(uuid2);
    });
  });

  describe('generateId', () => {
    it('should generate an ID string', () => {
      const id = StringHelper.generateId();

      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('should generate different IDs', () => {
      const id1 = StringHelper.generateId();
      const id2 = StringHelper.generateId();

      expect(id1).not.toBe(id2);
    });
  });
});

