/**
 * Phase 7: Semantic Operation Guard Tests
 * Data Analyst Agent (Poppy) - Deterministic Semantic Validation Tests
 */

import { describe, it, expect } from 'vitest';
import {
  validateSemanticOperations,
  validateMetricOperation,
  type SemanticGuardResult,
} from '@/lib/poppy/services/analytics/semantic-operation-guard';
import type { MetricResolution } from '@/lib/poppy/services/analytics/metric-resolver';
import type { AnalyticsIntent } from '@/lib/poppy/services/analytics/intent-classifier';
import type { ColumnProfile } from '@/lib/poppy/services/data-profiler';

/**
 * Helper to create a column profile
 */
function createColumnProfile(
  name: string,
  type: 'string' | 'number' | 'boolean' | 'date',
  distinctCount: number = 10
): ColumnProfile {
  return {
    name,
    type,
    nullCount: 0,
    nullRatio: 0,
    distinctCount,
    ...(type === 'number' && { min: 0, max: 100, mean: 50 }),
  };
}

/**
 * Helper to create a metric resolution
 */
function createResolution(
  metricColumn: ColumnProfile,
  dimensionColumn?: ColumnProfile,
  timeColumn?: ColumnProfile
): MetricResolution {
  const resolution: MetricResolution = {
    metric: {
      columnName: metricColumn.name,
      columnProfile: metricColumn,
    },
  };

  if (dimensionColumn) {
    resolution.dimension = {
      columnName: dimensionColumn.name,
      columnProfile: dimensionColumn,
    };
  }

  if (timeColumn) {
    resolution.timeColumn = {
      columnName: timeColumn.name,
      columnProfile: timeColumn,
    };
  }

  return resolution;
}

