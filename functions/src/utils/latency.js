/**
 * Utility functions for latency parsing and normalization.
 * Handles:
 * - 'ms' values (numeric integers/floats)
 * - 's' values (converts seconds to milliseconds, e.g. 0.717s -> 717ms)
 * - empty/null latency (valid successful check without latency data -> returns null)
 * - negative latency (e.g. -296ms -> invalid/rejected)
 */

function parseAndNormalizeLatency(rawLatency, rawUnit = 'ms') {
  // Check for empty/missing latency
  if (rawLatency === null || rawLatency === undefined) {
    return { isValid: true, latencyMs: null, wasEmpty: true, wasConverted: false };
  }

  const str = String(rawLatency).trim();
  if (str === '') {
    return { isValid: true, latencyMs: null, wasEmpty: true, wasConverted: false };
  }

  const num = Number(str);
  if (isNaN(num)) {
    return { isValid: false, error: `Latency "${str}" is not a valid number` };
  }

  if (num < 0) {
    return { isValid: false, error: `Negative latency is physically impossible: ${num}` };
  }

  const unit = String(rawUnit || 'ms').trim().toLowerCase();
  let latencyMs = num;
  let wasConverted = false;

  if (unit === 's' || unit === 'sec' || unit === 'seconds') {
    latencyMs = Math.round(num * 1000 * 100) / 100; // retain reasonable precision
    wasConverted = true;
  }

  return {
    isValid: true,
    latencyMs,
    wasEmpty: false,
    wasConverted
  };
}

module.exports = {
  parseAndNormalizeLatency
};
