import { describe, it, expect } from 'vitest';
import { parseAndNormalizeTimestamp } from '../api/utils/timestamp.js';
import { parseAndNormalizeLatency } from '../api/utils/latency.js';
import { cleanAndNormalizeData, isValidHttpStatusCode } from '../api/services/dataCleaner.js';
import { calculatePercentile, calculateSlaStats, detectIncidents } from '../api/services/slaCalculator.js';

describe('Timestamp Normalization', () => {
  it('should correctly parse and normalize ISO UTC strings', () => {
    const result = parseAndNormalizeTimestamp('2025-05-13T12:45:00Z');
    expect(result.isValid).toBe(true);
    expect(result.isoUTC).toBe('2025-05-13T12:45:00.000Z');
    expect(result.formatDetected).toBe('iso');
  });

  it('should correctly parse ISO strings with timezone offset (+05:30) to UTC', () => {
    const result = parseAndNormalizeTimestamp('2025-06-01T19:00:00+05:30');
    expect(result.isValid).toBe(true);
    expect(result.isoUTC).toBe('2025-06-01T13:30:00.000Z');
  });

  it('should correctly parse 10-digit Unix epoch timestamps', () => {
    const result = parseAndNormalizeTimestamp('1746938700');
    expect(result.isValid).toBe(true);
    expect(result.isoUTC).toBe('2025-05-11T04:45:00.000Z');
    expect(result.formatDetected).toBe('unix');
  });

  it('should reject invalid or empty timestamps', () => {
    expect(parseAndNormalizeTimestamp('').isValid).toBe(false);
    expect(parseAndNormalizeTimestamp('invalid-date').isValid).toBe(false);
    expect(parseAndNormalizeTimestamp(null).isValid).toBe(false);
  });
});

describe('Latency Normalization', () => {
  it('should keep valid millisecond latency intact', () => {
    const result = parseAndNormalizeLatency('707', 'ms');
    expect(result.isValid).toBe(true);
    expect(result.latencyMs).toBe(707);
    expect(result.wasConverted).toBe(false);
  });

  it('should convert seconds unit (0.717s) to milliseconds (717ms)', () => {
    const result = parseAndNormalizeLatency('0.717', 's');
    expect(result.isValid).toBe(true);
    expect(result.latencyMs).toBe(717);
    expect(result.wasConverted).toBe(true);
  });

  it('should handle missing / empty latency gracefully as null', () => {
    const result = parseAndNormalizeLatency('', 'ms');
    expect(result.isValid).toBe(true);
    expect(result.latencyMs).toBeNull();
    expect(result.wasEmpty).toBe(true);
  });

  it('should reject negative latency values', () => {
    const result = parseAndNormalizeLatency('-296', 'ms');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Negative latency');
  });
});

describe('Status Code Validation', () => {
  it('should validate valid HTTP status codes', () => {
    expect(isValidHttpStatusCode('200')).toBe(true);
    expect(isValidHttpStatusCode('500')).toBe(true);
    expect(isValidHttpStatusCode('502')).toBe(true);
    expect(isValidHttpStatusCode('503')).toBe(true);
  });

  it('should reject invalid code 999 or non-HTTP numbers', () => {
    expect(isValidHttpStatusCode('999')).toBe(false);
    expect(isValidHttpStatusCode('abc')).toBe(false);
    expect(isValidHttpStatusCode('50')).toBe(false);
  });
});

describe('Data Cleaning & Deduplication Engine', () => {
  it('should filter exact duplicates, invalid status codes, and negative latencies', () => {
    const rawData = [
      { service_id: 'svc-auth', service_name: 'auth-api', timestamp: '2025-05-13T12:00:00Z', status_code: '200', latency: '150', latency_unit: 'ms', agent: 'agent-1', region: 'ap-south-1' },
      { service_id: 'svc-auth', service_name: 'auth-api', timestamp: '2025-05-13T12:00:00Z', status_code: '200', latency: '150', latency_unit: 'ms', agent: 'agent-1', region: 'ap-south-1' },
      { service_id: 'svc-auth', service_name: 'auth-api', timestamp: '2025-05-13T12:15:00Z', status_code: '999', latency: '160', latency_unit: 'ms', agent: 'agent-1', region: 'ap-south-1' },
      { service_id: 'svc-auth', service_name: 'auth-api', timestamp: '2025-05-13T12:30:00Z', status_code: '200', latency: '-200', latency_unit: 'ms', agent: 'agent-1', region: 'ap-south-1' },
      { service_id: 'svc-search', service_name: 'search-api', timestamp: '1746938700', status_code: '200', latency: '0.55', latency_unit: 's', agent: 'agent-2', region: 'ap-south-1' },
      { service_id: 'svc-notify', service_name: 'notify-worker', timestamp: '2025-05-13T12:45:00Z', status_code: '200', latency: '', latency_unit: 'ms', agent: 'agent-1', region: 'ap-south-1' }
    ];

    const { cleanedChecks, uploadSummary } = cleanAndNormalizeData(rawData, 'test.csv');

    expect(uploadSummary.rowsReceived).toBe(6);
    expect(uploadSummary.duplicateRows).toBe(1);
    expect(uploadSummary.invalidStatusRows).toBe(1);
    expect(uploadSummary.negativeLatencyRows).toBe(1);
    expect(uploadSummary.missingLatencyRows).toBe(1);
    expect(uploadSummary.normalizedUnitRows).toBe(1);
    expect(uploadSummary.normalizedEpochRows).toBe(1);
    expect(uploadSummary.rowsAccepted).toBe(3);
    expect(cleanedChecks.length).toBe(3);

    const searchCheck = cleanedChecks.find(c => c.serviceId === 'svc-search');
    expect(searchCheck.latencyMs).toBe(550);
  });
});

describe('SLA Calculator', () => {
  it('should compute accurate availability, percentiles, and SLA status', () => {
    const mockChecks = [
      { serviceId: 'svc-auth', serviceName: 'auth-api', timestamp: '2025-05-01T00:00:00Z', epochMs: 1746057600000, statusCode: 200, availability: 1, isDown: false, latencyMs: 100 },
      { serviceId: 'svc-auth', serviceName: 'auth-api', timestamp: '2025-05-01T00:15:00Z', epochMs: 1746058500000, statusCode: 200, availability: 1, isDown: false, latencyMs: 200 },
      { serviceId: 'svc-auth', serviceName: 'auth-api', timestamp: '2025-05-01T00:30:00Z', epochMs: 1746059400000, statusCode: 500, availability: 0, isDown: true, latencyMs: 300 },
      { serviceId: 'svc-payments', serviceName: 'payments-api', timestamp: '2025-05-01T00:00:00Z', epochMs: 1746057600000, statusCode: 200, availability: 1, isDown: false, latencyMs: 400 }
    ];

    const stats = calculateSlaStats(mockChecks, 99.9);

    expect(stats.totalChecks).toBe(4);
    expect(stats.successfulChecks).toBe(3);
    expect(stats.failedChecks).toBe(1);
    expect(stats.availability).toBe(75);
    expect(stats.slaStatus).toBe('BREACHED');
    expect(stats.averageLatencyMs).toBe(250);
    expect(stats.services['svc-auth'].availability).toBe(66.667);
    expect(stats.services['svc-payments'].availability).toBe(100);
  });
});
