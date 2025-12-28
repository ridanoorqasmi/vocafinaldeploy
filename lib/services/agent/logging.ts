/**
 * Phase 4: Structured Logging for Agent Operations
 * Logs agent routing decisions, KB hits, DB hits, escalations, errors
 */

export interface AgentLogEntry {
  tenantId: string;
  conversationId?: string;
  intent?: string;
  responseSource: 'kb' | 'db' | 'escalation' | 'greeting' | 'fallback';
  timestamp: string;
  duration?: number;
  error?: string;
  metadata?: Record<string, any>;
}

// In-memory log buffer (in production, send to logging service)
const logBuffer: AgentLogEntry[] = [];
const MAX_BUFFER_SIZE = 1000;

/**
 * Logs an agent operation
 */
export function logAgentOperation(entry: Omit<AgentLogEntry, 'timestamp'>): void {
  const logEntry: AgentLogEntry = {
    ...entry,
    timestamp: new Date().toISOString()
  };

  // Add to buffer
  logBuffer.push(logEntry);

  // Keep buffer size manageable
  if (logBuffer.length > MAX_BUFFER_SIZE) {
    logBuffer.shift(); // Remove oldest entry
  }

  // Console log for development (structured format)
  const logMessage = {
    type: 'AGENT_OPERATION',
    tenantId: logEntry.tenantId,
    conversationId: logEntry.conversationId,
    intent: logEntry.intent,
    responseSource: logEntry.responseSource,
    duration: logEntry.duration,
    error: logEntry.error,
    metadata: logEntry.metadata
  };

  if (logEntry.error) {
    console.error('[AGENT_LOG]', JSON.stringify(logMessage));
  } else {
    console.log('[AGENT_LOG]', JSON.stringify(logMessage));
  }
}

/**
 * Logs KB query operation
 */
export function logKbQuery(
  tenantId: string,
  conversationId: string | undefined,
  question: string,
  resultCount: number,
  topScore: number | null,
  duration: number
): void {
  logAgentOperation({
    tenantId,
    conversationId,
    intent: 'kb_question',
    responseSource: 'kb',
    duration,
    metadata: {
      questionLength: question.length,
      resultCount,
      topScore,
      hasResults: resultCount > 0
    }
  });
}

/**
 * Logs DB lookup operation
 */
export function logDbLookup(
  tenantId: string,
  conversationId: string | undefined,
  identifier: string,
  found: boolean,
  duration: number
): void {
  logAgentOperation({
    tenantId,
    conversationId,
    intent: 'db_lookup',
    responseSource: 'db',
    duration,
    metadata: {
      identifierLength: identifier.length,
      found
    }
  });
}

/**
 * Logs escalation/ticket creation
 */
export function logEscalation(
  tenantId: string,
  conversationId: string,
  intent: string,
  ticketId: string | undefined,
  duration: number
): void {
  logAgentOperation({
    tenantId,
    conversationId,
    intent,
    responseSource: 'escalation',
    duration,
    metadata: {
      ticketId
    }
  });
}

/**
 * Logs error
 */
export function logAgentError(
  tenantId: string,
  conversationId: string | undefined,
  error: Error | string,
  context: Record<string, any> = {}
): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  logAgentOperation({
    tenantId,
    conversationId,
    responseSource: 'fallback',
    error: errorMessage,
    metadata: {
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      ...context
    }
  });
}

/**
 * Gets recent logs for a tenant (for debugging/monitoring)
 */
export function getRecentLogs(tenantId: string, limit: number = 50): AgentLogEntry[] {
  return logBuffer
    .filter(entry => entry.tenantId === tenantId)
    .slice(-limit)
    .reverse();
}

/**
 * Clears log buffer (for testing)
 */
export function clearLogBuffer(): void {
  logBuffer.length = 0;
}





