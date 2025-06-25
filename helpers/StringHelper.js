import cyrpto from "crypto";

export default class StringHelper {
  static truncateString = (str, maxLength = 2500) => {
    if (!str) return str;

    if (str.length > maxLength) {
      return str.slice(0, maxLength - 3) + '... [truncated by gonextso StringHelper]';
    }
    return str;
  }

  static compareStrings = (str1, str2) => {
    return StringHelper.normalizeString(str1) === StringHelper.normalizeString(str2)
  }

  static normalizeString = (str) => {
    return String(str ?? "")
      .toUpperCase()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
  }

  static generateUUID = _ => {
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
      (c ^ cyrpto.randomBytes(1)[0] & 15 >> c / 4).toString(16));
  }
}