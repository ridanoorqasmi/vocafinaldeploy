/**
 * Phase 3: Data Execution Engine
 * Data Analyst Agent (Poppy) - Deterministic Analytics Execution
 * 
 * Executes analytical queries on dataset data using in-memory processing
 * (DuckDB can be added later for larger datasets)
 */

import { parseFile } from '../data-parser';
import type { ParsedData } from '../data-parser';
import type { AnalyticsIntent } from './intent-classifier';
import type { MetricResolution } from './metric-resolver';

export type AnalysisResultType = 'table' | 'series' | 'scalar';

export interface AnalysisResult {
  type: AnalysisResultType;
  data: unknown;
  metadata: {
    metric: string;
    dimension?: string;
    timeColumn?: string;
    intent: AnalyticsIntent;
  };
}

export interface ExecutionError {
  code: 'EXECUTION_ERROR' | 'DATA_LOAD_ERROR' | 'QUERY_ERROR';
  message: string;
}

/**
 * Helper to get column value from row, handling various column name formats
 */
function getColumnValue(row: Record<string, unknown>, columnName: string): unknown {
  // Try exact match first
  if (columnName in row) {
    return row[columnName];
  }
  
  // Try case-insensitive match
  const lowerColumnName = columnName.toLowerCase();
  for (const key in row) {
    if (key.toLowerCase() === lowerColumnName) {
      return row[key];
    }
  }
  
  // Try with underscores instead of spaces
  const normalizedName = columnName.replace(/\s+/g, '_');
  if (normalizedName in row) {
    return row[normalizedName];
  }
  
  return undefined;
}

/**
 * Execute aggregate SUM query
 */
function executeSum(
  data: ParsedData,
  metric: string
): AnalysisResult {
  let sum = 0;
  let count = 0;

  for (const row of data.rows) {
    const value = getColumnValue(row, metric);
    if (value !== null && value !== undefined && value !== '') {
      const numValue = typeof value === 'number' ? value : parseFloat(String(value));
      if (!isNaN(numValue)) {
        sum += numValue;
        count++;
      }
    }
  }

  return {
    type: 'scalar',
    data: sum,
    metadata: {
      metric,
      intent: 'aggregate_sum',
    },
  };
}

/**
 * Execute aggregate AVG query
 */
function executeAvg(
  data: ParsedData,
  metric: string
): AnalysisResult {
  let sum = 0;
  let count = 0;

  for (const row of data.rows) {
    const value = getColumnValue(row, metric);
    if (value !== null && value !== undefined && value !== '') {
      const numValue = typeof value === 'number' ? value : parseFloat(String(value));
      if (!isNaN(numValue)) {
        sum += numValue;
        count++;
      }
    }
  }

  const average = count > 0 ? sum / count : 0;

  return {
    type: 'scalar',
    data: average,
    metadata: {
      metric,
      intent: 'aggregate_avg',
    },
  };
}

/**
 * Execute aggregate COUNT query
 */
function executeCount(
  data: ParsedData
): AnalysisResult {
  return {
    type: 'scalar',
    data: data.rowCount,
    metadata: {
      metric: 'count',
      intent: 'aggregate_count',
    },
  };
}

/**
 * Execute aggregate MIN query
 */
function executeMin(
  data: ParsedData,
  column: string
): AnalysisResult {
  let minValue: unknown = null;
  let found = false;

  for (const row of data.rows) {
    const value = getColumnValue(row, column);
    if (value !== null && value !== undefined && value !== '') {
      if (!found) {
        minValue = value;
        found = true;
      } else {
        // Compare values
        if (typeof value === 'number' && typeof minValue === 'number') {
          if (value < minValue) {
            minValue = value;
          }
        } else if (value instanceof Date && minValue instanceof Date) {
          if (value < minValue) {
            minValue = value;
          }
        } else {
          // Try to parse as date
          const valueDate = new Date(String(value));
          const minDate = new Date(String(minValue));
          if (!isNaN(valueDate.getTime()) && !isNaN(minDate.getTime())) {
            if (valueDate < minDate) {
              minValue = value;
            }
          } else {
            // String comparison
            if (String(value) < String(minValue)) {
              minValue = value;
            }
          }
        }
      }
    }
  }

  return {
    type: 'scalar',
    data: minValue,
    metadata: {
      metric: column,
      intent: 'aggregate_min',
    },
  };
}

/**
 * Execute aggregate MAX query
 */
function executeMax(
  data: ParsedData,
  column: string
): AnalysisResult {
  let maxValue: unknown = null;
  let found = false;

  for (const row of data.rows) {
    const value = getColumnValue(row, column);
    if (value !== null && value !== undefined && value !== '') {
      if (!found) {
        maxValue = value;
        found = true;
      } else {
        // Compare values
        if (typeof value === 'number' && typeof maxValue === 'number') {
          if (value > maxValue) {
            maxValue = value;
          }
        } else if (value instanceof Date && maxValue instanceof Date) {
          if (value > maxValue) {
            maxValue = value;
          }
        } else {
          // Try to parse as date
          const valueDate = new Date(String(value));
          const maxDate = new Date(String(maxValue));
          if (!isNaN(valueDate.getTime()) && !isNaN(maxDate.getTime())) {
            if (valueDate > maxDate) {
              maxValue = value;
            }
          } else {
            // String comparison
            if (String(value) > String(maxValue)) {
              maxValue = value;
            }
          }
        }
      }
    }
  }

  return {
    type: 'scalar',
    data: maxValue,
    metadata: {
      metric: column,
      intent: 'aggregate_max',
    },
  };
}

