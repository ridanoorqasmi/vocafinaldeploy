/**
 * Drill-Down Service
 * Data Analyst Agent (Poppy) - Metric-Scoped Drill-Down Analysis
 * 
 * Provides deeper views of ranked metrics, showing what drives observed differences.
 * Rule-based, deterministic, and scoped to one metric at a time.
 */

import { parseFile } from './data-parser';
import type { ParsedData } from './data-parser';
import type { DatasetProfile, ColumnProfile } from './data-profiler';
import { generateHistogram } from './baseline-analysis-service';
import type { DistributionBucket } from './baseline-analysis-service';

// Configuration constants
const DEFAULT_MAX_CATEGORICAL_CARDINALITY = 20;

// Type definitions
export interface DrillDownRequest {
  datasetVersionId: string;
  filePath: string;
  metricColumn: string;
  outcomeColumn: string;
}

export interface PercentileStats {
  p25: number;
  p50: number; // median
  p75: number;
}

export interface GroupDistribution {
  groupLabel: string;
  distribution: DistributionBucket[];
  percentileStats: PercentileStats;
  count: number;
}

export interface SecondaryBreakdown {
  dimensionColumn: string;
  breakdowns: {
    category: string;
    averageMetric: number;
    count: number;
  }[];
}

export interface DrillDownResult {
  metricColumn: string;
  outcomeColumn: string;
  groupDistributions: {
    groupA: GroupDistribution;
    groupB: GroupDistribution;
  };
  secondaryBreakdown?: SecondaryBreakdown;
}

/**
 * Calculate percentiles for a sorted array
 */
function calculatePercentiles(sortedValues: number[]): PercentileStats {
  if (sortedValues.length === 0) {
    return { p25: 0, p50: 0, p75: 0 };
  }

  const p25Index = Math.floor(sortedValues.length * 0.25);
  const p50Index = Math.floor(sortedValues.length * 0.5);
  const p75Index = Math.floor(sortedValues.length * 0.75);

  return {
    p25: Number(sortedValues[p25Index].toFixed(2)),
    p50: Number(sortedValues[p50Index].toFixed(2)),
    p75: Number(sortedValues[p75Index].toFixed(2)),
  };
}

/**
 * Select one eligible categorical column for secondary breakdown
 */
function selectSecondaryBreakdownDimension(
  profile: DatasetProfile,
  outcomeColumn: string,
  metricColumn: string
): ColumnProfile | null {
  // Find categorical columns that:
  // 1. Are not the outcome column
  // 2. Are not the metric column
  // 3. Have low cardinality (≤ threshold)
  // 4. Are already used in baseline breakdowns (implicitly - we'll check cardinality)
  
  const candidates = profile.columns.filter(col => {
    if (col.name === outcomeColumn) return false;
    if (col.name === metricColumn) return false;
    if (col.type !== 'string' && col.type !== 'boolean') return false;
    if (col.distinctCount > DEFAULT_MAX_CATEGORICAL_CARDINALITY) return false;
    if (col.distinctCount < 2) return false;
    return true;
  });

  if (candidates.length === 0) return null;

  // Select the one with lowest cardinality (most stable breakdown)
  return candidates.sort((a, b) => a.distinctCount - b.distinctCount)[0];
}

/**
 * Generate drill-down analysis for a metric
 */
export async function generateDrillDown(
  request: DrillDownRequest,
  profile: DatasetProfile
): Promise<DrillDownResult> {
  const { filePath, metricColumn, outcomeColumn } = request;

  // Load and parse data
  const data = parseFile(filePath);

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

  // Extract metric values for each group
  const groupAValues: number[] = [];
  const groupBValues: number[] = [];

  for (const row of data.rows) {
    const metricValue = row[metricColumn];
    const outcomeValue = row[outcomeColumn];

    if (metricValue === null || metricValue === undefined || metricValue === '') continue;
    if (outcomeValue === null || outcomeValue === undefined || outcomeValue === '') continue;

    const numValue = typeof metricValue === 'number' ? metricValue : parseFloat(String(metricValue));
    if (isNaN(numValue) || !isFinite(numValue)) continue;

    const isPositive = String(outcomeValue).toLowerCase().trim() === positiveOutcome;
    if (isPositive) {
      groupAValues.push(numValue);
    } else {
      groupBValues.push(numValue);
    }
  }

  // Sort for percentile calculation
  const sortedGroupA = [...groupAValues].sort((a, b) => a - b);
  const sortedGroupB = [...groupBValues].sort((a, b) => a - b);

  // Generate distributions using existing histogram logic
  const groupADistribution = generateHistogram(groupAValues);
  const groupBDistribution = generateHistogram(groupBValues);

  // Calculate percentiles
  const groupAPercentiles = calculatePercentiles(sortedGroupA);
  const groupBPercentiles = calculatePercentiles(sortedGroupB);

  // Build group distributions
  const groupDistributions = {
    groupA: {
      groupLabel: 'With Outcome',
      distribution: groupADistribution,
      percentileStats: groupAPercentiles,
      count: groupAValues.length,
    },
    groupB: {
      groupLabel: 'Without Outcome',
      distribution: groupBDistribution,
      percentileStats: groupBPercentiles,
      count: groupBValues.length,
    },
  };

  // Optional: Secondary breakdown
  const secondaryDimension = selectSecondaryBreakdownDimension(profile, outcomeColumn, metricColumn);
  let secondaryBreakdown: SecondaryBreakdown | undefined;

  if (secondaryDimension) {
    const categoryGroups = new Map<string, { sum: number; count: number }>();

    for (const row of data.rows) {
      const metricValue = row[metricColumn];
      const categoryValue = row[secondaryDimension.name];
      const outcomeValue = row[outcomeColumn];

      if (metricValue === null || metricValue === undefined || metricValue === '') continue;
      if (categoryValue === null || categoryValue === undefined || categoryValue === '') continue;
      if (outcomeValue === null || outcomeValue === undefined || outcomeValue === '') continue;

      const numValue = typeof metricValue === 'number' ? metricValue : parseFloat(String(metricValue));
      if (isNaN(numValue) || !isFinite(numValue)) continue;

      const catStr = String(categoryValue).trim();
      const existing = categoryGroups.get(catStr) || { sum: 0, count: 0 };
      existing.sum += numValue;
      existing.count += 1;
      categoryGroups.set(catStr, existing);
    }

    const breakdowns = Array.from(categoryGroups.entries())
      .map(([category, stats]) => ({
        category,
        averageMetric: Number((stats.sum / stats.count).toFixed(2)),
        count: stats.count,
      }))
      .sort((a, b) => a.category.localeCompare(b.category)); // Deterministic ordering

    if (breakdowns.length > 0) {
      secondaryBreakdown = {
        dimensionColumn: secondaryDimension.name,
        breakdowns,
      };
    }
  }

  return {
    metricColumn,
    outcomeColumn,
    groupDistributions,
    secondaryBreakdown,
  };
}