describe('SemanticOperationGuard', () => {
  const datasetVersionId = 'test-version-id';

  describe('validateMetricOperation', () => {
    it('should allow AGG_AVG on numeric columns', () => {
      const metricColumn = createColumnProfile('revenue', 'number');
      const resolution = createResolution(metricColumn);
      const intent: AnalyticsIntent = 'aggregate_avg';

      const result = validateSemanticOperations(resolution, intent, datasetVersionId);

      expect(result).toBeNull(); // null means valid
    });

    it('should block AGG_AVG on date columns', () => {
      const metricColumn = createColumnProfile('created_at', 'date');
      const resolution = createResolution(metricColumn);
      const intent: AnalyticsIntent = 'aggregate_avg';

      const result = validateSemanticOperations(resolution, intent, datasetVersionId);

      expect(result).not.toBeNull();
      expect(result!.isValid).toBe(false);
      expect(result!.column).toBe('created_at');
      expect(result!.semanticType).toBe('date');
      expect(result!.attemptedOperation).toBe('AGG_AVG');
      expect(result!.reason).toContain("doesn't have a real-world meaning");
      expect(result!.suggestedAlternatives).toBeDefined();
      expect(result!.suggestedAlternatives!.length).toBeGreaterThan(0);
    });

    it('should block AGG_AVG on categorical columns', () => {
      const metricColumn = createColumnProfile('category', 'string');
      const resolution = createResolution(metricColumn);
      const intent: AnalyticsIntent = 'aggregate_avg';

      const result = validateSemanticOperations(resolution, intent, datasetVersionId);

      expect(result).not.toBeNull();
      expect(result!.isValid).toBe(false);
      expect(result!.semanticType).toBe('categorical');
      expect(result!.attemptedOperation).toBe('AGG_AVG');
    });

    it('should block AGG_AVG on boolean columns', () => {
      const metricColumn = createColumnProfile('is_active', 'boolean');
      const resolution = createResolution(metricColumn);
      const intent: AnalyticsIntent = 'aggregate_avg';

      const result = validateSemanticOperations(resolution, intent, datasetVersionId);

      expect(result).not.toBeNull();
      expect(result!.isValid).toBe(false);
      expect(result!.semanticType).toBe('boolean');
      expect(result!.attemptedOperation).toBe('AGG_AVG');
    });

    it('should allow AGG_SUM on numeric columns', () => {
      const metricColumn = createColumnProfile('revenue', 'number');
      const resolution = createResolution(metricColumn);
      const intent: AnalyticsIntent = 'aggregate_sum';

      const result = validateSemanticOperations(resolution, intent, datasetVersionId);

      expect(result).toBeNull();
    });

    it('should block AGG_SUM on date columns', () => {
      const metricColumn = createColumnProfile('created_at', 'date');
      const resolution = createResolution(metricColumn);
      const intent: AnalyticsIntent = 'aggregate_sum';

      const result = validateSemanticOperations(resolution, intent, datasetVersionId);

      expect(result).not.toBeNull();
      expect(result!.isValid).toBe(false);
      expect(result!.semanticType).toBe('date');
      expect(result!.attemptedOperation).toBe('AGG_SUM');
    });

    it('should block AGG_SUM on categorical columns', () => {
      const metricColumn = createColumnProfile('category', 'string');
      const resolution = createResolution(metricColumn);
      const intent: AnalyticsIntent = 'aggregate_sum';

      const result = validateSemanticOperations(resolution, intent, datasetVersionId);

      expect(result).not.toBeNull();
      expect(result!.isValid).toBe(false);
      expect(result!.semanticType).toBe('categorical');
    });

    it('should allow COUNT on any column type', () => {
      const numericColumn = createColumnProfile('revenue', 'number');
      const dateColumn = createColumnProfile('created_at', 'date');
      const categoricalColumn = createColumnProfile('category', 'string');
      const booleanColumn = createColumnProfile('is_active', 'boolean');

      const intent: AnalyticsIntent = 'aggregate_count';

      expect(validateSemanticOperations(createResolution(numericColumn), intent, datasetVersionId)).toBeNull();
      expect(validateSemanticOperations(createResolution(dateColumn), intent, datasetVersionId)).toBeNull();
      expect(validateSemanticOperations(createResolution(categoricalColumn), intent, datasetVersionId)).toBeNull();
      expect(validateSemanticOperations(createResolution(booleanColumn), intent, datasetVersionId)).toBeNull();
    });

    it('should allow GROUP_BY on date columns', () => {
      const metricColumn = createColumnProfile('revenue', 'number');
      const dimensionColumn = createColumnProfile('created_at', 'date');
      const resolution = createResolution(metricColumn, dimensionColumn);
      const intent: AnalyticsIntent = 'group_by';

      const result = validateSemanticOperations(resolution, intent, datasetVersionId);

      expect(result).toBeNull();
    });

    it('should allow GROUP_BY on categorical columns', () => {
      const metricColumn = createColumnProfile('revenue', 'number');
      const dimensionColumn = createColumnProfile('category', 'string');
      const resolution = createResolution(metricColumn, dimensionColumn);
      const intent: AnalyticsIntent = 'group_by';

      const result = validateSemanticOperations(resolution, intent, datasetVersionId);

      expect(result).toBeNull();
    });

    it('should allow TIME_BUCKET on date columns', () => {
      const metricColumn = createColumnProfile('revenue', 'number');
      const timeColumn = createColumnProfile('created_at', 'date');
      const resolution = createResolution(metricColumn, undefined, timeColumn);
      const intent: AnalyticsIntent = 'time_series';

      const result = validateSemanticOperations(resolution, intent, datasetVersionId);

      expect(result).toBeNull();
    });

    it('should block TIME_BUCKET on non-date columns', () => {
      const metricColumn = createColumnProfile('revenue', 'number');
      const timeColumn = createColumnProfile('category', 'string'); // Wrong type
      const resolution = createResolution(metricColumn, undefined, timeColumn);
      const intent: AnalyticsIntent = 'time_series';

      const result = validateSemanticOperations(resolution, intent, datasetVersionId);

      expect(result).not.toBeNull();
      expect(result!.isValid).toBe(false);
      expect(result!.semanticType).toBe('categorical');
      expect(result!.attemptedOperation).toBe('TIME_BUCKET');
    });
  });

  describe('validateSemanticOperations - JSON output structure', () => {
    it('should return structured JSON for blocked operations', () => {
      const metricColumn = createColumnProfile('created_at', 'date');
      const resolution = createResolution(metricColumn);
      const intent: AnalyticsIntent = 'aggregate_avg';

      const result = validateSemanticOperations(resolution, intent, datasetVersionId);

      expect(result).not.toBeNull();
      
      // Verify exact JSON structure
      const jsonResult = JSON.parse(JSON.stringify(result!));
      expect(jsonResult).toHaveProperty('isValid');
      expect(jsonResult).toHaveProperty('column');
      expect(jsonResult).toHaveProperty('semanticType');
      expect(jsonResult).toHaveProperty('attemptedOperation');
      expect(jsonResult).toHaveProperty('reason');
      expect(jsonResult).toHaveProperty('suggestedAlternatives');
      
      expect(typeof jsonResult.isValid).toBe('boolean');
      expect(typeof jsonResult.column).toBe('string');
      expect(typeof jsonResult.semanticType).toBe('string');
      expect(typeof jsonResult.attemptedOperation).toBe('string');
      expect(typeof jsonResult.reason).toBe('string');
      expect(Array.isArray(jsonResult.suggestedAlternatives)).toBe(true);
    });

    it('should return null (not an object) for valid operations', () => {
      const metricColumn = createColumnProfile('revenue', 'number');
      const resolution = createResolution(metricColumn);
      const intent: AnalyticsIntent = 'aggregate_avg';

      const result = validateSemanticOperations(resolution, intent, datasetVersionId);

      expect(result).toBeNull();
    });
  });

  describe('validateSemanticOperations - edge cases', () => {
    it('should handle unknown column types', () => {
      // Create a column with an invalid type (simulating unknown)
      const metricColumn = {
        ...createColumnProfile('unknown_col', 'string'),
        type: 'unknown' as any, // Force unknown type
      };
      const resolution = createResolution(metricColumn);
      const intent: AnalyticsIntent = 'aggregate_avg';

      const result = validateSemanticOperations(resolution, intent, datasetVersionId);

      // Should block unknown types
      expect(result).not.toBeNull();
      expect(result!.isValid).toBe(false);
      expect(result!.semanticType).toBe('unknown');
    });

    it('should validate multiple columns in resolution', () => {
      // Valid: numeric metric, date dimension
      const metricColumn = createColumnProfile('revenue', 'number');
      const dimensionColumn = createColumnProfile('created_at', 'date');
      const resolution = createResolution(metricColumn, dimensionColumn);
      const intent: AnalyticsIntent = 'group_by';

      const result = validateSemanticOperations(resolution, intent, datasetVersionId);
      expect(result).toBeNull(); // Should be valid

      // Invalid: date metric (cannot sum dates)
      const invalidMetricColumn = createColumnProfile('created_at', 'date');
      const invalidResolution = createResolution(invalidMetricColumn, dimensionColumn);
      const invalidIntent: AnalyticsIntent = 'aggregate_sum';

      const invalidResult = validateSemanticOperations(invalidResolution, invalidIntent, datasetVersionId);
      expect(invalidResult).not.toBeNull();
      expect(invalidResult!.isValid).toBe(false);
      expect(invalidResult!.column).toBe('created_at'); // Should fail on metric, not dimension
    });
  });

  describe('validateSemanticOperations - suggested alternatives', () => {
    it('should suggest valid alternatives for blocked operations', () => {
      const metricColumn = createColumnProfile('created_at', 'date');
      const resolution = createResolution(metricColumn);
      const intent: AnalyticsIntent = 'aggregate_avg';

      const result = validateSemanticOperations(resolution, intent, datasetVersionId);

      expect(result).not.toBeNull();
      expect(result!.suggestedAlternatives).toBeDefined();
      expect(result!.suggestedAlternatives!.length).toBeGreaterThan(0);
      
      // Should suggest operations that are valid for date columns
      const suggestions = result!.suggestedAlternatives!.join(' ').toLowerCase();
      expect(suggestions).toMatch(/minimum|maximum|count|group|time/);
    });

    it('should not suggest the blocked operation itself', () => {
      const metricColumn = createColumnProfile('category', 'string');
      const resolution = createResolution(metricColumn);
      const intent: AnalyticsIntent = 'aggregate_sum';

      const result = validateSemanticOperations(resolution, intent, datasetVersionId);

      expect(result).not.toBeNull();
      expect(result!.suggestedAlternatives).toBeDefined();
      
      // Should not include 'sum' or 'average' in suggestions
      const suggestions = result!.suggestedAlternatives!.join(' ').toLowerCase();
      expect(suggestions).not.toMatch(/\b(sum|average|avg)\b/);
    });
  });
});



