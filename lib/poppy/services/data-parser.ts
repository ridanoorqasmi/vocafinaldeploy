/**
 * Phase 1: Data Parser Service
 * Data Analyst Agent (Poppy) - CSV/XLSX Parsing
 * 
 * Parses CSV and XLSX files into structured data
 */

import fs from 'fs';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export interface ParsedData {
  rows: Record<string, unknown>[];
  headers: string[];
  rowCount: number;
  columnCount: number;
}

export interface ParseOptions {
  hasHeaders?: boolean;
  delimiter?: string;
}

/**
 * Parse CSV file
 */
export function parseCSV(
  filePath: string,
  options: ParseOptions = { hasHeaders: true, delimiter: ',' }
): ParsedData {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  // Check file permissions
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
  } catch (error) {
    throw new Error(`Cannot access file: ${filePath}. Please check file permissions.`);
  }

  let fileContent;
  try {
    fileContent = fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to read CSV file: ${errorMessage}. File path: ${filePath}`);
  }
  
  if (!fileContent || fileContent.trim().length === 0) {
    throw new Error('File is empty');
  }

  const parseResult = Papa.parse(fileContent, {
    header: options.hasHeaders ?? true,
    delimiter: options.delimiter ?? ',',
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim(),
    transform: (value: string) => value.trim(),
  });

  if (parseResult.errors.length > 0) {
    const errorMessages = parseResult.errors.map(e => e.message).join('; ');
    throw new Error(`CSV parsing errors: ${errorMessages}`);
  }

  const rows = parseResult.data as Record<string, unknown>[];
  
  if (rows.length === 0) {
    throw new Error('CSV file contains no data rows');
  }

  // Get headers
  const headers = options.hasHeaders
    ? Object.keys(rows[0] || {})
    : rows[0] ? Object.keys(rows[0]) : [];

  if (headers.length === 0) {
    throw new Error('CSV file has no columns');
  }

  // Validate all rows have same columns
  for (let i = 0; i < rows.length; i++) {
    const rowHeaders = Object.keys(rows[i]);
    if (rowHeaders.length !== headers.length) {
      throw new Error(`Row ${i + 1} has ${rowHeaders.length} columns, expected ${headers.length}`);
    }
  }

  return {
    rows,
    headers,
    rowCount: rows.length,
    columnCount: headers.length,
  };
}

/**
 * Parse XLSX file
 */
export function parseXLSX(
  filePath: string,
  options: ParseOptions = { hasHeaders: true }
): ParsedData {
  // Check file exists
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  // Check file permissions
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
  } catch (error) {
    throw new Error(`Cannot access file: ${filePath}. Please check file permissions.`);
  }

  // Read file as buffer first, then parse with XLSX
  // XLSX.read() with type: 'buffer' expects a buffer, not a file path
  let fileBuffer: Buffer;
  try {
    fileBuffer = fs.readFileSync(filePath);
    if (fileBuffer.length === 0) {
      throw new Error('File is empty');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to read file: ${errorMessage}. File path: ${filePath}`);
  }

  // Parse XLSX from buffer
  let workbook;
  try {
    workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to parse XLSX file: ${errorMessage}. File path: ${filePath}`);
  }
  
  if (workbook.SheetNames.length === 0) {
    throw new Error('XLSX file has no sheets');
  }

  // Use first sheet
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    throw new Error(`Sheet "${sheetName}" not found`);
  }

  // Convert to JSON
  const jsonData = XLSX.utils.sheet_to_json(worksheet, {
    header: options.hasHeaders ? 1 : undefined,
    defval: null,
    raw: false,
  });

  if (jsonData.length === 0) {
    throw new Error('XLSX file contains no data rows');
  }

  // Get headers
  let headers: string[] = [];
  if (options.hasHeaders && jsonData.length > 0) {
    headers = Object.keys(jsonData[0] as Record<string, unknown>);
  } else if (jsonData.length > 0) {
    // Use first row as headers if no headers specified
    const firstRow = jsonData[0] as Record<string, unknown>;
    headers = Object.keys(firstRow);
  }

  if (headers.length === 0) {
    throw new Error('XLSX file has no columns');
  }

  // Convert to consistent format
  const rows = jsonData.map((row: any) => {
    const record: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      record[header] = row[header] ?? row[index] ?? null;
    });
    return record;
  });

  return {
    rows,
    headers,
    rowCount: rows.length,
    columnCount: headers.length,
  };
}

/**
 * Parse file based on extension
 */
export function parseFile(
  filePath: string,
  options: ParseOptions = { hasHeaders: true }
): ParsedData {
  const ext = filePath.toLowerCase().split('.').pop();
  
  switch (ext) {
    case 'csv':
      return parseCSV(filePath, options);
    case 'xlsx':
    case 'xls':
      return parseXLSX(filePath, options);
    default:
      throw new Error(`Unsupported file format: ${ext}. Supported formats: CSV, XLSX`);
  }
}

