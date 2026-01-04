/**
 * Phase 3: Artifact Store
 * Data Analyst Agent (Poppy) - Artifact Storage
 * 
 * Stores generated artifacts (analysis results) linked to sessions
 */

import { v4 as uuidv4 } from 'uuid';
import type { GeneratedArtifact } from '@/lib/poppy/types';
import type { AnalysisResult } from './analytics/execution-engine';

// In-memory store
const artifacts = new Map<string, GeneratedArtifact>();

// Indexes
const artifactsBySessionId = new Map<string, string[]>(); // sessionId -> artifactIds[]

/**
 * Create an artifact from analysis result
 */
export function createArtifact(
  sessionId: string,
  tenantId: string,
  analysisResult: AnalysisResult,
  title?: string
): GeneratedArtifact {
  // Map AnalysisResult type to artifact type
  let artifactType: 'chart' | 'table' | 'insight' | 'report';
  switch (analysisResult.type) {
    case 'scalar':
      artifactType = 'insight'; // Scalar values as insights
      break;
    case 'table':
      artifactType = 'table';
      break;
    case 'series':
      artifactType = 'chart'; // Series as charts (even though we won't render them yet)
      break;
    default:
      artifactType = 'table';
  }

  const artifact: GeneratedArtifact = {
    id: uuidv4(),
    sessionId,
    tenantId,
    type: artifactType,
    title: title || generateArtifactTitle(analysisResult),
    data: {
      resultType: analysisResult.type,
      resultData: analysisResult.data,
      metadata: analysisResult.metadata,
    },
    metadata: {
      intent: analysisResult.metadata.intent,
      metric: analysisResult.metadata.metric,
      dimension: analysisResult.metadata.dimension,
      timeColumn: analysisResult.metadata.timeColumn,
    },
    createdAt: new Date().toISOString(),
  };

  artifacts.set(artifact.id, artifact);

  // Update indexes
  const artifactIds = artifactsBySessionId.get(sessionId) || [];
  artifactIds.push(artifact.id);
  artifactsBySessionId.set(sessionId, artifactIds);

  return artifact;
}

/**
 * Generate artifact title from analysis result
 */
function generateArtifactTitle(result: AnalysisResult): string {
  const { intent, metric, dimension, timeColumn } = result.metadata;

  switch (intent) {
    case 'aggregate_sum':
      return `Total ${metric}`;
    case 'aggregate_avg':
      return `Average ${metric}`;
    case 'aggregate_count':
      return 'Total Count';
    case 'group_by':
      return `${metric} by ${dimension || 'dimension'}`;
    case 'time_series':
      return `${metric} over time`;
    default:
      return 'Analysis Result';
  }
}

/**
 * Get artifact by ID
 */
export function getArtifact(artifactId: string): GeneratedArtifact | null {
  return artifacts.get(artifactId) || null;
}

/**
 * Get all artifacts for a session (ordered by createdAt)
 */
export function getArtifactsBySession(sessionId: string): GeneratedArtifact[] {
  const artifactIds = artifactsBySessionId.get(sessionId) || [];
  return artifactIds
    .map(id => artifacts.get(id))
    .filter((a): a is GeneratedArtifact => a !== undefined)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

/**
 * Delete artifact
 */
export function deleteArtifact(artifactId: string): boolean {
  const artifact = artifacts.get(artifactId);
  if (!artifact) {
    return false;
  }

  artifacts.delete(artifactId);

  // Update indexes
  const artifactIds = artifactsBySessionId.get(artifact.sessionId) || [];
  const index = artifactIds.indexOf(artifactId);
  if (index > -1) {
    artifactIds.splice(index, 1);
    artifactsBySessionId.set(artifact.sessionId, artifactIds);
  }

  return true;
}

/**
 * Debug: Get all artifacts (for debugging only)
 */
export function getAllArtifacts(): GeneratedArtifact[] {
  return Array.from(artifacts.values());
}








