/**
 * Utility functions for timestamp parsing and normalization.
 * Handles:
 * - ISO-8601 UTC strings (e.g. 2025-05-13T12:45:00Z)
 * - ISO-8601 with timezone offsets (e.g. 2025-06-01T19:00:00+05:30)
 * - 10-digit Unix epoch integer timestamps in seconds (e.g. 1746938700)
 */

function parseAndNormalizeTimestamp(raw) {
  if (raw === null || raw === undefined) {
    return { isValid: false, error: 'Timestamp is missing' };
  }

  const str = String(raw).trim();
  if (!str) {
    return { isValid: false, error: 'Timestamp is empty' };
  }

  let dateObj;
  let formatDetected = 'iso';

  // Check if Unix epoch (seconds)
  if (/^\d{9,12}$/.test(str)) {
    const seconds = parseInt(str, 10);
    dateObj = new Date(seconds * 1000);
    formatDetected = 'unix';
  } else {
    // Attempt standard ISO parsing
    dateObj = new Date(str);
    if (isNaN(dateObj.getTime())) {
      // Try replacing space with 'T' or normalizing
      const normalizedStr = str.replace(' ', 'T');
      dateObj = new Date(normalizedStr);
    }
  }

  if (isNaN(dateObj.getTime())) {
    return { isValid: false, error: `Invalid date representation: "${str}"` };
  }

  const isoUTC = dateObj.toISOString();
  const epochMs = dateObj.getTime();
  const epochSeconds = Math.floor(epochMs / 1000);

  return {
    isValid: true,
    isoUTC,
    epochMs,
    epochSeconds,
    dateObj,
    formatDetected
  };
}

module.exports = {
  parseAndNormalizeTimestamp
};
