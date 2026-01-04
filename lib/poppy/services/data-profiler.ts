/**
 * Phase 1: Data Profiler Service
 * Data Analyst Agent (Poppy) - Deterministic Data Profiling
 * 
 * Profiles datasets deterministically without AI
 */

import { ParsedData } from './data-parser';

export type ColumnType = 'string' | 'number' | 'boolean' | 'date';

export interface ColumnProfile {
  name: string;
  type: ColumnType;
  nullCount: number;
  nullRatio: number;
  distinctCount: number;
  min?: number;
  max?: number;
  mean?: number;
}

export interface DatasetProfile {
  datasetVersionId: string;
  rowCount: number;
  columnCount: number;
  columns: ColumnProfile[];
}

/**
 * Infer column type from values
 */
function inferType(values: unknown[]): ColumnType {
  const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '');
  
  if (nonNullValues.length === 0) {
    return 'string'; // Default to string if all null
  }

  // Check for boolean
  const booleanValues = nonNullValues.filter(v => {
    const str = String(v).toLowerCase().trim();
    return str === 'true' || str === 'false' || str === '1' || str === '0' || str === 'yes' || str === 'no';
  });
  if (booleanValues.length === nonNullValues.length) {
    return 'boolean';
  }

  // Check for date
  let dateCount = 0;
  for (const value of nonNullValues) {
    const str = String(value).trim();
    // Common date patterns
    if (
      /^\d{4}-\d{2}-\d{2}/.test(str) || // YYYY-MM-DD
      /^\d{2}\/\d{2}\/\d{4}/.test(str) || // MM/DD/YYYY
      /^\d{2}-\d{2}-\d{4}/.test(str) || // MM-DD-YYYY
      /^\d{4}\/\d{2}\/\d{2}/.test(str) // YYYY/MM/DD
    ) {
      const date = new Date(str);
      if (!isNaN(date.getTime())) {
        dateCount++;
      }
    }
  }
  // If more than 80% are valid dates, consider it a date column
  if (dateCount / nonNullValues.length > 0.8) {
    return 'date';
  }

  // Check for number
  let numberCount = 0;
  const numbers: number[] = [];
  for (const value of nonNullValues) {
    const num = parseFloat(String(value).replace(/,/g, ''));
    if (!isNaN(num) && isFinite(num)) {
      numberCount++;
      numbers.push(num);
    }
  }
  // If more than 80% are valid numbers, consider it a number column
  if (numberCount / nonNullValues.length > 0.8) {
    return 'number';
  }

  // Default to string
  return 'string';
}

/**
 * Calculate numeric statistics
 */
function calculateNumericStats(values: unknown[]): { min?: number; max?: number; mean?: number } {
  const numbers: number[] = [];
  
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const num = parseFloat(String(value).replace(/,/g, ''));
    if (!isNaN(num) && isFinite(num)) {
      numbers.push(num);
    }
  }

  if (numbers.length === 0) {
    return {};
  }

  const sorted = [...numbers].sort((a, b) => a - b);
  const sum = numbers.reduce((acc, val) => acc + val, 0);
  const mean = sum / numbers.length;

  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: Number(mean.toFixed(2)),
  };
}

/**
 * Count distinct values
 */
function countDistinct(values: unknown[]): number {
  const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '');
  const distinct = new Set(nonNullValues.map(v => String(v).toLowerCase().trim()));
  return distinct.size;
}

/**
 * Profile a parsed dataset
 */
export function profileDataset(
  parsedData: ParsedData,
  datasetVersionId: string
): DatasetProfile {
  if (parsedData.rows.length === 0) {
    throw new Error('Cannot profile empty dataset');
  }

  if (parsedData.headers.length === 0) {
    throw new Error('Cannot profile dataset with no columns');
  }

  const columns: ColumnProfile[] = [];

  for (const header of parsedData.headers) {
    // Extract column values
    const values = parsedData.rows.map(row => row[header]);

    // Count nulls
    const nullCount = values.filter(v => v === null || v === undefined || v === '').length;
    const nullRatio = Number((nullCount / values.length).toFixed(4));

    // Infer type
    const type = inferType(values);

    // Get distinct count
    const distinctCount = countDistinct(values);

    // Calculate numeric stats if numeric
    const numericStats = type === 'number' ? calculateNumericStats(values) : {};

    columns.push({
      name: header,
      type,
      nullCount,
      nullRatio,
      distinctCount,
      ...numericStats,
    });
  }

  return {
    datasetVersionId,
    rowCount: parsedData.rowCount,
    columnCount: parsedData.columnCount,
    columns,
  };
}

