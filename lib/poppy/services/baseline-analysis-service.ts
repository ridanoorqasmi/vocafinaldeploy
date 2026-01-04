/**
 * Baseline Analysis Service
 * Data Analyst Agent (Poppy) - Deterministic Baseline Analysis Template
 * 
 * Implements a fixed, rule-based analytical checklist applied uniformly to every dataset.
 * Three phases: Metric Summary, Standard Break downs, and Primary Outcome Detection.
 */

import { parseFile } from './data-parser';
import type { ParsedData } from './data-parser';
import type { DatasetProfile, ColumnProfile } from './data-profiler';

// Configuration constants
const DEFAULT_NON_NULL_THRESHOLD = 0.6; // 60% non-null required
const DEFAULT_MAX_CATEGORICAL_CARDINALITY = 20;
const DEFAULT_MAX_CATEGORICAL_COLUMNS = 3; // Top 2-3 categorical columns for breakdowns
const DEFAULT_MIN_OUTCOME_BALANCE = 0.01; // At least 1% of each class for outcome detection

// Type definitions
export interface MetricSummary {
  columnName: string;
  rowCount: number;
  nonNullCount: number;
  mean: number;
  min: number;
  max: number;
  distribution: DistributionBucket[];
}

export interface DistributionBucket {
  bucket: string;
  count: number;
  percentage: number;
}

export interface BreakdownResult {
  categoricalColumn: string;
  metricColumn: string;
  breakdowns: CategoryBreakdown[];
}

export interface CategoryBreakdown {
  category: string;
  count: number;
  averageMetric: number;
}

export interface OutcomeAnalysis {
  outcomeColumn: string;
  outcomeRate: number;
  breakdownsByCategory: CategoryOutcomeBreakdown[];
  breakdownsByMetric: MetricOutcomeBreakdown[];
  keyDifferences?: KeyDifference[]; // Optional: only present when applicable
}

export interface CategoryOutcomeBreakdown {
  categoryColumn: string;
  breakdowns: {
    category: string;
    outcomeRate: number;
    count: number;
  }[];
}

export interface MetricOutcomeBreakdown {
  metricColumn: string;
  averageWithOutcome: number;
  averageWithoutOutcome: number;
  difference: number;
}

export interface KeyDifference {
  metricColumn: string;
  averageGroupA: number;
  averageGroupB: number;
  absoluteDifference: number;
  relativeDifference: number; // percentage
  rank: number;
}

export interface BaselineAnalysisResult {
  phaseA: {
    metricSummaries: MetricSummary[];
  };
  phaseB: {
    breakdowns: BreakdownResult[];
  };
  phaseC: {
    outcomeAnalysis: OutcomeAnalysis | null;
  };
  metadata: {
    datasetVersionId: string;
    rowCount: number;
    analyzedAt: string;
  };
}

/**
 * Check if a column name suggests it's an ID, hash, or identifier
 */
function isIdentifierColumn(columnName: string): boolean {
  const lowerName = columnName.toLowerCase();
  const idPatterns = [
    /^id$/,
    /_id$/,
    /^uuid$/,
    /^guid$/,
    /^hash$/,
    /_hash$/,
    /^key$/,
    /_key$/,
    /^pk$/,
    /^fk$/,
    /^primary_key$/,
    /^foreign_key$/,
  ];
  
  return idPatterns.some(pattern => pattern.test(lowerName));
}

/**
 * Check if a column name suggests it's a timestamp
 */
function isTimestampColumn(columnName: string): boolean {
  const lowerName = columnName.toLowerCase();
  const timestampPatterns = [
    /timestamp/,
    /_at$/,
    /^created/,
    /^updated/,
    /^date$/,
    /^time$/,
    /datetime/,
  ];
  
  return timestampPatterns.some(pattern => pattern.test(lowerName));
}

/**
 * Check if a column has high cardinality (likely an identifier)
 */
function hasHighCardinality(column: ColumnProfile, rowCount: number): boolean {
  // If distinct count is close to row count, it's likely an identifier
  const distinctRatio = column.distinctCount / rowCount;
  return distinctRatio > 0.9 && column.distinctCount > 100;
}

/**
 * Select numeric columns for Phase A (Metric Summary)
 */
function selectNumericColumns(
  profile: DatasetProfile,
  nonNullThreshold: number = DEFAULT_NON_NULL_THRESHOLD
): ColumnProfile[] {
  return profile.columns.filter(col => {
    // Must be numeric type
    if (col.type !== 'number') return false;
    
    // Must meet non-null threshold
    const nonNullRatio = 1 - col.nullRatio;
    if (nonNullRatio < nonNullThreshold) return false;
    
    // Exclude identifiers
    if (isIdentifierColumn(col.name)) return false;
    
    // Exclude timestamps
    if (isTimestampColumn(col.name)) return false;
    
    // Exclude high cardinality (likely identifiers)
    if (hasHighCardinality(col, profile.rowCount)) return false;
    
    return true;
  });
}

