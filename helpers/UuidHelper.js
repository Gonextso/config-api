/**
 * UUID validation helper
 */
export default class UuidHelper {
  /**
   * Check if a string is a valid UUID
   * @param {string} uuid - The string to validate
   * @returns {boolean} - True if valid UUID, false otherwise
   */
  static isValidUuid(uuid) {
    if (!uuid || typeof uuid !== 'string') {
      return false;
    }
    
    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }
}
