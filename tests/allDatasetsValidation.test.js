import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
const { parseCsvContent } = require('../functions/src/services/csvParser');
const { cleanAndNormalizeData } = require('../functions/src/services/dataCleaner');
const { calculateSlaStats } = require('../functions/src/services/slaCalculator');

const DATASETS = [
  { file: 'monitoring_checks_9d_seed101.csv', expectedMinDays: 8, expectedServices: 5 },
  { file: 'monitoring_checks_12d_seed505.csv', expectedMinDays: 11, expectedServices: 5 },
  { file: 'monitoring_checks_14d_seed202.csv', expectedMinDays: 13, expectedServices: 5 },
  { file: 'monitoring_checks_21d_seed303.csv', expectedMinDays: 20, expectedServices: 5 },
  { file: 'monitoring_checks_30d_seed404.csv', expectedMinDays: 29, expectedServices: 5 }
];

describe('All Datasets End-to-End Validation', () => {
  DATASETS.forEach(({ file, expectedMinDays, expectedServices }) => {
    it(`should parse, clean, and calculate SLA metrics accurately for ${file}`, () => {
      const filePath = path.resolve(__dirname, '..', file);
      expect(fs.existsSync(filePath)).toBe(true);

      const rawCsv = fs.readFileSync(filePath, 'utf-8');
      const rawRecords = parseCsvContent(rawCsv);
      expect(rawRecords.length).toBeGreaterThan(4000);

      const { cleanedChecks, uploadSummary, rejectedRecords } = cleanAndNormalizeData(rawRecords, file);

      // Verify data anomalies were detected and filtered
      expect(uploadSummary.duplicateRows).toBeGreaterThan(0);
      expect(uploadSummary.invalidStatusRows).toBe(1); // 999 status
      expect(uploadSummary.negativeLatencyRows).toBe(1); // negative latency
      expect(uploadSummary.missingLatencyRows).toBeGreaterThan(50);
      expect(uploadSummary.normalizedUnitRows).toBeGreaterThan(900); // seconds to ms
      expect(uploadSummary.normalizedEpochRows).toBeGreaterThan(60); // unix to ISO
      expect(uploadSummary.servicesCount).toBe(expectedServices);

      // Verify SLA Calculation
      const stats = calculateSlaStats(cleanedChecks, 99.9);
      expect(stats.totalChecks).toBe(cleanedChecks.length);
      expect(stats.availability).toBeLessThan(99.9); // All test datasets breach 99.9%
      expect(stats.slaStatus).toBe('BREACHED');
      expect(stats.averageLatencyMs).toBeGreaterThan(100);
      expect(stats.p95LatencyMs).toBeGreaterThan(stats.averageLatencyMs);
      expect(Object.keys(stats.services).length).toBe(5);

      // Verify incidents were detected
      expect(stats.incidents.length).toBeGreaterThan(0);
    });
  });
});