/**
 * Select categorical columns for Phase B (Standard Break downs)
 */
function selectCategoricalColumns(
  profile: DatasetProfile,
  maxCardinality: number = DEFAULT_MAX_CATEGORICAL_CARDINALITY
): ColumnProfile[] {
  return profile.columns
    .filter(col => {
      // Must be categorical type (string, boolean, or date treated as categorical)
      if (col.type !== 'string' && col.type !== 'boolean') return false;
      
      // Must have reasonable cardinality
      if (col.distinctCount > maxCardinality) return false;
      
      // Exclude identifiers
      if (isIdentifierColumn(col.name)) return false;
      
      // Exclude timestamps
      if (isTimestampColumn(col.name)) return false;
      
      // Must have at least 2 distinct values
      if (col.distinctCount < 2) return false;
      
      return true;
    })
    .sort((a, b) => {
      // Sort by cardinality (ascending) then by name for determinism
      if (a.distinctCount !== b.distinctCount) {
        return a.distinctCount - b.distinctCount;
      }
      return a.name.localeCompare(b.name);
    });
}

/**
 * Detect outcome column for Phase C (Primary Outcome Detection)
 */
export function detectOutcomeColumn(profile: DatasetProfile, data: ParsedData): string | null {
  // Look for boolean columns
  const booleanColumns = profile.columns.filter(
    col => col.type === 'boolean'
  );
  
  // Look for binary categorical columns (exactly 2 distinct values)
  const binaryColumns = profile.columns.filter(
    col => col.type === 'string' && col.distinctCount === 2
  );
  
  // Combine candidates
  const candidates = [...booleanColumns, ...binaryColumns];
  
  for (const col of candidates) {
    // Exclude identifiers
    if (isIdentifierColumn(col.name)) continue;
    
    // Check class balance
    const valueCounts = new Map<string, number>();
    for (const row of data.rows) {
      const value = row[col.name];
      if (value !== null && value !== undefined && value !== '') {
        const strValue = String(value).toLowerCase().trim();
        valueCounts.set(strValue, (valueCounts.get(strValue) || 0) + 1);
      }
    }
    
    if (valueCounts.size !== 2) continue;
    
    const counts = Array.from(valueCounts.values());
    const total = counts.reduce((a, b) => a + b, 0);
    const minRatio = Math.min(...counts) / total;
    
    // Check if balance is reasonable (not 99/1)
    if (minRatio >= DEFAULT_MIN_OUTCOME_BALANCE) {
      return col.name;
    }
  }
  
  return null;
}

/**
 * Generate histogram buckets for a numeric column
 */
export function generateHistogram(
  values: number[],
  numBuckets: number = 10
): DistributionBucket[] {
  if (values.length === 0) return [];
  
  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  
  if (min === max) {
    // All values are the same
    return [{
      bucket: min.toFixed(2),
      count: values.length,
      percentage: 100,
    }];
  }
  
  const bucketSize = (max - min) / numBuckets;
  const buckets: DistributionBucket[] = [];
  
  for (let i = 0; i < numBuckets; i++) {
    const bucketMin = min + i * bucketSize;
    const bucketMax = i === numBuckets - 1 ? max : min + (i + 1) * bucketSize;
    const bucketLabel = i === numBuckets - 1
      ? `${bucketMin.toFixed(2)}+`
      : `${bucketMin.toFixed(2)}-${bucketMax.toFixed(2)}`;
    
    const count = sorted.filter(v => {
      if (i === numBuckets - 1) {
        return v >= bucketMin && v <= bucketMax;
      }
      return v >= bucketMin && v < bucketMax;
    }).length;
    
    buckets.push({
      bucket: bucketLabel,
      count,
      percentage: Number(((count / values.length) * 100).toFixed(2)),
    });
  }
  
  return buckets;
}

/**
 * Phase A: Generate Metric Summary
 */
function generateMetricSummary(
  profile: DatasetProfile,
  data: ParsedData,
  numericColumns: ColumnProfile[]
): MetricSummary[] {
  const summaries: MetricSummary[] = [];
  
  for (const col of numericColumns) {
    const values: number[] = [];
    
    for (const row of data.rows) {
      const value = row[col.name];
      if (value !== null && value !== undefined && value !== '') {
        const numValue = typeof value === 'number' ? value : parseFloat(String(value));
        if (!isNaN(numValue) && isFinite(numValue)) {
          values.push(numValue);
        }
      }
    }
    
    if (values.length === 0) continue;
    
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    const distribution = generateHistogram(values);
    
    summaries.push({
      columnName: col.name,
      rowCount: data.rowCount,
      nonNullCount: values.length,
      mean: Number(mean.toFixed(2)),
      min: Number(min.toFixed(2)),
      max: Number(max.toFixed(2)),
      distribution,
    });
  }
  
  return summaries;
}

