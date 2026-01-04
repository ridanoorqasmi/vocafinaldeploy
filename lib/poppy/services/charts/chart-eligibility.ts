/**
 * Phase 5: Chart Eligibility Rules
 * Data Analyst Agent (Poppy) - Chart Validation
 * 
 * Determines if an artifact is eligible for chart generation
 */

import type { GeneratedArtifact } from '@/lib/poppy/types';

/**
 * Check if artifact is eligible for chart generation
 * 
 * Rules:
 * - Artifact type must be table or series
 * - Data must have ≥ 2 rows
 * - Chart must add clarity over raw numbers
 */
export function isArtifactEligibleForChart(artifact: GeneratedArtifact): boolean {
  const resultData = artifact.data as any;
  const resultType = resultData?.resultType;
  const resultDataValue = resultData?.resultData;

  // Rule 1: Only table or series artifacts
  if (resultType !== 'table' && resultType !== 'series') {
    return false;
  }

  // Rule 2: Must have data array
  if (!Array.isArray(resultDataValue)) {
    return false;
  }

  // Rule 3: Must have ≥ 2 rows
  if (resultDataValue.length < 2) {
    return false;
  }

  // Rule 4: Must have at least one row with data
  if (resultDataValue.length === 0 || !resultDataValue[0]) {
    return false;
  }

  return true;
}

/**
 * Get data characteristics for chart selection
 */
export interface DataCharacteristics {
  hasTimeColumn: boolean;
  hasCategoricalDimension: boolean;
  hasMultipleMetrics: boolean;
  categoricalGroupCount: number;
  columnNames: string[];
  firstRow: Record<string, unknown>;
}

export function analyzeDataCharacteristics(artifact: GeneratedArtifact): DataCharacteristics | null {
  if (!isArtifactEligibleForChart(artifact)) {
    return null;
  }

  const resultData = artifact.data as any;
  const resultDataValue = resultData?.resultData as any[];
  const metadata = artifact.metadata || {};

  const firstRow = resultDataValue[0] || {};
  const columnNames = Object.keys(firstRow);

  // Check for time column
  const hasTimeColumn = !!metadata.timeColumn || 
    columnNames.some(name => 
      /date|time|timestamp|created|updated/i.test(name)
    );

  // Check for categorical dimension
  const dimensionColumn = metadata.dimension 
    ? columnNames.find(name => name.toLowerCase() === String(metadata.dimension).toLowerCase())
    : null;
  
  const hasCategoricalDimension = !!dimensionColumn || 
    columnNames.some(name => {
      const values = resultDataValue.map(row => String((row as any)[name] || '')).filter(Boolean);
      const uniqueValues = new Set(values);
      // Consider categorical if distinct count is reasonable (not all unique)
      return uniqueValues.size > 1 && uniqueValues.size < resultDataValue.length * 0.9;
    });

  // Count categorical groups (for pie chart eligibility)
  let categoricalGroupCount = 0;
  if (dimensionColumn) {
    const groups = new Set(resultDataValue.map(row => String((row as any)[dimensionColumn] || '')));
    categoricalGroupCount = groups.size;
  } else if (hasCategoricalDimension) {
    // Find the most likely categorical column
    for (const colName of columnNames) {
      const groups = new Set(resultDataValue.map(row => String((row as any)[colName] || '')));
      if (groups.size > 1 && groups.size <= 6) {
        categoricalGroupCount = groups.size;
        break;
      }
    }
  }

  // Check for multiple metrics (numeric columns)
  const numericColumns = columnNames.filter(name => {
    const values = resultDataValue.map(row => (row as any)[name]);
    return values.some(v => typeof v === 'number' && !isNaN(v));
  });
  const hasMultipleMetrics = numericColumns.length > 1;

  return {
    hasTimeColumn,
    hasCategoricalDimension,
    hasMultipleMetrics,
    categoricalGroupCount,
    columnNames,
    firstRow,
  };
}







