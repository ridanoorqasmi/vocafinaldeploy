/**
 * Phase 4: Explanation Store
 * Data Analyst Agent (Poppy) - Explanation Persistence
 * 
 * Stores LLM-generated explanations linked to artifacts and sessions
 */

import { v4 as uuidv4 } from 'uuid';
import type { Explanation } from '@/lib/poppy/api/contracts';

export interface StoredExplanation {
  id: string;
  sessionId: string;
  artifactId: string;
  explanation: Explanation;
  createdAt: string;
}

// In-memory store
const explanations = new Map<string, StoredExplanation>();

// Indexes
const explanationsBySessionId = new Map<string, string[]>(); // sessionId -> explanationIds[]
const explanationsByArtifactId = new Map<string, string>(); // artifactId -> explanationId (one-to-one)

/**
 * Store an explanation for an artifact
 */
export function storeExplanation(
  sessionId: string,
  artifactId: string,
  explanation: Explanation
): StoredExplanation {
  // Check if explanation already exists for this artifact
  const existingId = explanationsByArtifactId.get(artifactId);
  if (existingId) {
    const existing = explanations.get(existingId);
    if (existing) {
      // Update existing explanation
      existing.explanation = explanation;
      return existing;
    }
  }

  // Create new explanation
  const stored: StoredExplanation = {
    id: uuidv4(),
    sessionId,
    artifactId,
    explanation,
    createdAt: new Date().toISOString(),
  };

  explanations.set(stored.id, stored);

  // Update indexes
  const sessionExplanationIds = explanationsBySessionId.get(sessionId) || [];
  sessionExplanationIds.push(stored.id);
  explanationsBySessionId.set(sessionId, sessionExplanationIds);

  explanationsByArtifactId.set(artifactId, stored.id);

  return stored;
}

/**
 * Get explanation by artifact ID
 */
export function getExplanationByArtifact(artifactId: string): StoredExplanation | null {
  const explanationId = explanationsByArtifactId.get(artifactId);
  if (!explanationId) {
    return null;
  }
  return explanations.get(explanationId) || null;
}

/**
 * Get all explanations for a session
 */
export function getExplanationsBySession(sessionId: string): StoredExplanation[] {
  const explanationIds = explanationsBySessionId.get(sessionId) || [];
  return explanationIds
    .map(id => explanations.get(id))
    .filter((e): e is StoredExplanation => e !== undefined)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

/**
 * Get explanation by ID
 */
export function getExplanation(explanationId: string): StoredExplanation | null {
  return explanations.get(explanationId) || null;
}