/**
 * Phase B: Generate Standard Break downs
 */
function generateBreakdowns(
  profile: DatasetProfile,
  data: ParsedData,
  numericColumns: ColumnProfile[],
  categoricalColumns: ColumnProfile[]
): BreakdownResult[] {
  const results: BreakdownResult[] = [];
  
  // Select top categorical columns (up to DEFAULT_MAX_CATEGORICAL_COLUMNS)
  const selectedCategorical = categoricalColumns.slice(0, DEFAULT_MAX_CATEGORICAL_COLUMNS);
  
  if (selectedCategorical.length === 0 || numericColumns.length === 0) {
    return results;
  }
  
  for (const catCol of selectedCategorical) {
    for (const numCol of numericColumns) {
      // Group by category and compute average metric
      const categoryGroups = new Map<string, { sum: number; count: number }>();
      
      for (const row of data.rows) {
        const catValue = row[catCol.name];
        const numValue = row[numCol.name];
        
        if (catValue === null || catValue === undefined || catValue === '') continue;
        if (numValue === null || numValue === undefined || numValue === '') continue;
        
        const num = typeof numValue === 'number' ? numValue : parseFloat(String(numValue));
        if (isNaN(num) || !isFinite(num)) continue;
        
        const catStr = String(catValue).trim();
        const existing = categoryGroups.get(catStr) || { sum: 0, count: 0 };
        existing.sum += num;
        existing.count += 1;
        categoryGroups.set(catStr, existing);
      }
      
      const breakdowns: CategoryBreakdown[] = Array.from(categoryGroups.entries())
        .map(([category, stats]) => ({
          category,
          count: stats.count,
          averageMetric: Number((stats.sum / stats.count).toFixed(2)),
        }))
        .sort((a, b) => a.category.localeCompare(b.category)); // Deterministic ordering
      
      if (breakdowns.length > 0) {
        results.push({
          categoricalColumn: catCol.name,
          metricColumn: numCol.name,
          breakdowns,
        });
      }
    }
  }
  
  return results;
}

/**
 * Phase C: Generate Outcome Analysis
 */
