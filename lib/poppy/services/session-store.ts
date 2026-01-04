/**
 * Phase 2: In-Memory Session Store
 * Data Analyst Agent (Poppy) - Session & Message Storage
 * 
 * In-memory storage for analysis sessions and chat messages
 * Phase 2: No database, in-memory only
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  AnalysisSession,
  ChatMessage,
} from '@/lib/poppy/types';

// In-memory stores
const sessions = new Map<string, AnalysisSession>();
const messages = new Map<string, ChatMessage>();

// Indexes
const messagesBySessionId = new Map<string, string[]>(); // sessionId -> messageIds[]

/**
 * Create a new analysis session
 */
export function createSession(
  tenantId: string,
  datasetId: string | undefined,
  title?: string
): AnalysisSession {
  const session: AnalysisSession = {
    id: uuidv4(),
    tenantId,
    datasetId,
    title: title || `Analysis Session ${new Date().toLocaleDateString()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  sessions.set(session.id, session);
  messagesBySessionId.set(session.id, []);

  return session;
}

/**
 * Get session by ID
 */
export function getSession(sessionId: string): AnalysisSession | null {
  return sessions.get(sessionId) || null;
}

/**
 * Get all sessions for a tenant
 */
export function getSessionsByTenant(tenantId: string): AnalysisSession[] {
  return Array.from(sessions.values()).filter(s => s.tenantId === tenantId);
}

/**
 * Get sessions for a dataset
 */
export function getSessionsByDataset(datasetId: string): AnalysisSession[] {
  return Array.from(sessions.values()).filter(s => s.datasetId === datasetId);
}

/**
 * Create a new chat message
 */
export function createMessage(
  sessionId: string,
  tenantId: string,
  role: 'user' | 'assistant',
  content: string
): ChatMessage {
  const message: ChatMessage = {
    id: uuidv4(),
    sessionId,
    tenantId,
    role,
    content,
    createdAt: new Date().toISOString(),
  };

  messages.set(message.id, message);
  
  // Update indexes
  const messageIds = messagesBySessionId.get(sessionId) || [];
  messageIds.push(message.id);
  messagesBySessionId.set(sessionId, messageIds);

  // Update session updatedAt
  const session = sessions.get(sessionId);
  if (session) {
    session.updatedAt = new Date().toISOString();
    sessions.set(sessionId, session);
  }

  return message;
}

/**
 * Get message by ID
 */
export function getMessage(messageId: string): ChatMessage | null {
  return messages.get(messageId) || null;
}

/**
 * Get all messages for a session (ordered by createdAt)
 */
export function getMessagesBySession(sessionId: string): ChatMessage[] {
  const messageIds = messagesBySessionId.get(sessionId) || [];
  return messageIds
    .map(id => messages.get(id))
    .filter((m): m is ChatMessage => m !== undefined)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

/**
 * Debug: Get all sessions (for debugging only)
 */
export function getAllSessions(): AnalysisSession[] {
  return Array.from(sessions.values());
}

/**
 * Debug: Get store stats (for debugging only)
 */
export function getStoreStats() {
  return {
    totalSessions: sessions.size,
    totalMessages: messages.size,
    sessions: Array.from(sessions.values()).map(s => ({ id: s.id, datasetId: s.datasetId, tenantId: s.tenantId })),
  };
}








