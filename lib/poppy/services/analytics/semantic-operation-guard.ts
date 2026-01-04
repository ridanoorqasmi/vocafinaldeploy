/**
 * Phase 7: Semantic Operation Guard
 * Data Analyst Agent (Poppy) - Deterministic Semantic Validation
 * 
 * Validates whether operations are semantically meaningful for column types
 * NO LLM - Pure rule-based validation
 */

import type { ColumnProfile, ColumnType } from '../data-profiler';
import type { AnalyticsIntent } from './intent-classifier';
import type { MetricResolution } from './metric-resolver';

/**
 * Standardized semantic types
 */
export type SemanticType = 'numeric' | 'date' | 'categorical' | 'boolean' | 'unknown';

/**
 * Operation categories
 */
export type OperationCategory =
  | 'AGG_AVG'
  | 'AGG_SUM'
  | 'AGG_MIN'
  | 'AGG_MAX'
  | 'COUNT'
  | 'GROUP_BY'
  | 'TIME_BUCKET'
  | 'CORRELATION'
  | 'DISTRIBUTION';

/**
 * Semantic guard result
 */
export interface SemanticGuardResult {
  isValid: boolean;
  column: string;
  semanticType: SemanticType;
  attemptedOperation: string;
  reason?: string;
  suggestedAlternatives?: string[];
}

/**
 * Map ColumnType to SemanticType
 * 
 * PHASE 7 ENHANCEMENT: Also check column names for date-like patterns
 * This handles cases where date columns are incorrectly profiled as numeric
 * (e.g., "Date_of_Journey" with values 1-27 representing days)
 */
function mapToSemanticType(columnType: ColumnType, columnProfile: ColumnProfile): SemanticType {
  // Check column name for date-like patterns (even if profiled as numeric)
  const columnNameLower = columnProfile.name.toLowerCase();
  const dateNamePatterns = [
    /date/i,
    /time/i,
    /day/i,
    /month/i,
    /year/i,
    /created/i,
    /updated/i,
    /timestamp/i,
    /journey/i, // Common pattern like "Date_of_Journey"
  ];
  
  const isDateLikeName = dateNamePatterns.some(pattern => pattern.test(columnNameLower));
  
  // If column name suggests it's a date, treat it as date (even if profiled as numeric)
  // This prevents averaging/summing date-like columns that were incorrectly profiled
  if (isDateLikeName && (columnType === 'number' || columnType === 'string')) {
    // Check if the values are in a date-like range (1-31 for days, 1-12 for months, etc.)
    // If min/max suggest it's a date component, treat as date
    if (columnType === 'number' && columnProfile.min !== undefined && columnProfile.max !== undefined) {
      const min = columnProfile.min;
      const max = columnProfile.max;
      // Days of month: 1-31, Months: 1-12, Years: typically > 1000
      // If range fits date component pattern, treat as date
      if ((min >= 1 && max <= 31) || (min >= 1 && max <= 12) || (min >= 1000 && max <= 9999)) {
        return 'date';
      }
    }
    // If name strongly suggests date (like "date_of_journey"), treat as date
    if (/date.*journey|journey.*date|date_of/i.test(columnNameLower)) {
      return 'date';
    }
  }
  
  switch (columnType) {
    case 'number':
      return 'numeric';
    case 'date':
      return 'date';
    case 'boolean':
      return 'boolean';
    case 'string':
      // String columns are categorical
      return 'categorical';
    default:
      return 'unknown';
  }
}

/**
 * Map AnalyticsIntent to OperationCategory
 */