function generateOutcomeAnalysis(
  profile: DatasetProfile,
  data: ParsedData,
  outcomeColumn: string,
  numericColumns: ColumnProfile[],
  categoricalColumns: ColumnProfile[]
): OutcomeAnalysis {
  // Determine outcome values
  const outcomeValues = new Set<string>();
  for (const row of data.rows) {
    const value = row[outcomeColumn];
    if (value !== null && value !== undefined && value !== '') {
      outcomeValues.add(String(value).toLowerCase().trim());
    }
  }
  const outcomeValuesArray = Array.from(outcomeValues);
  const positiveOutcome = outcomeValuesArray[0]; // Use first value as "positive"
  
  // Calculate overall outcome rate
  let positiveCount = 0;
  let totalCount = 0;
  for (const row of data.rows) {
    const value = row[outcomeColumn];
    if (value !== null && value !== undefined && value !== '') {
      totalCount++;
      if (String(value).toLowerCase().trim() === positiveOutcome) {
        positiveCount++;
      }
    }
  }
  const outcomeRate = totalCount > 0 ? Number((positiveCount / totalCount).toFixed(4)) : 0;
  
  // Breakdown by category
  const breakdownsByCategory: CategoryOutcomeBreakdown[] = [];
  for (const catCol of categoricalColumns.slice(0, DEFAULT_MAX_CATEGORICAL_COLUMNS)) {
    if (catCol.name === outcomeColumn) continue; // Skip outcome column itself
    
    const categoryGroups = new Map<string, { positive: number; total: number }>();
    
    for (const row of data.rows) {
      const catValue = row[catCol.name];
      const outcomeValue = row[outcomeColumn];
      
      if (catValue === null || catValue === undefined || catValue === '') continue;
      if (outcomeValue === null || outcomeValue === undefined || outcomeValue === '') continue;
      
      const catStr = String(catValue).trim();
      const existing = categoryGroups.get(catStr) || { positive: 0, total: 0 };
      existing.total++;
      if (String(outcomeValue).toLowerCase().trim() === positiveOutcome) {
        existing.positive++;
      }
      categoryGroups.set(catStr, existing);
    }
    
    const breakdowns = Array.from(categoryGroups.entries())
      .map(([category, stats]) => ({
        category,
        outcomeRate: stats.total > 0 ? Number((stats.positive / stats.total).toFixed(4)) : 0,
        count: stats.total,
      }))
      .sort((a, b) => a.category.localeCompare(b.category));
    
    if (breakdowns.length > 0) {
      breakdownsByCategory.push({
        categoryColumn: catCol.name,
        breakdowns,
      });
    }
  }
  
  // Breakdown by numeric metrics
  const breakdownsByMetric: MetricOutcomeBreakdown[] = [];
  for (const numCol of numericColumns) {
    let sumWithOutcome = 0;
    let countWithOutcome = 0;
    let sumWithoutOutcome = 0;
    let countWithoutOutcome = 0;
    
    for (const row of data.rows) {
      const numValue = row[numCol.name];
      const outcomeValue = row[outcomeColumn];
      
      if (numValue === null || numValue === undefined || numValue === '') continue;
      if (outcomeValue === null || outcomeValue === undefined || outcomeValue === '') continue;
      
      const num = typeof numValue === 'number' ? numValue : parseFloat(String(numValue));
      if (isNaN(num) || !isFinite(num)) continue;
      
      const isPositive = String(outcomeValue).toLowerCase().trim() === positiveOutcome;
      if (isPositive) {
        sumWithOutcome += num;
        countWithOutcome++;
      } else {
        sumWithoutOutcome += num;
        countWithoutOutcome++;
      }
    }
    
    const avgWith = countWithOutcome > 0 ? sumWithOutcome / countWithOutcome : 0;
    const avgWithout = countWithoutOutcome > 0 ? sumWithoutOutcome / countWithoutOutcome : 0;
    
    breakdownsByMetric.push({
      metricColumn: numCol.name,
      averageWithOutcome: Number(avgWith.toFixed(2)),
      averageWithoutOutcome: Number(avgWithout.toFixed(2)),
      difference: Number((avgWith - avgWithout).toFixed(2)),
    });
  }
  
  // Compute Key Difference Ranking
  const keyDifferences: KeyDifference[] = breakdownsByMetric
    .map(metric => {
      const avgA = metric.averageWithOutcome;
      const avgB = metric.averageWithoutOutcome;
      const absoluteDiff = Math.abs(avgA - avgB);
      
      // Compute relative difference safely (handle divide-by-zero)
      let relativeDiff = 0;
      if (avgA !== 0) {
        relativeDiff = (absoluteDiff / Math.abs(avgA)) * 100;
      } else if (avgB !== 0) {
        relativeDiff = (absoluteDiff / Math.abs(avgB)) * 100;
      }
      
      return {
        metricColumn: metric.metricColumn,
        averageGroupA: avgA,
        averageGroupB: avgB,
        absoluteDifference: Number(absoluteDiff.toFixed(2)),
        relativeDifference: Number(relativeDiff.toFixed(2)),
        rank: 0, // Will be set after sorting
      };
    })
    .sort((a, b) => {
      // Primary sort: absolute difference (descending)
      if (a.absoluteDifference !== b.absoluteDifference) {
        return b.absoluteDifference - a.absoluteDifference;
      }
      // Secondary sort: relative difference (descending)
      return b.relativeDifference - a.relativeDifference;
    })
    .slice(0, 7) // Top 7 metrics
    .map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

  return {
    outcomeColumn,
    outcomeRate,
    breakdownsByCategory,
    breakdownsByMetric,
    keyDifferences: keyDifferences.length > 0 ? keyDifferences : undefined,
  };
}

/**
 * Main function: Generate Baseline Analysis
 */
export async function generateBaselineAnalysis(
  profile: DatasetProfile,
  filePath: string
): Promise<BaselineAnalysisResult> {
  // Load and parse data
  const data = parseFile(filePath);
  
  // Phase A: Select numeric columns
  const numericColumns = selectNumericColumns(profile);
  
  // Phase B: Select categorical columns
  const categoricalColumns = selectCategoricalColumns(profile);
  
  // Phase C: Detect outcome column
  const outcomeColumn = detectOutcomeColumn(profile, data);
  
  // Generate Phase A: Metric Summary
  const metricSummaries = generateMetricSummary(profile, data, numericColumns);
  
  // Generate Phase B: Standard Break downs
  const breakdowns = generateBreakdowns(profile, data, numericColumns, categoricalColumns);
  
  // Generate Phase C: Outcome Analysis (if applicable)
  const outcomeAnalysis = outcomeColumn
    ? generateOutcomeAnalysis(profile, data, outcomeColumn, numericColumns, categoricalColumns)
    : null;
  
  return {
    phaseA: {
      metricSummaries,
    },
    phaseB: {
      breakdowns,
    },
    phaseC: {
      outcomeAnalysis,
    },
    metadata: {
      datasetVersionId: profile.datasetVersionId,
      rowCount: profile.rowCount,
      analyzedAt: new Date().toISOString(),
    },
  };
}

