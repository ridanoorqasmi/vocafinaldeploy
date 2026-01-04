/**
 * Phase 1: File Storage Service
 * Data Analyst Agent (Poppy) - Dataset File Storage
 * 
 * Handles storage and retrieval of dataset files
 */

import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const DATASETS_DIR = path.join(process.cwd(), 'data', 'poppy', 'datasets');

/**
 * Ensure datasets directory exists
 */
function ensureDatasetsDir(): string {
  if (!fs.existsSync(DATASETS_DIR)) {
    fs.mkdirSync(DATASETS_DIR, { recursive: true });
  }
  return DATASETS_DIR;
}

/**
 * Save uploaded dataset file
 * @param fileBuffer - File buffer
 * @param filename - Original filename
 * @param datasetId - Dataset ID
 * @param versionId - Version ID
 * @returns File path
 */
export function saveDatasetFile(
  fileBuffer: Buffer,
  filename: string,
  datasetId: string,
  versionId: string
): string {
  ensureDatasetsDir();
  
  // Create dataset-specific directory
  const datasetDir = path.join(DATASETS_DIR, datasetId);
  if (!fs.existsSync(datasetDir)) {
    fs.mkdirSync(datasetDir, { recursive: true });
  }

  // Get file extension
  const ext = path.extname(filename).toLowerCase();
  
  // Save file with version ID
  const savedFilename = `${versionId}${ext}`;
  const filePath = path.join(datasetDir, savedFilename);
  
  fs.writeFileSync(filePath, fileBuffer);
  
  return filePath;
}

/**
 * Read dataset file
 * @param filePath - File path
 * @returns File buffer
 */
export function readDatasetFile(filePath: string): Buffer {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  return fs.readFileSync(filePath);
}

/**
 * Delete dataset file
 * @param filePath - File path
 */
export function deleteDatasetFile(filePath: string): void {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

/**
 * Get file size
 * @param filePath - File path
 * @returns File size in bytes
 */
export function getFileSize(filePath: string): number {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  return fs.statSync(filePath).size;
}