function mapIntentToOperation(intent: AnalyticsIntent): OperationCategory {
  switch (intent) {
    case 'aggregate_avg':
      return 'AGG_AVG';
    case 'aggregate_sum':
      return 'AGG_SUM';
    case 'aggregate_min':
      return 'AGG_MIN';
    case 'aggregate_max':
      return 'AGG_MAX';
    case 'aggregate_count':
      return 'COUNT';
    case 'group_by':
      return 'GROUP_BY';
    case 'time_series':
      return 'TIME_BUCKET';
    case 'unsupported_query':
      // This shouldn't reach the guard, but handle it
      return 'COUNT'; // Default fallback
    default:
      return 'COUNT';
  }
}

/**
 * Get allowed operations for a semantic type
 */
function getAllowedOperations(semanticType: SemanticType): OperationCategory[] {
  switch (semanticType) {
    case 'numeric':
      return [
        'AGG_AVG',
        'AGG_SUM',
        'AGG_MIN',
        'AGG_MAX',
        'COUNT',
        'GROUP_BY',
        'CORRELATION',
        'DISTRIBUTION',
      ];
    case 'date':
      return ['AGG_MIN', 'AGG_MAX', 'COUNT', 'GROUP_BY', 'TIME_BUCKET'];
    case 'categorical':
      return ['COUNT', 'GROUP_BY', 'DISTRIBUTION'];
    case 'boolean':
      return ['COUNT', 'GROUP_BY'];
    case 'unknown':
      return []; // Block all operations for unknown types
    default:
      return [];
  }
}

/**
 * Get suggested alternatives for a blocked operation
 */
function getSuggestedAlternatives(
  semanticType: SemanticType,
  attemptedOperation: OperationCategory
): string[] {
  const allowed = getAllowedOperations(semanticType);
  
  if (allowed.length === 0) {
    return ['Please select a different column or clarify the column type'];
  }

  const suggestions: string[] = [];
  
  // Map operations to user-friendly names
  const operationNames: Record<OperationCategory, string> = {
    AGG_AVG: 'average',
    AGG_SUM: 'sum',
    AGG_MIN: 'minimum',
    AGG_MAX: 'maximum',
    COUNT: 'count',
    GROUP_BY: 'group by',
    TIME_BUCKET: 'time-based analysis',
    CORRELATION: 'correlation',
    DISTRIBUTION: 'distribution',
  };

  // Suggest allowed operations
  for (const op of allowed) {
    if (op !== attemptedOperation) {
      suggestions.push(operationNames[op]);
    }
  }

  return suggestions;
}

/**
 * Get reason for blocking an operation
 */
function getBlockReason(
  semanticType: SemanticType,
  attemptedOperation: OperationCategory,
  columnName: string
): string {
  const operationNames: Record<OperationCategory, string> = {
    AGG_AVG: 'averaging',
    AGG_SUM: 'summing',
    AGG_MIN: 'finding minimum',
    AGG_MAX: 'finding maximum',
    COUNT: 'counting',
    GROUP_BY: 'grouping by',
    TIME_BUCKET: 'time-based analysis',
    CORRELATION: 'correlation',
    DISTRIBUTION: 'distribution',
  };

  const operationName = operationNames[attemptedOperation] || attemptedOperation;

  switch (semanticType) {
    case 'date':
      if (attemptedOperation === 'AGG_AVG' || attemptedOperation === 'AGG_SUM') {
        return `Averaging or summing a date column doesn't have a real-world meaning. Dates are ordinal values, not scalar quantities.`;
      }
      if (attemptedOperation === 'CORRELATION') {
        return `Correlation on date columns requires numeric time deltas. Use time-based analysis instead.`;
      }
      return `The operation "${operationName}" is not meaningful for date columns.`;
    
    case 'categorical':
      if (attemptedOperation === 'AGG_AVG' || attemptedOperation === 'AGG_SUM') {
        return `Averaging or summing a categorical column doesn't have a real-world meaning. Categorical values are labels, not quantities.`;
      }
      if (attemptedOperation === 'CORRELATION') {
        return `Correlation requires numeric values. Categorical columns can be used for grouping or distribution analysis.`;
      }
      return `The operation "${operationName}" is not meaningful for categorical columns.`;
    
    case 'boolean':
      if (attemptedOperation === 'AGG_AVG' || attemptedOperation === 'AGG_SUM') {
        return `Averaging or summing a boolean column doesn't have a real-world meaning. Boolean values are true/false, not quantities.`;
      }
      if (attemptedOperation === 'CORRELATION') {
        return `Correlation requires numeric values. Boolean columns can be used for counting or grouping.`;
      }
      return `The operation "${operationName}" is not meaningful for boolean columns.`;
    
    case 'unknown':
      return `The column type is unknown. Please select a different column or ensure the column has been properly profiled.`;
    
    default:
      return `The operation "${operationName}" is not valid for ${semanticType} columns.`;
  }
}

