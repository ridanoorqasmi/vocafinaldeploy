/**
 * Phase 7: Database-Backed Quality Check Store
 * Data Analyst Agent (Poppy) - Quality Check Storage with Prisma
 */

import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';
import type { DataQualityCheckResult } from './data-quality-checker';

/**
 * Save quality check result to database
 */
export async function saveQualityCheck(
  qualityCheck: DataQualityCheckResult
): Promise<void> {
  await prisma.poppyDataQualityCheck.upsert({
    where: { datasetVersionId: qualityCheck.datasetVersionId },
    create: {
      id: uuidv4(),
      datasetVersionId: qualityCheck.datasetVersionId,
      rowCount: qualityCheck.rowCount,
      checksRunAt: new Date(qualityCheck.checksRunAt),
      timeCoverage: qualityCheck.timeCoverage ? (qualityCheck.timeCoverage as any) : null,
      nullIssues: qualityCheck.nullIssues as any,
      outlierSummary: qualityCheck.outlierSummary ? (qualityCheck.outlierSummary as any) : null,
      warnings: qualityCheck.warnings as any,
    },
    update: {
      rowCount: qualityCheck.rowCount,
      checksRunAt: new Date(qualityCheck.checksRunAt),
      timeCoverage: qualityCheck.timeCoverage ? (qualityCheck.timeCoverage as any) : null,
      nullIssues: qualityCheck.nullIssues as any,
      outlierSummary: qualityCheck.outlierSummary ? (qualityCheck.outlierSummary as any) : null,
      warnings: qualityCheck.warnings as any,
    },
  });
}

/**
 * Get quality check by dataset version ID
 */
export async function getQualityCheck(
  datasetVersionId: string
): Promise<DataQualityCheckResult | null> {
  const check = await prisma.poppyDataQualityCheck.findUnique({
    where: { datasetVersionId },
  });

  if (!check) {
    return null;
  }

  return {
    datasetVersionId: check.datasetVersionId,
    checksRunAt: check.checksRunAt.toISOString(),
    rowCount: check.rowCount,
    timeCoverage: check.timeCoverage ? (check.timeCoverage as any) : undefined,
    nullIssues: check.nullIssues as any,
    outlierSummary: check.outlierSummary ? (check.outlierSummary as any) : undefined,
    warnings: check.warnings as any,
  };
}

/**
 * Get quality check by dataset ID (latest version)
 */
export async function getQualityCheckByDataset(
  datasetId: string
): Promise<DataQualityCheckResult | null> {
  // Get latest version for dataset
  const latestVersion = await prisma.poppyDatasetVersion.findFirst({
    where: { datasetId },
    orderBy: { version: 'desc' },
  });

  if (!latestVersion) {
    return null;
  }

  return getQualityCheck(latestVersion.id);
}


