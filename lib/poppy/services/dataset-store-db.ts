/**
 * Phase 6: Database-Backed Dataset Store
 * Data Analyst Agent (Poppy) - Dataset Storage with Prisma
 * 
 * This is the database-backed version of dataset-store.ts
 * Replace in-memory store with this after migration
 */

import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';
import type { Dataset, DatasetVersion } from '@/lib/poppy/types';
import type { DatasetProfile } from './data-profiler';

/**
 * Create a new dataset
 */
export async function createDataset(
  tenantId: string,
  name: string,
  description?: string
): Promise<Dataset> {
  const dataset = await prisma.poppyDataset.create({
    data: {
      id: uuidv4(),
      tenantId,
      name,
      description: description || null,
    },
  });

  return {
    id: dataset.id,
    tenantId: dataset.tenantId,
    name: dataset.name,
    description: dataset.description || undefined,
    createdAt: dataset.createdAt.toISOString(),
    updatedAt: dataset.updatedAt.toISOString(),
  };
}

/**
 * Get dataset by ID
 */
export async function getDataset(datasetId: string): Promise<Dataset | null> {
  const dataset = await prisma.poppyDataset.findUnique({
    where: { id: datasetId },
  });

  if (!dataset) return null;

  return {
    id: dataset.id,
    tenantId: dataset.tenantId,
    name: dataset.name,
    description: dataset.description || undefined,
    createdAt: dataset.createdAt.toISOString(),
    updatedAt: dataset.updatedAt.toISOString(),
  };
}

/**
 * Get all datasets for a tenant
 */
export async function getDatasetsByTenant(tenantId: string): Promise<Dataset[]> {
  const datasets = await prisma.poppyDataset.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });

  return datasets.map(d => ({
    id: d.id,
    tenantId: d.tenantId,
    name: d.name,
    description: d.description || undefined,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  }));
}

/**
 * Create a new dataset version
 */
export async function createDatasetVersion(
  datasetId: string,
  tenantId: string,
  filePath: string,
  fileSize: number,
  rowCount?: number,
  columnCount?: number
): Promise<DatasetVersion> {
  // Get latest version number
  const latestVersion = await prisma.poppyDatasetVersion.findFirst({
    where: { datasetId },
    orderBy: { version: 'desc' },
  });

  const version = (latestVersion?.version || 0) + 1;

  const datasetVersion = await prisma.poppyDatasetVersion.create({
    data: {
      id: uuidv4(),
      datasetId,
      tenantId,
      version,
      filePath,
      fileSize,
      rowCount: rowCount || null,
      columnCount: columnCount || null,
    },
  });

  // Update dataset updatedAt
  await prisma.poppyDataset.update({
    where: { id: datasetId },
    data: { updatedAt: new Date() },
  });

  return {
    id: datasetVersion.id,
    datasetId: datasetVersion.datasetId,
    tenantId: datasetVersion.tenantId,
    version: datasetVersion.version,
    filePath: datasetVersion.filePath,
    fileSize: datasetVersion.fileSize,
    rowCount: datasetVersion.rowCount || undefined,
    columnCount: datasetVersion.columnCount || undefined,
    uploadedAt: datasetVersion.uploadedAt.toISOString(),
    createdAt: datasetVersion.createdAt.toISOString(),
  };
}

/**
 * Get dataset version by ID
 */
export async function getDatasetVersion(versionId: string): Promise<DatasetVersion | null> {
  const version = await prisma.poppyDatasetVersion.findUnique({
    where: { id: versionId },
  });

  if (!version) return null;

  return {
    id: version.id,
    datasetId: version.datasetId,
    tenantId: version.tenantId,
    version: version.version,
    filePath: version.filePath,
    fileSize: version.fileSize,
    rowCount: version.rowCount || undefined,
    columnCount: version.columnCount || undefined,
    uploadedAt: version.uploadedAt.toISOString(),
    createdAt: version.createdAt.toISOString(),
  };
}

/**
 * Get all versions for a dataset
 */
export async function getVersionsByDataset(datasetId: string): Promise<DatasetVersion[]> {
  const versions = await prisma.poppyDatasetVersion.findMany({
    where: { datasetId },
    orderBy: { version: 'desc' },
  });

  return versions.map(v => ({
    id: v.id,
    datasetId: v.datasetId,
    tenantId: v.tenantId,
    version: v.version,
    filePath: v.filePath,
    fileSize: v.fileSize,
    rowCount: v.rowCount || undefined,
    columnCount: v.columnCount || undefined,
    uploadedAt: v.uploadedAt.toISOString(),
    createdAt: v.createdAt.toISOString(),
  }));
}

/**
 * Get latest version for a dataset
 */
export async function getLatestVersion(datasetId: string): Promise<DatasetVersion | null> {
  const version = await prisma.poppyDatasetVersion.findFirst({
    where: { datasetId },
    orderBy: { version: 'desc' },
  });

  if (!version) return null;

  return {
    id: version.id,
    datasetId: version.datasetId,
    tenantId: version.tenantId,
    version: version.version,
    filePath: version.filePath,
    fileSize: version.fileSize,
    rowCount: version.rowCount || undefined,
    columnCount: version.columnCount || undefined,
    uploadedAt: version.uploadedAt.toISOString(),
    createdAt: version.createdAt.toISOString(),
  };
}

/**
 * Save dataset profile
 */
export async function saveProfile(profile: DatasetProfile): Promise<void> {
  await prisma.poppyDatasetProfile.upsert({
    where: { datasetVersionId: profile.datasetVersionId },
    create: {
      id: uuidv4(),
      datasetVersionId: profile.datasetVersionId,
      rowCount: profile.rowCount,
      columnCount: profile.columnCount,
      columns: profile.columns as any,
    },
    update: {
      rowCount: profile.rowCount,
      columnCount: profile.columnCount,
      columns: profile.columns as any,
    },
  });
}

/**
 * Get dataset profile by version ID
 */
export async function getProfile(versionId: string): Promise<DatasetProfile | null> {
  const profile = await prisma.poppyDatasetProfile.findUnique({
    where: { datasetVersionId: versionId },
  });

  if (!profile) return null;

  return {
    datasetVersionId: profile.datasetVersionId,
    rowCount: profile.rowCount,
    columnCount: profile.columnCount,
    columns: profile.columns as any,
  };
}

/**
 * Get profile for latest version of a dataset
 */
export async function getLatestProfile(datasetId: string): Promise<DatasetProfile | null> {
  const latestVersion = await getLatestVersion(datasetId);
  if (!latestVersion) return null;

  return getProfile(latestVersion.id);
}




