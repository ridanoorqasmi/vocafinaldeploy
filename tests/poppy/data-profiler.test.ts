/**
 * Phase 1: Data Profiler Tests
 * Data Analyst Agent (Poppy) - Profiling Logic Tests
 */

import { describe, it, expect } from 'vitest';
import { profileDataset } from '@/lib/poppy/services/data-profiler';
import type { ParsedData } from '@/lib/poppy/services/data-parser';

describe('Poppy Phase 1: Data Profiler Tests', () => {
  const datasetVersionId = '00000000-0000-0000-0000-000000000001';

  describe('Basic Profiling', () => {
    it('should profile dataset with string columns', () => {
      const parsedData: ParsedData = {
        headers: ['name', 'city'],
        rows: [
          { name: 'John', city: 'New York' },
          { name: 'Jane', city: 'London' },
          { name: 'Bob', city: 'Paris' },
        ],
        rowCount: 3,
        columnCount: 2,
      };

      const profile = profileDataset(parsedData, datasetVersionId);

      expect(profile.rowCount).toBe(3);
      expect(profile.columnCount).toBe(2);
      expect(profile.columns).toHaveLength(2);
      expect(profile.columns[0].type).toBe('string');
      expect(profile.columns[0].nullCount).toBe(0);
      expect(profile.columns[0].nullRatio).toBe(0);
      expect(profile.columns[0].distinctCount).toBe(3);
    });

    it('should profile dataset with numeric columns', () => {
      const parsedData: ParsedData = {
        headers: ['age', 'score'],
        rows: [
          { age: '25', score: '85.5' },
          { age: '30', score: '92.0' },
          { age: '28', score: '78.5' },
        ],
        rowCount: 3,
        columnCount: 2,
      };

      const profile = profileDataset(parsedData, datasetVersionId);

      expect(profile.columns[0].type).toBe('number');
      expect(profile.columns[0].min).toBe(25);
      expect(profile.columns[0].max).toBe(30);
      expect(profile.columns[0].mean).toBeDefined();

      expect(profile.columns[1].type).toBe('number');
      expect(profile.columns[1].min).toBe(78.5);
      expect(profile.columns[1].max).toBe(92.0);
    });

    it('should calculate null ratios correctly', () => {
      const parsedData: ParsedData = {
        headers: ['name', 'age'],
        rows: [
          { name: 'John', age: '25' },
          { name: '', age: '30' },
          { name: 'Bob', age: '' },
        ],
        rowCount: 3,
        columnCount: 2,
      };

      const profile = profileDataset(parsedData, datasetVersionId);

      expect(profile.columns[0].nullCount).toBe(1);
      expect(profile.columns[0].nullRatio).toBeCloseTo(0.3333, 3);

      expect(profile.columns[1].nullCount).toBe(1);
      expect(profile.columns[1].nullRatio).toBeCloseTo(0.3333, 3);
    });

    it('should detect boolean columns', () => {
      const parsedData: ParsedData = {
        headers: ['isActive', 'hasAccess'],
        rows: [
          { isActive: 'true', hasAccess: 'yes' },
          { isActive: 'false', hasAccess: 'no' },
          { isActive: '1', hasAccess: '1' },
        ],
        rowCount: 3,
        columnCount: 2,
      };

      const profile = profileDataset(parsedData, datasetVersionId);

      expect(profile.columns[0].type).toBe('boolean');
      expect(profile.columns[1].type).toBe('boolean');
    });

    it('should detect date columns', () => {
      const parsedData: ParsedData = {
        headers: ['date', 'timestamp'],
        rows: [
          { date: '2024-01-01', timestamp: '2024-01-01' },
          { date: '2024-02-15', timestamp: '2024-02-15' },
          { date: '2024-03-20', timestamp: '2024-03-20' },
        ],
        rowCount: 3,
        columnCount: 2,
      };

      const profile = profileDataset(parsedData, datasetVersionId);

      expect(profile.columns[0].type).toBe('date');
      expect(profile.columns[1].type).toBe('date');
    });

    it('should calculate distinct counts correctly', () => {
      const parsedData: ParsedData = {
        headers: ['category'],
        rows: [
          { category: 'A' },
          { category: 'B' },
          { category: 'A' },
          { category: 'C' },
          { category: 'A' },
        ],
        rowCount: 5,
        columnCount: 1,
      };

      const profile = profileDataset(parsedData, datasetVersionId);

      expect(profile.columns[0].distinctCount).toBe(3); // A, B, C
    });

    it('should handle all null columns', () => {
      const parsedData: ParsedData = {
        headers: ['empty'],
        rows: [
          { empty: '' },
          { empty: '' },
          { empty: '' },
        ],
        rowCount: 3,
        columnCount: 1,
      };

      const profile = profileDataset(parsedData, datasetVersionId);

      expect(profile.columns[0].type).toBe('string'); // Defaults to string
      expect(profile.columns[0].nullCount).toBe(3);
      expect(profile.columns[0].nullRatio).toBe(1);
      expect(profile.columns[0].distinctCount).toBe(0);
    });

    it('should throw error for empty dataset', () => {
      const parsedData: ParsedData = {
        headers: ['name'],
        rows: [],
        rowCount: 0,
        columnCount: 1,
      };

      expect(() => profileDataset(parsedData, datasetVersionId)).toThrow('empty dataset');
    });

    it('should throw error for dataset with no columns', () => {
      const parsedData: ParsedData = {
        headers: [],
        rows: [{}, {}],
        rowCount: 2,
        columnCount: 0,
      };

      expect(() => profileDataset(parsedData, datasetVersionId)).toThrow('no columns');
    });
  });

  describe('Numeric Statistics', () => {
    it('should calculate mean correctly', () => {
      const parsedData: ParsedData = {
        headers: ['value'],
        rows: [
          { value: '10' },
          { value: '20' },
          { value: '30' },
        ],
        rowCount: 3,
        columnCount: 1,
      };

      const profile = profileDataset(parsedData, datasetVersionId);

      expect(profile.columns[0].mean).toBe(20);
    });

    it('should handle numeric columns with commas', () => {
      const parsedData: ParsedData = {
        headers: ['amount'],
        rows: [
          { amount: '1,000' },
          { amount: '2,500' },
          { amount: '3,000' },
        ],
        rowCount: 3,
        columnCount: 1,
      };

      const profile = profileDataset(parsedData, datasetVersionId);

      expect(profile.columns[0].type).toBe('number');
      expect(profile.columns[0].min).toBe(1000);
      expect(profile.columns[0].max).toBe(3000);
    });
  });
});








