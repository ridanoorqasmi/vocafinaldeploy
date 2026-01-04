/**
 * Phase 5: Chart Selection Logic
 * Data Analyst Agent (Poppy) - Rule-Based Chart Type Selection
 * 
 * Selects chart type deterministically based on artifact characteristics
 */

import type { GeneratedArtifact } from '@/lib/poppy/types';
import { isArtifactEligibleForChart, analyzeDataCharacteristics, type DataCharacteristics } from './chart-eligibility';

export type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'stacked_bar';

export interface ChartSpec {
  type: ChartType;
  x: string;
  y: string | string[];
  title: string;
  description?: string;
}

/**
 * Select chart type based on artifact characteristics (rule-based)
 * 
 * Rules:
 * - series + time column → line
 * - table + categorical + numeric → bar
 * - table + categorical ≤ 6 rows → pie
 * - table + multiple metrics → stacked_bar
 * - otherwise → no chart
 */
export function selectChartType(
  artifact: GeneratedArtifact,
  characteristics: DataCharacteristics
): ChartType | null {
  const resultData = artifact.data as any;
  const resultType = resultData?.resultType;
  const resultDataValue = resultData?.resultData as any[];

  // Rule 1: series + time column → line
  if (resultType === 'series' && characteristics.hasTimeColumn) {
    return 'line';
  }

  // Rule 2: table + categorical + numeric → bar
  if (resultType === 'table' && characteristics.hasCategoricalDimension) {
    // Check if we have numeric values
    const hasNumeric = characteristics.columnNames.some(name => {
      const values = resultDataValue.map(row => (row as any)[name]);
      return values.some(v => typeof v === 'number' && !isNaN(v));
    });

    if (hasNumeric) {
      // Rule 3: categorical ≤ 6 groups → pie (override bar)
      if (characteristics.categoricalGroupCount > 0 && characteristics.categoricalGroupCount <= 6) {
        return 'pie';
      }
      return 'bar';
    }
  }

  // Rule 4: table + multiple metrics → stacked_bar
  if (resultType === 'table' && characteristics.hasMultipleMetrics) {
    return 'stacked_bar';
  }

  // Default: no chart
  return null;
}

/**
 * Generate chart spec from artifact (rule-based selection)
 */
export function generateChartSpec(artifact: GeneratedArtifact): ChartSpec | null {
  // Check eligibility
  if (!isArtifactEligibleForChart(artifact)) {
    return null;
  }

  // Analyze characteristics
  const characteristics = analyzeDataCharacteristics(artifact);
  if (!characteristics) {
    return null;
  }

  // Select chart type
  const chartType = selectChartType(artifact, characteristics);
  if (!chartType) {
    return null;
  }

  // Generate chart spec based on type
  const resultData = artifact.data as any;
  const resultDataValue = resultData?.resultData as any[];
  const metadata = artifact.metadata || {};

  // Determine x and y axes
  let xAxis: string;
  let yAxis: string | string[];

  if (chartType === 'line' && metadata.timeColumn) {
    // Line chart: time on x-axis
    xAxis = metadata.timeColumn;
    yAxis = metadata.metric || characteristics.columnNames.find(name => {
      const values = resultDataValue.map(row => (row as any)[name]);
      return values.some(v => typeof v === 'number' && !isNaN(v));
    }) || characteristics.columnNames[1] || 'value';
  } else if (chartType === 'pie') {
    // Pie chart: categorical dimension as labels, metric as values
    xAxis = metadata.dimension || characteristics.columnNames[0] || 'category';
    yAxis = metadata.metric || characteristics.columnNames.find(name => {
      const values = resultDataValue.map(row => (row as any)[name]);
      return values.some(v => typeof v === 'number' && !isNaN(v));
    }) || characteristics.columnNames[1] || 'value';
  } else if (chartType === 'stacked_bar') {
    // Stacked bar: categorical on x, multiple metrics on y
    xAxis = metadata.dimension || characteristics.columnNames[0] || 'category';
    const numericColumns = characteristics.columnNames.filter(name => {
      const values = resultDataValue.map(row => (row as any)[name]);
      return values.some(v => typeof v === 'number' && !isNaN(v));
    });
    yAxis = numericColumns.length > 0 ? numericColumns : [characteristics.columnNames[1] || 'value'];
  } else {
    // Bar chart: categorical on x, metric on y
    xAxis = metadata.dimension || characteristics.columnNames[0] || 'category';
    yAxis = metadata.metric || characteristics.columnNames.find(name => {
      const values = resultDataValue.map(row => (row as any)[name]);
      return values.some(v => typeof v === 'number' && !isNaN(v));
    }) || characteristics.columnNames[1] || 'value';
  }

  // Generate title (use artifact title as base)
  const title = artifact.title || 'Chart';

  return {
    type: chartType,
    x: xAxis,
    y: yAxis,
    title,
  };
}







