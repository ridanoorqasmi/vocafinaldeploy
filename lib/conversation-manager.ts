// ===== CONVERSATION MANAGER SERVICE =====

import { PrismaClient, Conversation as PrismaConversation, QueryLog as PrismaQueryLog } from '@prisma/client';
import { 
  ConversationSession, 
  ConversationMessage, 
  QueryLogEntry,
  DEFAULT_QUERY_CONFIG 
} from './query-types';

export interface ConversationManagerConfig {
  sessionTimeoutMinutes: number;
  conversationHistoryLimit: number;
  contextWindowTokens: number;
  cleanupIntervalHours: number;
  enableContextSummary: boolean;
  maxContextSummaryLength: number;
}

export interface ConversationContext {
  session: ConversationSession;
  messages: ConversationMessage[];
  contextSummary: string;
  userPreferences: string[];
  businessContext: Record<string, any>;
}

export interface SessionCreateRequest {
  businessId: string;
  customerId?: string;
  customerIdentifier?: string;
  metadata?: Record<string, any>;
}

export class ConversationManager {
  private prisma: PrismaClient;
  private config: ConversationManagerConfig;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(prisma: PrismaClient, config?: Partial<ConversationManagerConfig>) {
    this.prisma = prisma;
    this.config = {
      sessionTimeoutMinutes: DEFAULT_QUERY_CONFIG.sessionTimeoutMinutes,
      conversationHistoryLimit: DEFAULT_QUERY_CONFIG.conversationHistoryLimit,
      contextWindowTokens: DEFAULT_QUERY_CONFIG.contextWindowTokens,
      cleanupIntervalHours: parseInt(process.env.SESSION_CLEANUP_INTERVAL_HOURS || '24'),
      enableContextSummary: true,
      maxContextSummaryLength: 500,
      ...config
    };

    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Create a new conversation session
   */
  async createSession(request: SessionCreateRequest): Promise<ConversationSession> {
    const sessionId = this.generateSessionId();
    const expiresAt = new Date(Date.now() + this.config.sessionTimeoutMinutes * 60 * 1000);

    const conversation = await this.prisma.conversation.create({
      data: {
        businessId: request.businessId,
        sessionId,
        customerId: request.customerId,
        customerIdentifier: request.customerIdentifier,
        expiresAt,
        metadata: request.metadata || {},
        isActive: true
      }
    });

    return this.mapPrismaToSession(conversation);
  }

  /**
   * Get or create session for a query
   */
  async getOrCreateSession(
    businessId: string, 
    sessionId?: string, 
    customerId?: string
  ): Promise<ConversationSession> {
    if (sessionId) {
      const existingSession = await this.getSession(businessId, sessionId);
      if (existingSession && this.isSessionValid(existingSession)) {
        // Update last activity
        await this.updateSessionActivity(sessionId);
        return existingSession;
      }
    }

    // Create new session
    return await this.createSession({
      businessId,
      customerId,
      customerIdentifier: customerId || this.generateCustomerIdentifier()
    });
  }

  /**
   * Get conversation session by ID
   */
  async getSession(businessId: string, sessionId: string): Promise<ConversationSession | null> {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        businessId,
        sessionId,
        isActive: true
      }
    });

    if (!conversation) {
      return null;
    }

    return this.mapPrismaToSession(conversation);
  }

  /**
   * Get conversation context including history
   */
  async getConversationContext(businessId: string, sessionId: string): Promise<ConversationContext | null> {
    const session = await this.getSession(businessId, sessionId);
    if (!session) {
      return null;
    }

    // Get recent messages
    const messages = await this.getConversationHistory(businessId, sessionId);
    
    // Generate context summary
    const contextSummary = this.config.enableContextSummary 
      ? await this.generateContextSummary(messages)
      : '';

    // Extract user preferences from conversation
    const userPreferences = this.extractUserPreferences(messages);

    return {
      session,
      messages,
      contextSummary,
      userPreferences,
      businessContext: session.metadata || {}
    };
  }

  /**
   * Add message to conversation
   */
  async addMessage(
    businessId: string,
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
    intent?: string,
    metadata?: Record<string, any>
  ): Promise<ConversationMessage> {
    // Update session activity
    await this.updateSessionActivity(sessionId);

    // Create query log entry
    const queryLog = await this.prisma.queryLog.create({
      data: {
        businessId,
        sessionId,
        queryText: content,
        intentDetected: intent as any,
        metadata: {
          role,
          ...metadata
        }
      }
    });

    return {
      id: queryLog.id,
      role,
      content,
      timestamp: queryLog.createdAt,
      intent: intent as any
    };
  }

  /**
   * Update session activity timestamp
   */
  async updateSessionActivity(sessionId: string): Promise<void> {
    const expiresAt = new Date(Date.now() + this.config.sessionTimeoutMinutes * 60 * 1000);
    
    await this.prisma.conversation.updateMany({
      where: { sessionId },
      data: {
        lastActivityAt: new Date(),
        expiresAt
      }
    });
  }

  /**
   * Update context summary for session
   */
  async updateContextSummary(sessionId: string, summary: string): Promise<void> {
    const truncatedSummary = summary.length > this.config.maxContextSummaryLength
      ? summary.substring(0, this.config.maxContextSummaryLength) + '...'
      : summary;

    await this.prisma.conversation.updateMany({
      where: { sessionId },
      data: { contextSummary: truncatedSummary }
    });
  }

  /**
   * End conversation session
   */
  async endSession(sessionId: string): Promise<void> {
    await this.prisma.conversation.updateMany({
      where: { sessionId },
      data: { 
        isActive: false,
        expiresAt: new Date() // Expire immediately
      }
    });
  }

  /**
   * Get conversation history
   */
  async getConversationHistory(
    businessId: string, 
    sessionId: string, 
    limit?: number
  ): Promise<ConversationMessage[]> {
    const queryLogs = await this.prisma.queryLog.findMany({
      where: {
        businessId,
        sessionId,
        status: 'SUCCESS'
      },
      orderBy: { createdAt: 'asc' },
      take: limit || this.config.conversationHistoryLimit
    });

    return queryLogs.map(log => ({
      id: log.id,
      role: (log.metadata as any)?.role || 'user',
      content: log.queryText,
      timestamp: log.createdAt,
      intent: log.intentDetected || undefined
    }));
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const now = new Date();
    
    const result = await this.prisma.conversation.updateMany({
      where: {
        expiresAt: { lt: now },
        isActive: true
      },
      data: { isActive: false }
    });

    return result.count;
  }

  /**
   * Get session statistics
   */
  async getSessionStats(businessId: string): Promise<{
    totalSessions: number;
    activeSessions: number;
    expiredSessions: number;
    averageSessionDuration: number;
    averageMessagesPerSession: number;
  }> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [total, active, expired, recentSessions] = await Promise.all([
      this.prisma.conversation.count({
        where: { businessId }
      }),
      this.prisma.conversation.count({
        where: { 
          businessId, 
          isActive: true,
          expiresAt: { gt: now }
        }
      }),
      this.prisma.conversation.count({
        where: { 
          businessId, 
          isActive: false,
          expiresAt: { lt: now }
        }
      }),
      this.prisma.conversation.findMany({
        where: {
          businessId,
          createdAt: { gte: oneDayAgo }
        },
        include: {
          queryLogs: true
        }
      })
    ]);

    // Calculate averages
    const averageSessionDuration = recentSessions.length > 0
      ? recentSessions.reduce((sum, session) => {
          const duration = session.lastActivityAt.getTime() - session.startedAt.getTime();
          return sum + duration;
        }, 0) / recentSessions.length / (1000 * 60) // Convert to minutes
      : 0;

    const averageMessagesPerSession = recentSessions.length > 0
      ? recentSessions.reduce((sum, session) => sum + session.queryLogs.length, 0) / recentSessions.length
      : 0;

    return {
      totalSessions: total,
      activeSessions: active,
      expiredSessions: expired,
      averageSessionDuration,
      averageMessagesPerSession
    };
  }

  /**
   * Check if session is valid (not expired)
   */
  private isSessionValid(session: ConversationSession): boolean {
    return session.isActive && new Date() < session.expiresAt;
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 15);
    return `sess_${timestamp}_${random}`;
  }

  /**
   * Generate customer identifier for anonymous sessions
   */
  private generateCustomerIdentifier(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `anon_${timestamp}_${random}`;
  }

  /**
   * Generate context summary from conversation history
   */
  private async generateContextSummary(messages: ConversationMessage[]): Promise<string> {
    if (messages.length === 0) {
      return '';
    }

    // Simple summary based on recent messages
    const recentMessages = messages.slice(-5); // Last 5 messages
    const userMessages = recentMessages.filter(m => m.role === 'user');
    
    if (userMessages.length === 0) {
      return '';
    }

    // Extract key topics and intents
    const topics = new Set<string>();
    const intents = new Set<string>();

    userMessages.forEach(message => {
      if (message.intent) {
        intents.add(message.intent);
      }
      
      // Simple keyword extraction
      const words = message.content.toLowerCase().split(/\s+/);
      words.forEach(word => {
        if (word.length > 3 && !['what', 'when', 'where', 'how', 'why', 'the', 'and', 'but', 'for', 'are', 'you', 'your'].includes(word)) {
          topics.add(word);
        }
      });
    });

    const topicList = Array.from(topics).slice(0, 5);
    const intentList = Array.from(intents);

    let summary = '';
    if (intentList.length > 0) {
      summary += `Customer interested in: ${intentList.join(', ')}. `;
    }
    if (topicList.length > 0) {
      summary += `Topics discussed: ${topicList.join(', ')}.`;
    }

    return summary.trim();
  }

  /**
   * Extract user preferences from conversation
   */
  private extractUserPreferences(messages: ConversationMessage[]): string[] {
    const preferences = new Set<string>();
    
    messages.forEach(message => {
      if (message.role === 'user') {
        const content = message.content.toLowerCase();
        
        // Extract dietary preferences
        if (content.includes('vegan') || content.includes('vegetarian')) {
          preferences.add('vegetarian');
        }
        if (content.includes('gluten') || content.includes('celiac')) {
          preferences.add('gluten-free');
        }
        if (content.includes('allergic') || content.includes('allergy')) {
          preferences.add('allergies');
        }
        if (content.includes('spicy') || content.includes('hot')) {
          preferences.add('spicy food');
        }
        if (content.includes('mild') || content.includes('not spicy')) {
          preferences.add('mild food');
        }
      }
    });

    return Array.from(preferences);
  }

  /**
   * Map Prisma conversation to session interface
   */
  private mapPrismaToSession(conversation: PrismaConversation): ConversationSession {
    return {
      id: conversation.id,
      businessId: conversation.businessId,
      sessionId: conversation.sessionId,
      customerId: conversation.customerId || undefined,
      customerIdentifier: conversation.customerIdentifier || undefined,
      startedAt: conversation.startedAt,
      lastActivityAt: conversation.lastActivityAt,
      expiresAt: conversation.expiresAt,
      contextSummary: conversation.contextSummary || undefined,
      metadata: conversation.metadata as Record<string, any> || {},
      isActive: conversation.isActive
    };
  }

  /**
   * Start cleanup interval for expired sessions
   */
  private startCleanupInterval(): void {
    const intervalMs = this.config.cleanupIntervalHours * 60 * 60 * 1000;
    
    this.cleanupInterval = setInterval(async () => {
      try {
        const cleaned = await this.cleanupExpiredSessions();
        if (cleaned > 0) {
          console.log(`Cleaned up ${cleaned} expired conversation sessions`);
        }
      } catch (error) {
        console.error('Error during session cleanup:', error);
      }
    }, intervalMs);
  }

  /**
   * Stop cleanup interval
   */
  stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  /**
   * Validate configuration
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.config.sessionTimeoutMinutes < 1 || this.config.sessionTimeoutMinutes > 1440) {
      errors.push('sessionTimeoutMinutes must be between 1 and 1440 (24 hours)');
    }

    if (this.config.conversationHistoryLimit < 1 || this.config.conversationHistoryLimit > 100) {
      errors.push('conversationHistoryLimit must be between 1 and 100');
    }

    if (this.config.contextWindowTokens < 100 || this.config.contextWindowTokens > 10000) {
      errors.push('contextWindowTokens must be between 100 and 10000');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// ===== SINGLETON INSTANCE =====
let conversationManagerInstance: ConversationManager | null = null;

export function getConversationManager(
  prisma?: PrismaClient, 
  config?: Partial<ConversationManagerConfig>
): ConversationManager {
  if (!conversationManagerInstance) {
    if (!prisma) {
      throw new Error('PrismaClient instance is required for first initialization');
    }
    conversationManagerInstance = new ConversationManager(prisma, config);
  }
  return conversationManagerInstance;
}