/**
 * Execute GROUP BY query
 */
function executeGroupBy(
  data: ParsedData,
  metric: string,
  dimension: string
): AnalysisResult {
  const groups = new Map<string, number>();

  for (const row of data.rows) {
    const dimValue = getColumnValue(row, dimension);
    const metricValue = getColumnValue(row, metric);

    if (dimValue !== null && dimValue !== undefined) {
      const dimKey = String(dimValue);
      const numValue = typeof metricValue === 'number' ? metricValue : parseFloat(String(metricValue));
      
      if (!isNaN(numValue)) {
        const current = groups.get(dimKey) || 0;
        groups.set(dimKey, current + numValue);
      }
    }
  }

  // Convert to array and sort by total descending
  const result = Array.from(groups.entries())
    .map(([dimensionValue, total]) => ({
      [dimension]: dimensionValue,
      total,
    }))
    .sort((a, b) => (b.total as number) - (a.total as number));

  return {
    type: 'table',
    data: result,
    metadata: {
      metric,
      dimension,
      intent: 'group_by',
    },
  };
}

/**
 * Execute TIME SERIES query
 */
function executeTimeSeries(
  data: ParsedData,
  metric: string,
  timeColumn: string,
  bucket: 'day' | 'month' | 'year' = 'day'
): AnalysisResult {
  const groups = new Map<string, number>();

  for (const row of data.rows) {
    const timeValue = getColumnValue(row, timeColumn);
    const metricValue = getColumnValue(row, metric);

    if (timeValue !== null && timeValue !== undefined) {
      let timeKey: string;
      
      try {
        const date = new Date(String(timeValue));
        if (isNaN(date.getTime())) {
          continue; // Skip invalid dates
        }

        switch (bucket) {
          case 'day':
            timeKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
            break;
          case 'month':
            timeKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
            break;
          case 'year':
            timeKey = String(date.getFullYear()); // YYYY
            break;
          default:
            timeKey = date.toISOString().split('T')[0];
        }
      } catch {
        continue; // Skip invalid dates
      }

      const numValue = typeof metricValue === 'number' ? metricValue : parseFloat(String(metricValue));
      if (!isNaN(numValue)) {
        const current = groups.get(timeKey) || 0;
        groups.set(timeKey, current + numValue);
      }
    }
  }

  // Convert to array and sort by time ascending
  const result = Array.from(groups.entries())
    .map(([timeBucket, total]) => ({
      time_bucket: timeBucket,
      total,
    }))
    .sort((a, b) => a.time_bucket.localeCompare(b.time_bucket));

  return {
    type: 'series',
    data: result,
    metadata: {
      metric,
      timeColumn,
      intent: 'time_series',
    },
  };
}

/**
 * Main execution function
 */
export function executeAnalysis(
  filePath: string,
  intent: AnalyticsIntent,
  resolution: MetricResolution
): AnalysisResult | ExecutionError {
  try {
    // Load and parse data
    const parsedData = parseFile(filePath);

    // Execute based on intent
    switch (intent) {
      case 'aggregate_sum':
        return executeSum(parsedData, resolution.metric.columnName);
      
      case 'aggregate_avg':
        return executeAvg(parsedData, resolution.metric.columnName);
      
      case 'aggregate_min':
        return executeMin(parsedData, resolution.metric.columnName);
      
      case 'aggregate_max':
        return executeMax(parsedData, resolution.metric.columnName);
      
      case 'aggregate_count':
        return executeCount(parsedData);
      
      case 'group_by':
        if (!resolution.dimension) {
          return {
            code: 'EXECUTION_ERROR',
            message: 'Dimension is required for group_by intent',
          };
        }
        return executeGroupBy(
          parsedData,
          resolution.metric.columnName,
          resolution.dimension.columnName
        );
      
      case 'time_series':
        if (!resolution.timeColumn) {
          return {
            code: 'EXECUTION_ERROR',
            message: 'Time column is required for time_series intent',
          };
        }
        // Default to day bucket for now
        return executeTimeSeries(
          parsedData,
          resolution.metric.columnName,
          resolution.timeColumn.columnName,
          'day'
        );
      
      case 'unsupported_query':
        return {
          code: 'EXECUTION_ERROR',
          message: 'Query intent is not supported',
        };
      
      default:
        return {
          code: 'EXECUTION_ERROR',
          message: `Unknown intent: ${intent}`,
        };
    }
  } catch (error) {
    return {
      code: 'EXECUTION_ERROR',
      message: error instanceof Error ? error.message : 'Unknown execution error',
    };
  }
}

