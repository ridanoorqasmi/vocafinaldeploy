/**
 * Phase 7: Data Quality Check Service
 * Data Analyst Agent (Poppy) - Deterministic Data Quality Checks
 * 
 * Runs deterministic quality checks on datasets
 * NO LLM - Pure rule-based checks
 */

import type { ParsedData } from './data-parser';
import type { DatasetProfile, ColumnProfile } from './data-profiler';

export type WarningSeverity = 'low' | 'medium' | 'high';

export interface QualityWarning {
  code: string;
  severity: WarningSeverity;
  message: string;
}

export interface TimeCoverage {
  column: string;
  minDate: string;
  maxDate: string;
  expectedGranularity: 'daily' | 'weekly' | 'monthly';
  missingPeriodsCount: number;
  coverageRatio: number; // 0-1
  isPartialLatestPeriod: boolean;
}

export interface NullIssue {
  column: string;
  nullRatio: number;
}

export interface OutlierSummary {
  metric: string;
  method: 'IQR' | 'Z_SCORE';
  outlierRatio: number;
}

export interface DataQualityCheckResult {
  datasetVersionId: string;
  checksRunAt: string; // ISO timestamp
  rowCount: number;
  timeCoverage?: TimeCoverage;
  nullIssues: NullIssue[];
  outlierSummary?: OutlierSummary[];
  warnings: QualityWarning[];
}

// Configuration thresholds
const CONFIG = {
  MIN_ROW_COUNT: 50,
  NULL_RATIO_THRESHOLD: 0.3,
  OUTLIER_RATIO_THRESHOLD: 0.2,
  TIME_COVERAGE_THRESHOLD: 0.8,
  OUTLIER_SAMPLE_SIZE: 10000, // For large datasets, sample for outlier detection
};

/**
 * Check A: Row Count Sanity
 */
function checkRowCount(rowCount: number): QualityWarning | null {
  if (rowCount < CONFIG.MIN_ROW_COUNT) {
    return {
      code: 'LOW_ROW_COUNT',
      severity: 'medium',
      message: `Dataset has only ${rowCount} rows. Results may be unreliable with such a small sample size.`,
    };
  }
  return null;
}

/**
 * Check B: Time Coverage (only if time column exists)
 */
