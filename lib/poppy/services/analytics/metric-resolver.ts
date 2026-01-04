/**
 * Phase 3: Metric & Dimension Resolver
 * Data Analyst Agent (Poppy) - Column Resolution
 * 
 * Resolves metric columns, dimension columns, and time columns from user questions
 */

import type { DatasetProfile, ColumnProfile } from '../data-profiler';

export interface ResolvedMetric {
  columnName: string;
  columnProfile: ColumnProfile;
}

export interface ResolvedDimension {
  columnName: string;
  columnProfile: ColumnProfile;
}

export interface ResolvedTimeColumn {
  columnName: string;
  columnProfile: ColumnProfile;
}

export interface MetricResolution {
  metric: ResolvedMetric;
  dimension?: ResolvedDimension;
  timeColumn?: ResolvedTimeColumn;
}

export interface ResolutionError {
  code: 'METRIC_NOT_FOUND' | 'METRIC_NOT_NUMERIC' | 'DIMENSION_NOT_FOUND' | 'TIME_COLUMN_NOT_FOUND' | 'NO_NUMERIC_COLUMNS';
  message: string;
}

/**
 * Resolve metric column from user question and dataset profile
 * 
 * IMPORTANT: This function should match explicit column names from ALL columns first,
 * then fall back to numeric-only columns. This allows the semantic guard to properly
 * validate operations on non-numeric columns (e.g., blocking "sum category").
 */
