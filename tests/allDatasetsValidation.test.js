import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parseCsvContent } from '../api/services/csvParser.js';
import { cleanAndNormalizeData } from '../api/services/dataCleaner.js';
import { calculateSlaStats } from '../api/services/slaCalculator.js';

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

      const { cleanedChecks, uploadSummary } = cleanAndNormalizeData(rawRecords, file);

      expect(uploadSummary.duplicateRows).toBeGreaterThan(0);
      expect(uploadSummary.invalidStatusRows).toBe(1);
      expect(uploadSummary.negativeLatencyRows).toBe(1);
      expect(uploadSummary.missingLatencyRows).toBeGreaterThan(50);
      expect(uploadSummary.normalizedUnitRows).toBeGreaterThan(900);
      expect(uploadSummary.normalizedEpochRows).toBeGreaterThan(60);
      expect(uploadSummary.servicesCount).toBe(expectedServices);

      const stats = calculateSlaStats(cleanedChecks, 99.9);
      expect(stats.totalChecks).toBe(cleanedChecks.length);
      expect(stats.availability).toBeLessThan(99.9);
      expect(stats.slaStatus).toBe('BREACHED');
      expect(stats.averageLatencyMs).toBeGreaterThan(100);
      expect(stats.p95LatencyMs).toBeGreaterThan(stats.averageLatencyMs);
      expect(Object.keys(stats.services).length).toBe(5);
      expect(stats.incidents.length).toBeGreaterThan(0);
    });
  });
});