function checkTimeCoverage(
  parsedData: ParsedData,
  profile: DatasetProfile
): { timeCoverage?: TimeCoverage; warnings: QualityWarning[] } {
  const warnings: QualityWarning[] = [];
  
  // Find date columns
  const dateColumns = profile.columns.filter(col => col.type === 'date');
  if (dateColumns.length === 0) {
    return { warnings: [] };
  }

  // Use first date column (can be enhanced to pick best one)
  const timeColumn = dateColumns[0];
  const timeColumnIndex = parsedData.headers.indexOf(timeColumn.name);
  
  if (timeColumnIndex === -1) {
    return { warnings: [] };
  }

  // Extract and parse dates
  const dates: Date[] = [];
  for (const row of parsedData.rows) {
    const value = row[timeColumn.name];
    if (value !== null && value !== undefined && value !== '') {
      const date = new Date(String(value));
      if (!isNaN(date.getTime())) {
        dates.push(date);
      }
    }
  }

  if (dates.length === 0) {
    return { warnings: [] };
  }

  // Find min and max dates
  const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const minDate = sortedDates[0];
  const maxDate = sortedDates[sortedDates.length - 1];

  // Infer granularity from date distribution
  const timeSpan = maxDate.getTime() - minDate.getTime();
  const daysSpan = timeSpan / (1000 * 60 * 60 * 24);
  const expectedGranularity: 'daily' | 'weekly' | 'monthly' = 
    daysSpan < 90 ? 'daily' : daysSpan < 365 ? 'weekly' : 'monthly';

  // Calculate expected periods
  let expectedPeriods = 0;
  const periodMs = expectedGranularity === 'daily' 
    ? 1000 * 60 * 60 * 24
    : expectedGranularity === 'weekly'
    ? 1000 * 60 * 60 * 24 * 7
    : 1000 * 60 * 60 * 24 * 30;

  const current = new Date(minDate);
  while (current <= maxDate) {
    expectedPeriods++;
    if (expectedGranularity === 'daily') {
      current.setDate(current.getDate() + 1);
    } else if (expectedGranularity === 'weekly') {
      current.setDate(current.getDate() + 7);
    } else {
      current.setMonth(current.getMonth() + 1);
    }
  }

  // Count unique periods (simplified - just count unique date strings)
  const uniquePeriods = new Set<string>();
  for (const date of dates) {
    let periodKey: string;
    if (expectedGranularity === 'daily') {
      periodKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
    } else if (expectedGranularity === 'weekly') {
      const year = date.getFullYear();
      const week = Math.floor((date.getTime() - new Date(year, 0, 1).getTime()) / (1000 * 60 * 60 * 24 * 7));
      periodKey = `${year}-W${week}`;
    } else {
      periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
    uniquePeriods.add(periodKey);
  }

  const missingPeriodsCount = expectedPeriods - uniquePeriods.size;
  const coverageRatio = uniquePeriods.size / expectedPeriods;

  // Check if latest period is partial
  const latestPeriod = expectedGranularity === 'daily'
    ? maxDate.toISOString().split('T')[0]
    : expectedGranularity === 'weekly'
    ? (() => {
        const year = maxDate.getFullYear();
        const week = Math.floor((maxDate.getTime() - new Date(year, 0, 1).getTime()) / (1000 * 60 * 60 * 24 * 7));
        return `${year}-W${week}`;
      })()
    : `${maxDate.getFullYear()}-${String(maxDate.getMonth() + 1).padStart(2, '0')}`;
  
  const latestPeriodCount = dates.filter(d => {
    let periodKey: string;
    if (expectedGranularity === 'daily') {
      periodKey = d.toISOString().split('T')[0];
    } else if (expectedGranularity === 'weekly') {
      const year = d.getFullYear();
      const week = Math.floor((d.getTime() - new Date(year, 0, 1).getTime()) / (1000 * 60 * 60 * 24 * 7));
      periodKey = `${year}-W${week}`;
    } else {
      periodKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    return periodKey === latestPeriod;
  }).length;

  // Estimate if latest period is partial (heuristic: if count is less than 50% of average)
  const avgPeriodCount = dates.length / uniquePeriods.size;
  const isPartialLatestPeriod = latestPeriodCount < (avgPeriodCount * 0.5);

  const timeCoverage: TimeCoverage = {
    column: timeColumn.name,
    minDate: minDate.toISOString(),
    maxDate: maxDate.toISOString(),
    expectedGranularity,
    missingPeriodsCount,
    coverageRatio,
    isPartialLatestPeriod,
  };

  // Generate warnings
  if (isPartialLatestPeriod) {
    warnings.push({
      code: 'PARTIAL_LATEST_PERIOD',
      severity: 'medium',
      message: `Latest ${expectedGranularity} period appears incomplete. Results may not reflect the full period.`,
    });
  }

  if (coverageRatio < CONFIG.TIME_COVERAGE_THRESHOLD) {
    warnings.push({
      code: 'LOW_TIME_COVERAGE',
      severity: 'medium',
      message: `Time series has ${missingPeriodsCount} missing periods (${(coverageRatio * 100).toFixed(1)}% coverage). Analysis may be affected by gaps.`,
    });
  }

  return { timeCoverage, warnings };
}

/**
 * Check C: Null Density Check
 */
function checkNullDensity(profile: DatasetProfile): {
  nullIssues: NullIssue[];
  warnings: QualityWarning[];
} {
  const nullIssues: NullIssue[] = [];
  const warnings: QualityWarning[] = [];

  for (const column of profile.columns) {
    if (column.nullRatio > CONFIG.NULL_RATIO_THRESHOLD) {
      nullIssues.push({
        column: column.name,
        nullRatio: column.nullRatio,
      });

      // Determine severity based on null ratio
      const severity: WarningSeverity = 
        column.nullRatio > 0.5 ? 'high' : 
        column.nullRatio > 0.3 ? 'medium' : 'low';

      warnings.push({
        code: 'HIGH_NULL_RATIO',
        severity,
        message: `Column "${column.name}" has ${(column.nullRatio * 100).toFixed(1)}% null values. This may affect analysis accuracy.`,
      });
    }
  }

  return { nullIssues, warnings };
}

/**
 * Check D: Outlier Dominance Check (sample-based for large datasets)
 */
function checkOutliers(
  parsedData: ParsedData,
  profile: DatasetProfile
): {
  outlierSummary?: OutlierSummary[];
  warnings: QualityWarning[];
} {
  const warnings: QualityWarning[] = [];
  const outlierSummary: OutlierSummary[] = [];

  // Only check numeric columns
  const numericColumns = profile.columns.filter(col => col.type === 'number');
  if (numericColumns.length === 0) {
    return { warnings: [] };
  }

  // Sample data if dataset is large
  const sampleSize = Math.min(parsedData.rowCount, CONFIG.OUTLIER_SAMPLE_SIZE);
  const shouldSample = parsedData.rowCount > CONFIG.OUTLIER_SAMPLE_SIZE;
  const rowsToCheck = shouldSample
    ? parsedData.rows.slice(0, sampleSize)
    : parsedData.rows;

  for (const column of numericColumns) {
    // Extract values
    const values: number[] = [];
    for (const row of rowsToCheck) {
      const value = row[column.name];
      if (value !== null && value !== undefined && value !== '') {
        const num = typeof value === 'number' ? value : parseFloat(String(value));
        if (!isNaN(num) && isFinite(num)) {
          values.push(num);
        }
      }
    }

    if (values.length < 10) {
      continue; // Skip if too few values
    }

    // Use IQR method for outlier detection
    const sorted = [...values].sort((a, b) => a - b);
    const q1Index = Math.floor(sorted.length * 0.25);
    const q3Index = Math.floor(sorted.length * 0.75);
    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    // Count outliers
    const outlierCount = values.filter(v => v < lowerBound || v > upperBound).length;
    const outlierRatio = outlierCount / values.length;

    if (outlierRatio > CONFIG.OUTLIER_RATIO_THRESHOLD) {
      outlierSummary.push({
        metric: column.name,
        method: 'IQR',
        outlierRatio,
      });

      warnings.push({
        code: 'HIGH_OUTLIER_RATIO',
        severity: 'medium',
        message: `Column "${column.name}" has ${(outlierRatio * 100).toFixed(1)}% outliers. Results may be skewed by extreme values.${shouldSample ? ' (Based on sample)' : ''}`,
      });
    }
  }

  return { outlierSummary: outlierSummary.length > 0 ? outlierSummary : undefined, warnings };
}

/**
 * Run all data quality checks
 */
export function runDataQualityChecks(
  parsedData: ParsedData,
  profile: DatasetProfile,
  datasetVersionId: string
): DataQualityCheckResult {
  const warnings: QualityWarning[] = [];
  const checksRunAt = new Date().toISOString();

  // Check A: Row Count
  const rowCountWarning = checkRowCount(profile.rowCount);
  if (rowCountWarning) {
    warnings.push(rowCountWarning);
  }

  // Check B: Time Coverage
  const timeCoverageResult = checkTimeCoverage(parsedData, profile);
  warnings.push(...timeCoverageResult.warnings);

  // Check C: Null Density
  const nullDensityResult = checkNullDensity(profile);
  warnings.push(...nullDensityResult.warnings);

  // Check D: Outliers
  const outlierResult = checkOutliers(parsedData, profile);
  warnings.push(...outlierResult.warnings);

  return {
    datasetVersionId,
    checksRunAt,
    rowCount: profile.rowCount,
    timeCoverage: timeCoverageResult.timeCoverage,
    nullIssues: nullDensityResult.nullIssues,
    outlierSummary: outlierResult.outlierSummary,
    warnings,
  };
}