export function resolveMetric(
  userQuestion: string,
  profile: DatasetProfile,
  intent?: 'aggregate_min' | 'aggregate_max' // Allow MIN/MAX to work on dates
): { metric: ResolvedMetric } | ResolutionError {
  const normalized = userQuestion.toLowerCase();
  const columns = profile.columns;

  // For MIN/MAX operations, we can use date columns too (not just numeric)
  const isMinMax = intent === 'aggregate_min' || intent === 'aggregate_max';
  const allowedTypes = isMinMax ? ['number', 'date'] : ['number'];
  const allowedColumns = columns.filter(col => allowedTypes.includes(col.type));

  if (allowedColumns.length === 0) {
    return {
      code: 'NO_NUMERIC_COLUMNS',
      message: isMinMax 
        ? 'Dataset contains no numeric or date columns for min/max operations'
        : 'Dataset contains no numeric columns for aggregation',
    };
  }

  // PHASE 7 FIX: First, try to match ANY column name explicitly mentioned in the question
  // This ensures that if user asks for "total category", we return "category" (not a numeric fallback)
  // The semantic guard will then properly block invalid operations on non-numeric columns
  for (const col of columns) {
    const colNameLower = col.name.toLowerCase();
    
    // Check if column name is explicitly mentioned in the question
    // Use word boundaries to avoid partial matches (e.g., "category" shouldn't match "categories")
    const columnNamePattern = new RegExp(`\\b${colNameLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (columnNamePattern.test(normalized)) {
      // Found explicit column match - return it regardless of type
      // The semantic guard will validate if the operation is valid for this column type
      return { metric: { columnName: col.name, columnProfile: col } };
    }
  }

  // If no explicit column match, try to match allowed columns by name
  for (const col of allowedColumns) {
    const colNameLower = col.name.toLowerCase();
    
    // Exact match
    if (normalized.includes(colNameLower)) {
      return { metric: { columnName: col.name, columnProfile: col } };
    }
  }

  // Try common metric keywords (only for numeric columns)
  const metricKeywords: Record<string, string[]> = {
    revenue: ['revenue', 'income', 'sales', 'amount', 'value', 'price', 'cost'],
    quantity: ['quantity', 'count', 'number', 'qty', 'items'],
    price: ['price', 'cost', 'amount', 'value'],
    total: ['total', 'sum', 'amount', 'value'],
  };

  for (const [keyword, synonyms] of Object.entries(metricKeywords)) {
    if (synonyms.some(syn => normalized.includes(syn))) {
      // Find column that matches keyword or synonyms
      for (const col of allowedColumns) {
        const colNameLower = col.name.toLowerCase();
        if (synonyms.some(syn => colNameLower.includes(syn)) || colNameLower.includes(keyword)) {
          return { metric: { columnName: col.name, columnProfile: col } };
        }
      }
    }
  }

  // Default: use first allowed column (only if no explicit column was mentioned)
  const firstAllowed = allowedColumns[0];
  return { metric: { columnName: firstAllowed.name, columnProfile: firstAllowed } };
}

/**
 * Resolve dimension column from user question
 */
export function resolveDimension(
  userQuestion: string,
  profile: DatasetProfile
): { dimension: ResolvedDimension } | ResolutionError | null {
  const normalized = userQuestion.toLowerCase();
  const columns = profile.columns;

  // Look for "by X" or "per X" patterns
  const byMatch = normalized.match(/\b(by|per|for each|for every)\s+([a-z_]+)\b/i);
  if (byMatch) {
    const dimensionKeyword = byMatch[2];
    
    // Try to find matching column
    for (const col of columns) {
      const colNameLower = col.name.toLowerCase();
      if (colNameLower.includes(dimensionKeyword) || dimensionKeyword.includes(colNameLower)) {
        return { dimension: { columnName: col.name, columnProfile: col } };
      }
    }
  }

  // Try common dimension keywords
  const dimensionKeywords = ['country', 'region', 'category', 'type', 'status', 'group', 'class'];
  for (const keyword of dimensionKeywords) {
    if (normalized.includes(keyword)) {
      for (const col of columns) {
        const colNameLower = col.name.toLowerCase();
        if (colNameLower.includes(keyword)) {
          return { dimension: { columnName: col.name, columnProfile: col } };
        }
      }
    }
  }

  // No dimension found (optional for some queries)
  return null;
}

/**
 * Resolve time column from user question and dataset profile
 */
export function resolveTimeColumn(
  userQuestion: string,
  profile: DatasetProfile
): { timeColumn: ResolvedTimeColumn } | ResolutionError | null {
  const normalized = userQuestion.toLowerCase();
  const columns = profile.columns;

  // Find date columns
  const dateColumns = columns.filter(col => col.type === 'date');

  if (dateColumns.length === 0) {
    return null; // No date columns available
  }

  // Try to match time-related keywords
  const timeKeywords = ['date', 'time', 'day', 'month', 'year', 'created', 'updated', 'timestamp'];
  
  for (const keyword of timeKeywords) {
    if (normalized.includes(keyword)) {
      for (const col of dateColumns) {
        const colNameLower = col.name.toLowerCase();
        if (colNameLower.includes(keyword)) {
          return { timeColumn: { columnName: col.name, columnProfile: col } };
        }
      }
    }
  }

  // Default: use first date column
  if (dateColumns.length > 0) {
    return { timeColumn: { columnName: dateColumns[0].name, columnProfile: dateColumns[0] } };
  }

  return null;
}

/**
 * Resolve all metrics, dimensions, and time columns
 */
export function resolveAll(
  userQuestion: string,
  profile: DatasetProfile,
  intent: 'aggregate_sum' | 'aggregate_avg' | 'aggregate_min' | 'aggregate_max' | 'aggregate_count' | 'group_by' | 'time_series'
): MetricResolution | ResolutionError {
  // Resolve metric (required for all intents)
  // Pass intent to resolveMetric so MIN/MAX can work on date columns
  const metricResult = resolveMetric(userQuestion, profile, intent);
  if ('code' in metricResult) {
    return metricResult;
  }

  const resolution: MetricResolution = {
    metric: metricResult.metric,
  };

  // Resolve dimension (required for group_by, optional for others)
  if (intent === 'group_by') {
    const dimensionResult = resolveDimension(userQuestion, profile);
    if (dimensionResult && 'code' in dimensionResult) {
      return dimensionResult;
    }
    if (dimensionResult && 'dimension' in dimensionResult) {
      resolution.dimension = dimensionResult.dimension;
    } else {
      // For group_by, dimension is required
      return {
        code: 'DIMENSION_NOT_FOUND',
        message: 'Could not identify dimension column for grouping',
      };
    }
  } else {
    // Optional dimension for other intents
    const dimensionResult = resolveDimension(userQuestion, profile);
    if (dimensionResult && 'dimension' in dimensionResult) {
      resolution.dimension = dimensionResult.dimension;
    }
  }

  // Resolve time column (required for time_series)
  if (intent === 'time_series') {
    const timeResult = resolveTimeColumn(userQuestion, profile);
    if (timeResult && 'code' in timeResult) {
      return timeResult;
    }
    if (timeResult && 'timeColumn' in timeResult) {
      resolution.timeColumn = timeResult.timeColumn;
    } else {
      return {
        code: 'TIME_COLUMN_NOT_FOUND',
        message: 'Could not identify time column for time series analysis',
      };
    }
  } else {
    // Optional time column for other intents
    const timeResult = resolveTimeColumn(userQuestion, profile);
    if (timeResult && 'timeColumn' in timeResult) {
      resolution.timeColumn = timeResult.timeColumn;
    }
  }

  return resolution;
}