/**
 * Validate a single column-operation pair
 */
function validateOperation(
  column: ColumnProfile,
  operation: OperationCategory,
  datasetVersionId: string
): SemanticGuardResult {
  const semanticType = mapToSemanticType(column.type, column);
  const allowedOperations = getAllowedOperations(semanticType);
  const isValid = allowedOperations.includes(operation);

  const result: SemanticGuardResult = {
    isValid,
    column: column.name,
    semanticType,
    attemptedOperation: operation,
  };

  if (!isValid) {
    result.reason = getBlockReason(semanticType, operation, column.name);
    result.suggestedAlternatives = getSuggestedAlternatives(semanticType, operation);
  }

  return result;
}

/**
 * Validate metric operation (main column being aggregated)
 */
export function validateMetricOperation(
  resolution: MetricResolution,
  intent: AnalyticsIntent,
  datasetVersionId: string
): SemanticGuardResult {
  const operation = mapIntentToOperation(intent);
  const metricColumn = resolution.metric.columnProfile;

  return validateOperation(metricColumn, operation, datasetVersionId);
}

/**
 * Validate dimension operation (for GROUP_BY)
 */
export function validateDimensionOperation(
  resolution: MetricResolution,
  intent: AnalyticsIntent,
  datasetVersionId: string
): SemanticGuardResult | null {
  // Only validate dimension for GROUP_BY operations
  if (intent !== 'group_by' || !resolution.dimension) {
    return null;
  }

  const operation: OperationCategory = 'GROUP_BY';
  const dimensionColumn = resolution.dimension.columnProfile;

  return validateOperation(dimensionColumn, operation, datasetVersionId);
}

/**
 * Validate time column operation (for TIME_BUCKET)
 */
export function validateTimeColumnOperation(
  resolution: MetricResolution,
  intent: AnalyticsIntent,
  datasetVersionId: string
): SemanticGuardResult | null {
  // Only validate time column for TIME_BUCKET operations
  if (intent !== 'time_series' || !resolution.timeColumn) {
    return null;
  }

  const operation: OperationCategory = 'TIME_BUCKET';
  const timeColumn = resolution.timeColumn.columnProfile;

  return validateOperation(timeColumn, operation, datasetVersionId);
}

/**
 * Main guard function - validates all operations in a resolution
 * Returns the first invalid result, or null if all are valid
 */
export function validateSemanticOperations(
  resolution: MetricResolution,
  intent: AnalyticsIntent,
  datasetVersionId: string
): SemanticGuardResult | null {
  // Validate metric operation (always required)
  const metricResult = validateMetricOperation(resolution, intent, datasetVersionId);
  if (!metricResult.isValid) {
    return metricResult;
  }

  // Validate dimension operation (if present)
  const dimensionResult = validateDimensionOperation(resolution, intent, datasetVersionId);
  if (dimensionResult && !dimensionResult.isValid) {
    return dimensionResult;
  }

  // Validate time column operation (if present)
  const timeResult = validateTimeColumnOperation(resolution, intent, datasetVersionId);
  if (timeResult && !timeResult.isValid) {
    return timeResult;
  }

  // All operations are valid
  return null;
}

