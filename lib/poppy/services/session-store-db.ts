/**
 * Phase 6: Database-Backed Session Store
 * Data Analyst Agent (Poppy) - Session Storage with Prisma
 */

import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';
import type { AnalysisSession, ChatMessage } from '@/lib/poppy/types';

/**
 * Create a new analysis session
 */
export async function createSession(
  tenantId: string,
  datasetId: string | undefined,
  title?: string
): Promise<AnalysisSession> {
  const session = await prisma.poppyAnalysisSession.create({
    data: {
      id: uuidv4(),
      tenantId,
      datasetId: datasetId || null,
      title: title || `Analysis Session ${new Date().toLocaleDateString()}`,
    },
  });

  return {
    id: session.id,
    tenantId: session.tenantId,
    datasetId: session.datasetId || undefined,
    title: session.title || undefined,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

/**
 * Get session by ID
 */
export async function getSession(sessionId: string): Promise<AnalysisSession | null> {
  const session = await prisma.poppyAnalysisSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) return null;

  return {
    id: session.id,
    tenantId: session.tenantId,
    datasetId: session.datasetId || undefined,
    title: session.title || undefined,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

/**
 * Get all sessions for a tenant
 */
export async function getSessionsByTenant(tenantId: string): Promise<AnalysisSession[]> {
  const sessions = await prisma.poppyAnalysisSession.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });

  return sessions.map(s => ({
    id: s.id,
    tenantId: s.tenantId,
    datasetId: s.datasetId || undefined,
    title: s.title || undefined,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }));
}

/**
 * Get sessions for a dataset
 */
export async function getSessionsByDataset(datasetId: string): Promise<AnalysisSession[]> {
  const sessions = await prisma.poppyAnalysisSession.findMany({
    where: { datasetId },
    orderBy: { createdAt: 'desc' },
  });

  return sessions.map(s => ({
    id: s.id,
    tenantId: s.tenantId,
    datasetId: s.datasetId || undefined,
    title: s.title || undefined,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }));
}

/**
 * Create a new chat message
 */
export async function createMessage(
  sessionId: string,
  tenantId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<ChatMessage> {
  const message = await prisma.poppyChatMessage.create({
    data: {
      id: uuidv4(),
      sessionId,
      tenantId,
      role,
      content,
    },
  });

  // Update session updatedAt
  await prisma.poppyAnalysisSession.update({
    where: { id: sessionId },
    data: { updatedAt: new Date() },
  });

  return {
    id: message.id,
    sessionId: message.sessionId,
    tenantId: message.tenantId,
    role: message.role as 'user' | 'assistant',
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  };
}

/**
 * Get message by ID
 */
export async function getMessage(messageId: string): Promise<ChatMessage | null> {
  const message = await prisma.poppyChatMessage.findUnique({
    where: { id: messageId },
  });

  if (!message) return null;

  return {
    id: message.id,
    sessionId: message.sessionId,
    tenantId: message.tenantId,
    role: message.role as 'user' | 'assistant',
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  };
}

/**
 * Get all messages for a session (ordered by createdAt)
 */
export async function getMessagesBySession(sessionId: string): Promise<ChatMessage[]> {
  const messages = await prisma.poppyChatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' },
  });

  return messages.map(m => ({
    id: m.id,
    sessionId: m.sessionId,
    tenantId: m.tenantId,
    role: m.role as 'user' | 'assistant',
    content: m.content,
    createdAt: m.createdAt.toISOString(),
  }));
}




