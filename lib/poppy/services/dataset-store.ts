/**
 * Phase 1: In-Memory Dataset Store
 * Data Analyst Agent (Poppy) - Dataset & Profile Storage
 * 
 * In-memory storage for datasets, versions, and profiles
 * Phase 1: No database, in-memory only
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  Dataset,
  DatasetVersion,
} from '@/lib/poppy/types';
import type { DatasetProfile } from './data-profiler';

// In-memory stores
const datasets = new Map<string, Dataset>();
const datasetVersions = new Map<string, DatasetVersion>();
const datasetProfiles = new Map<string, DatasetProfile>();

// Indexes
const versionsByDatasetId = new Map<string, string[]>(); // datasetId -> versionIds[]
const latestVersionByDatasetId = new Map<string, string>(); // datasetId -> latestVersionId

/**
 * Create a new dataset
 */
export function createDataset(
  tenantId: string,
  name: string,
  description?: string
): Dataset {
  const dataset: Dataset = {
    id: uuidv4(),
    tenantId,
    name,
    description,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  datasets.set(dataset.id, dataset);
  versionsByDatasetId.set(dataset.id, []);

  return dataset;
}

/**
 * Get dataset by ID
 */
export function getDataset(datasetId: string): Dataset | null {
  return datasets.get(datasetId) || null;
}

/**
 * Get all datasets for a tenant
 */
export function getDatasetsByTenant(tenantId: string): Dataset[] {
  return Array.from(datasets.values()).filter(d => d.tenantId === tenantId);
}

/**
 * Create a new dataset version
 */
export function createDatasetVersion(
  datasetId: string,
  tenantId: string,
  filePath: string,
  fileSize: number,
  rowCount?: number,
  columnCount?: number
): DatasetVersion {
  // Get existing versions to determine version number
  const existingVersionIds = versionsByDatasetId.get(datasetId) || [];
  const version = existingVersionIds.length + 1;

  const datasetVersion: DatasetVersion = {
    id: uuidv4(),
    datasetId,
    tenantId,
    version,
    filePath,
    fileSize,
    rowCount,
    columnCount,
    uploadedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  datasetVersions.set(datasetVersion.id, datasetVersion);
  
  // Update indexes
  const versionIds = versionsByDatasetId.get(datasetId) || [];
  versionIds.push(datasetVersion.id);
  versionsByDatasetId.set(datasetId, versionIds);
  latestVersionByDatasetId.set(datasetId, datasetVersion.id);

  // Update dataset updatedAt
  const dataset = datasets.get(datasetId);
  if (dataset) {
    dataset.updatedAt = new Date().toISOString();
    datasets.set(datasetId, dataset);
  }

  return datasetVersion;
}

/**
 * Get dataset version by ID
 */
export function getDatasetVersion(versionId: string): DatasetVersion | null {
  return datasetVersions.get(versionId) || null;
}

/**
 * Get all versions for a dataset
 */
export function getVersionsByDataset(datasetId: string): DatasetVersion[] {
  const versionIds = versionsByDatasetId.get(datasetId) || [];
  return versionIds
    .map(id => datasetVersions.get(id))
    .filter((v): v is DatasetVersion => v !== undefined)
    .sort((a, b) => b.version - a.version);
}

/**
 * Get latest version for a dataset
 */
export function getLatestVersion(datasetId: string): DatasetVersion | null {
  const latestVersionId = latestVersionByDatasetId.get(datasetId);
  if (!latestVersionId) return null;
  return datasetVersions.get(latestVersionId) || null;
}

/**
 * Save dataset profile
 */
export function saveProfile(profile: DatasetProfile): void {
  datasetProfiles.set(profile.datasetVersionId, profile);
}

/**
 * Get dataset profile by version ID
 */
export function getProfile(versionId: string): DatasetProfile | null {
  return datasetProfiles.get(versionId) || null;
}

/**
 * Get profile for latest version of a dataset
 */
export function getLatestProfile(datasetId: string): DatasetProfile | null {
  const latestVersion = getLatestVersion(datasetId);
  if (!latestVersion) return null;
  return datasetProfiles.get(latestVersion.id) || null;
}

/**
 * Debug: Get all datasets (for debugging only)
 */
export function getAllDatasets(): Dataset[] {
  return Array.from(datasets.values());
}

/**
 * Debug: Get store stats (for debugging only)
 */
export function getStoreStats() {
  return {
    totalDatasets: datasets.size,
    totalVersions: datasetVersions.size,
    totalProfiles: datasetProfiles.size,
    datasets: Array.from(datasets.values()).map(d => ({ id: d.id, name: d.name, tenantId: d.tenantId })),
  };
}

