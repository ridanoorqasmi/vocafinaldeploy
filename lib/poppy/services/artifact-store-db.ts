/**
 * Phase 6: Database-Backed Artifact Store
 * Data Analyst Agent (Poppy) - Artifact Storage with Prisma
 */

import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';
import type { GeneratedArtifact } from '@/lib/poppy/types';
import type { AnalysisResult } from './analytics/execution-engine';

/**
 * Create an artifact from analysis result
 */
export async function createArtifact(
  sessionId: string,
  tenantId: string,
  analysisResult: AnalysisResult,
  title?: string
): Promise<GeneratedArtifact> {
  // Map AnalysisResult type to artifact type
  let artifactType: 'chart' | 'table' | 'insight' | 'report';
  switch (analysisResult.type) {
    case 'scalar':
      artifactType = 'insight';
      break;
    case 'table':
      artifactType = 'table';
      break;
    case 'series':
      artifactType = 'chart';
      break;
    default:
      artifactType = 'table';
  }

  const artifact = await prisma.poppyArtifact.create({
    data: {
      id: uuidv4(),
      sessionId,
      tenantId,
      type: artifactType,
      title: title || generateArtifactTitle(analysisResult),
      data: {
        resultType: analysisResult.type,
        resultData: analysisResult.data,
        metadata: analysisResult.metadata,
      } as any,
      metadata: {
        intent: analysisResult.metadata.intent,
        metric: analysisResult.metadata.metric,
        dimension: analysisResult.metadata.dimension,
        timeColumn: analysisResult.metadata.timeColumn,
      } as any,
    },
  });

  return {
    id: artifact.id,
    sessionId: artifact.sessionId,
    tenantId: artifact.tenantId,
    type: artifactType,
    title: artifact.title,
    data: artifact.data as any,
    metadata: artifact.metadata as any,
    createdAt: artifact.createdAt.toISOString(),
  };
}

/**
 * Generate artifact title from analysis result
 */
function generateArtifactTitle(result: AnalysisResult): string {
  const { intent, metric, dimension, timeColumn } = result.metadata;
  
  if (intent === 'aggregate_sum' && metric) {
    return `Total ${metric}`;
  } else if (intent === 'aggregate_avg' && metric) {
    return `Average ${metric}`;
  } else if (intent === 'aggregate_count') {
    return 'Row Count';
  } else if (intent === 'group_by' && dimension && metric) {
    return `${metric} by ${dimension}`;
  } else if (intent === 'time_series' && timeColumn && metric) {
    return `${metric} over ${timeColumn}`;
  }
  
  return 'Analysis Result';
}

/**
 * Get artifact by ID
 */
export async function getArtifact(artifactId: string): Promise<GeneratedArtifact | null> {
  const artifact = await prisma.poppyArtifact.findUnique({
    where: { id: artifactId },
  });

  if (!artifact) return null;

  return {
    id: artifact.id,
    sessionId: artifact.sessionId,
    tenantId: artifact.tenantId,
    type: artifact.type as any,
    title: artifact.title,
    data: artifact.data as any,
    metadata: artifact.metadata as any,
    createdAt: artifact.createdAt.toISOString(),
  };
}

/**
 * Get all artifacts for a session
 */
export async function getArtifactsBySession(sessionId: string): Promise<GeneratedArtifact[]> {
  const artifacts = await prisma.poppyArtifact.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'desc' },
  });

  return artifacts.map(a => ({
    id: a.id,
    sessionId: a.sessionId,
    tenantId: a.tenantId,
    type: a.type as any,
    title: a.title,
    data: a.data as any,
    metadata: a.metadata as any,
    createdAt: a.createdAt.toISOString(),
  }));
}

/**
 * Update artifact (for adding chart spec, etc.)
 */
export async function updateArtifact(
  artifactId: string,
  updates: Partial<Pick<GeneratedArtifact, 'metadata' | 'title'>>
): Promise<GeneratedArtifact | null> {
  const artifact = await prisma.poppyArtifact.update({
    where: { id: artifactId },
    data: {
      ...(updates.title && { title: updates.title }),
      ...(updates.metadata && { metadata: updates.metadata as any }),
    },
  });

  return {
    id: artifact.id,
    sessionId: artifact.sessionId,
    tenantId: artifact.tenantId,
    type: artifact.type as any,
    title: artifact.title,
    data: artifact.data as any,
    metadata: artifact.metadata as any,
    createdAt: artifact.createdAt.toISOString(),
  };
}




