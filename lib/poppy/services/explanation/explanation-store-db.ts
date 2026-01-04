/**
 * Phase 6: Database-Backed Explanation Store
 * Data Analyst Agent (Poppy) - Explanation Storage with Prisma
 */

import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';
import type { Explanation } from '@/lib/poppy/api/contracts';

export interface StoredExplanation {
  id: string;
  sessionId: string;
  artifactId: string;
  explanation: Explanation;
  createdAt: string;
}

/**
 * Store explanation for an artifact
 */
export async function storeExplanation(
  sessionId: string,
  artifactId: string,
  explanation: Explanation
): Promise<StoredExplanation> {
  const stored = await prisma.poppyExplanation.upsert({
    where: { artifactId },
    create: {
      id: uuidv4(),
      sessionId,
      artifactId,
      summary: explanation.summary,
      implications: explanation.implications ? explanation.implications as any : null,
      caveats: explanation.caveats ? explanation.caveats as any : null,
    },
    update: {
      summary: explanation.summary,
      implications: explanation.implications ? explanation.implications as any : null,
      caveats: explanation.caveats ? explanation.caveats as any : null,
    },
  });

  return {
    id: stored.id,
    sessionId: stored.sessionId,
    artifactId: stored.artifactId,
    explanation: {
      summary: stored.summary,
      implications: stored.implications ? (stored.implications as any) : undefined,
      caveats: stored.caveats ? (stored.caveats as any) : undefined,
    },
    createdAt: stored.createdAt.toISOString(),
  };
}

/**
 * Get explanation by artifact ID
 */
export async function getExplanationByArtifact(
  artifactId: string
): Promise<StoredExplanation | null> {
  const explanation = await prisma.poppyExplanation.findUnique({
    where: { artifactId },
  });

  if (!explanation) return null;

  return {
    id: explanation.id,
    sessionId: explanation.sessionId,
    artifactId: explanation.artifactId,
    explanation: {
      summary: explanation.summary,
      implications: explanation.implications ? (explanation.implications as any) : undefined,
      caveats: explanation.caveats ? (explanation.caveats as any) : undefined,
    },
    createdAt: explanation.createdAt.toISOString(),
  };
}

/**
 * Get all explanations for a session
 */
export async function getExplanationsBySession(
  sessionId: string
): Promise<StoredExplanation[]> {
  const explanations = await prisma.poppyExplanation.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'desc' },
  });

  return explanations.map(e => ({
    id: e.id,
    sessionId: e.sessionId,
    artifactId: e.artifactId,
    explanation: {
      summary: e.summary,
      implications: e.implications ? (e.implications as any) : undefined,
      caveats: e.caveats ? (e.caveats as any) : undefined,
    },
    createdAt: e.createdAt.toISOString(),
  }));
}




