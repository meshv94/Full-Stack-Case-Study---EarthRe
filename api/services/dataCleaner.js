import { parseAndNormalizeTimestamp } from '../utils/timestamp.js';
import { parseAndNormalizeLatency } from '../utils/latency.js';

/**
 * Validates whether an HTTP status code is a valid standard HTTP response code (100 - 599).
 * Rejects 999 or non-HTTP values.
 */
export function isValidHttpStatusCode(statusCode) {
  const code = parseInt(statusCode, 10);
  if (isNaN(code)) return false;
  return code >= 100 && code <= 599;
}

/**
 * Cleans, normalizes, deduplicates, and validates raw CSV log records.
 *
 * @param {Array<Object>} rawRecords - Array of objects parsed from CSV
 * @param {string} filename - Original filename
 * @returns {Object} { cleanedChecks, uploadSummary, rejectedRecords }
 */
export function cleanAndNormalizeData(rawRecords, filename = 'monitoring_checks.csv') {
  const uploadSummary = {
    filename,
    uploadedAt: new Date().toISOString(),
    rowsReceived: rawRecords.length,
    rowsAccepted: 0,
    rowsRejected: 0,
    duplicateRows: 0,
    invalidStatusRows: 0,
    negativeLatencyRows: 0,
    missingLatencyRows: 0,
    invalidTimestampRows: 0,
    normalizedUnitRows: 0,
    normalizedEpochRows: 0,
    dateFrom: null,
    dateTo: null,
    servicesCount: 0,
    processingStatus: 'COMPLETED'
  };

  const rejectedRecords = [];
  const seenExactRows = new Set();
  const validChecks = [];
  const servicesSet = new Set();
  let minDate = null;
  let maxDate = null;

  for (let i = 0; i < rawRecords.length; i++) {
    const raw = rawRecords[i];
    const rowNumber = i + 2;

    // 1. Exact Duplicate Row Detection
    const rowFingerprint = `${raw.service_id}|${raw.service_name}|${raw.timestamp}|${raw.status_code}|${raw.latency}|${raw.latency_unit}|${raw.agent}|${raw.region}`;
    if (seenExactRows.has(rowFingerprint)) {
      uploadSummary.duplicateRows++;
      uploadSummary.rowsRejected++;
      rejectedRecords.push({ rowNumber, raw, reason: 'Exact duplicate row' });
      continue;
    }
    seenExactRows.add(rowFingerprint);

    // 2. Timestamp Validation & Normalization
    const tsResult = parseAndNormalizeTimestamp(raw.timestamp);
    if (!tsResult.isValid) {
      uploadSummary.invalidTimestampRows++;
      uploadSummary.rowsRejected++;
      rejectedRecords.push({ rowNumber, raw, reason: `Invalid timestamp: ${tsResult.error}` });
      continue;
    }
    if (tsResult.formatDetected === 'unix') {
      uploadSummary.normalizedEpochRows++;
    }

    // 3. Status Code Validation
    const rawStatusCode = String(raw.status_code || '').trim();
    if (!isValidHttpStatusCode(rawStatusCode)) {
      uploadSummary.invalidStatusRows++;
      uploadSummary.rowsRejected++;
      rejectedRecords.push({ rowNumber, raw, reason: `Invalid HTTP status code: "${rawStatusCode}"` });
      continue;
    }
    const statusCode = parseInt(rawStatusCode, 10);

    // 4. Latency Validation & Normalization
    const latResult = parseAndNormalizeLatency(raw.latency, raw.latency_unit);
    if (!latResult.isValid) {
      if (latResult.error && latResult.error.includes('Negative latency')) {
        uploadSummary.negativeLatencyRows++;
      }
      uploadSummary.rowsRejected++;
      rejectedRecords.push({ rowNumber, raw, reason: latResult.error });
      continue;
    }

    if (latResult.wasEmpty) {
      uploadSummary.missingLatencyRows++;
    }
    if (latResult.wasConverted) {
      uploadSummary.normalizedUnitRows++;
    }

    if (!minDate || tsResult.dateObj < minDate) minDate = tsResult.dateObj;
    if (!maxDate || tsResult.dateObj > maxDate) maxDate = tsResult.dateObj;

    const serviceId = String(raw.service_id || 'unknown-service').trim();
    const serviceName = String(raw.service_name || serviceId).trim();
    servicesSet.add(serviceId);

    const isAvailable = statusCode >= 200 && statusCode < 300;

    validChecks.push({
      serviceId,
      serviceName,
      timestamp: tsResult.isoUTC,
      epochMs: tsResult.epochMs,
      statusCode,
      availability: isAvailable ? 1 : 0,
      isDown: !isAvailable,
      latencyMs: latResult.latencyMs,
      agent: String(raw.agent || 'unknown-agent').trim(),
      region: String(raw.region || 'unknown-region').trim()
    });
  }

  uploadSummary.rowsAccepted = validChecks.length;
  uploadSummary.dateFrom = minDate ? minDate.toISOString() : null;
  uploadSummary.dateTo = maxDate ? maxDate.toISOString() : null;
  uploadSummary.servicesCount = servicesSet.size;

  return {
    cleanedChecks: validChecks,
    uploadSummary,
    rejectedRecords
  };
}
