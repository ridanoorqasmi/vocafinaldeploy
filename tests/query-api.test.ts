// ===== QUERY API TESTS =====

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as queryPOST } from '../app/api/v1/query/route';
import { GET as analyticsGET } from '../app/api/v1/analytics/query/route';

// Mock dependencies
vi.mock('../lib/auth-middleware', () => ({
  validateBusinessAuth: vi.fn()
}));

vi.mock('../lib/query-processor', () => ({
  getQueryProcessor: vi.fn(() => ({
    processQuery: vi.fn(),
    getProcessorStats: vi.fn()
  }))
}));

vi.mock('../lib/analytics-logger', () => ({
  getAnalyticsLogger: vi.fn(() => ({
    getQueryAnalytics: vi.fn(),
    getSessionAnalytics: vi.fn(),
    getRealTimeMetrics: vi.fn(),
    searchQueryLogs: vi.fn()
  }))
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => ({
    $disconnect: vi.fn()
  }))
}));

describe('Query API Endpoints', () => {
  let mockRequest: NextRequest;
  let mockAuthResult: any;
  let mockQueryProcessor: any;
  let mockAnalyticsLogger: any;

  beforeEach(() => {
    mockRequest = {
      json: vi.fn(),
      headers: new Headers()
    } as any;

    mockAuthResult = {
      success: true,
      businessId: 'business-123'
    };

    mockQueryProcessor = {
      processQuery: vi.fn(),
      getProcessorStats: vi.fn()
    };

    mockAnalyticsLogger = {
      getQueryAnalytics: vi.fn(),
      getSessionAnalytics: vi.fn(),
      getRealTimeMetrics: vi.fn(),
      searchQueryLogs: vi.fn()
    };

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('POST /api/v1/query', () => {
    it('should handle successful query processing', async () => {
      const { validateBusinessAuth } = await import('../lib/auth-middleware');
      const { getQueryProcessor } = await import('../lib/query-processor');

      (validateBusinessAuth as any).mockResolvedValue(mockAuthResult);
      (getQueryProcessor as any).mockReturnValue(mockQueryProcessor);

      (mockRequest.json as any).mockResolvedValue({
        query: 'What is your best pizza?',
        sessionId: 'test-session-123',
        customerId: 'customer-456',
        context: {
          location: 'New York',
          preferences: ['vegetarian']
        }
      });

      mockQueryProcessor.processQuery.mockResolvedValue({
        response: {
          text: "I'd be happy to help you with our menu! Let me find the most relevant information for you.",
          confidence: 0.9,
          sources: ['embedding-1', 'embedding-2'],
          intent: 'MENU_INQUIRY',
          suggestions: [
            "What are your most popular items?",
            "Do you have any specials today?",
            "What ingredients do you use?"
          ]
        },
        session: {
          sessionId: 'test-session-123',
          expiresAt: '2024-01-15T11:00:00Z',
          contextSummary: 'Customer asking about pizza'
        },
        metadata: {
          processingTimeMs: 250,
          tokensUsed: 0,
          contextSources: ['menu', 'business_data']
        }
      });

      const response = await queryPOST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data.response.text).toContain('menu');
      expect(responseData.data.response.intent).toBe('MENU_INQUIRY');
      expect(responseData.data.session.sessionId).toBe('test-session-123');
      expect(responseData.data.metadata.processingTimeMs).toBeGreaterThan(0);
    });

    it('should handle authentication failure', async () => {
      const { validateBusinessAuth } = await import('../lib/auth-middleware');
      
      (validateBusinessAuth as any).mockResolvedValue({
        success: false,
        error: 'Invalid token'
      });

      (mockRequest.json as any).mockResolvedValue({
        query: 'What is your best pizza?'
      });

      const response = await queryPOST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(401);
      expect(responseData.success).toBe(false);
      expect(responseData.error.code).toBe('UNAUTHORIZED');
    });

    it('should handle invalid request parameters', async () => {
      const { validateBusinessAuth } = await import('../lib/auth-middleware');
      
      (validateBusinessAuth as any).mockResolvedValue(mockAuthResult);

      (mockRequest.json as any).mockResolvedValue({
        query: '', // Invalid empty query
        sessionId: 'invalid-session-id-format'
      });

      const response = await queryPOST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error.code).toBe('INVALID_REQUEST');
    });

    it('should handle rate limiting errors', async () => {
      const { validateBusinessAuth } = await import('../lib/auth-middleware');
      const { getQueryProcessor } = await import('../lib/query-processor');

      (validateBusinessAuth as any).mockResolvedValue(mockAuthResult);
      (getQueryProcessor as any).mockReturnValue(mockQueryProcessor);

      (mockRequest.json as any).mockResolvedValue({
        query: 'What is your best pizza?'
      });

      mockQueryProcessor.processQuery.mockRejectedValue(
        new Error('Rate limit exceeded. Try again in 60 seconds.')
      );

      const response = await queryPOST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(429);
      expect(responseData.success).toBe(false);
      expect(responseData.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should handle session expiration errors', async () => {
      const { validateBusinessAuth } = await import('../lib/auth-middleware');
      const { getQueryProcessor } = await import('../lib/query-processor');

      (validateBusinessAuth as any).mockResolvedValue(mockAuthResult);
      (getQueryProcessor as any).mockReturnValue(mockQueryProcessor);

      (mockRequest.json as any).mockResolvedValue({
        query: 'What is your best pizza?',
        sessionId: 'expired-session-123'
      });

      mockQueryProcessor.processQuery.mockRejectedValue(
        new Error('Session has expired. Please start a new conversation.')
      );

      const response = await queryPOST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(410);
      expect(responseData.success).toBe(false);
      expect(responseData.error.code).toBe('SESSION_EXPIRED');
    });

    it('should handle business not found errors', async () => {
      const { validateBusinessAuth } = await import('../lib/auth-middleware');
      const { getQueryProcessor } = await import('../lib/query-processor');

      (validateBusinessAuth as any).mockResolvedValue(mockAuthResult);
      (getQueryProcessor as any).mockReturnValue(mockQueryProcessor);

      (mockRequest.json as any).mockResolvedValue({
        query: 'What is your best pizza?'
      });

      mockQueryProcessor.processQuery.mockRejectedValue(
        new Error('Business not found or access denied')
      );

      const response = await queryPOST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(404);
      expect(responseData.success).toBe(false);
      expect(responseData.error.code).toBe('BUSINESS_NOT_FOUND');
    });

    it('should handle internal server errors', async () => {
      const { validateBusinessAuth } = await import('../lib/auth-middleware');
      const { getQueryProcessor } = await import('../lib/query-processor');

      (validateBusinessAuth as any).mockResolvedValue(mockAuthResult);
      (getQueryProcessor as any).mockReturnValue(mockQueryProcessor);

      (mockRequest.json as any).mockResolvedValue({
        query: 'What is your best pizza?'
      });

      mockQueryProcessor.processQuery.mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await queryPOST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.success).toBe(false);
      expect(responseData.error.code).toBe('INTERNAL_ERROR');
    });

    it('should extract request metadata correctly', async () => {
      const { validateBusinessAuth } = await import('../lib/auth-middleware');
      const { getQueryProcessor } = await import('../lib/query-processor');

      (validateBusinessAuth as any).mockResolvedValue(mockAuthResult);
      (getQueryProcessor as any).mockReturnValue(mockQueryProcessor);

      // Mock headers
      mockRequest.headers.set('user-agent', 'Test Browser/1.0');
      mockRequest.headers.set('x-forwarded-for', '192.168.1.1');

      (mockRequest.json as any).mockResolvedValue({
        query: 'What is your best pizza?'
      });

      mockQueryProcessor.processQuery.mockResolvedValue({
        response: {
          text: 'Test response',
          confidence: 0.9,
          sources: [],
          intent: 'MENU_INQUIRY',
          suggestions: []
        },
        session: {
          sessionId: 'test-session',
          expiresAt: '2024-01-15T11:00:00Z',
          contextSummary: ''
        },
        metadata: {
          processingTimeMs: 100,
          tokensUsed: 0,
          contextSources: []
        }
      });

      await queryPOST(mockRequest);

      expect(mockQueryProcessor.processQuery).toHaveBeenCalledWith(
        'business-123',
        expect.objectContaining({
          query: 'What is your best pizza?'
        }),
        'Test Browser/1.0',
        '192.168.1.1'
      );
    });
  });

  describe('GET /api/v1/analytics/query', () => {
    it('should return query analytics successfully', async () => {
      const { validateBusinessAuth } = await import('../lib/auth-middleware');
      const { getAnalyticsLogger } = await import('../lib/analytics-logger');
      const { getQueryProcessor } = await import('../lib/query-processor');

      (validateBusinessAuth as any).mockResolvedValue(mockAuthResult);
      (getAnalyticsLogger as any).mockReturnValue(mockAnalyticsLogger);
      (getQueryProcessor as any).mockReturnValue(mockQueryProcessor);

      // Mock URL with query parameters
      mockRequest.url = 'http://localhost:3000/api/v1/analytics/query?startDate=2024-01-01T00:00:00Z&limit=10';

      mockAnalyticsLogger.getQueryAnalytics.mockResolvedValue({
        totalQueries: 100,
        successfulQueries: 95,
        averageProcessingTime: 250,
        averageConfidence: 0.87,
        intentDistribution: {
          MENU_INQUIRY: 40,
          HOURS_POLICY: 20,
          PRICING_QUESTION: 15,
          DIETARY_RESTRICTIONS: 10,
          LOCATION_INFO: 8,
          GENERAL_CHAT: 5,
          COMPLAINT_FEEDBACK: 2,
          UNKNOWN: 0
        },
        errorDistribution: {
          ERROR: 3,
          TIMEOUT: 2
        },
        topQueries: [
          { query: 'What do you have?', count: 10, averageConfidence: 0.9 },
          { query: 'What are your hours?', count: 8, averageConfidence: 0.85 }
        ]
      });

      mockAnalyticsLogger.getSessionAnalytics.mockResolvedValue({
        totalSessions: 50,
        activeSessions: 5,
        averageSessionDuration: 15.5,
        averageQueriesPerSession: 2.0,
        sessionCompletionRate: 0.8
      });

      mockAnalyticsLogger.getRealTimeMetrics.mockResolvedValue({
        queriesLastHour: 25,
        activeSessions: 5,
        averageResponseTime: 200,
        errorRate: 0.05,
        topIntents: [
          { intent: 'MENU_INQUIRY', count: 15 },
          { intent: 'HOURS_POLICY', count: 8 }
        ]
      });

      mockQueryProcessor.getProcessorStats.mockResolvedValue({
        totalQueries: 100,
        averageProcessingTime: 250,
        successRate: 0.95,
        intentDistribution: {
          MENU_INQUIRY: 40,
          HOURS_POLICY: 20,
          PRICING_QUESTION: 15,
          DIETARY_RESTRICTIONS: 10,
          LOCATION_INFO: 8,
          GENERAL_CHAT: 5,
          COMPLAINT_FEEDBACK: 2,
          UNKNOWN: 0
        }
      });

      const response = await analyticsGET(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data.queryAnalytics.totalQueries).toBe(100);
      expect(responseData.data.sessionAnalytics.totalSessions).toBe(50);
      expect(responseData.data.realTimeMetrics.queriesLastHour).toBe(25);
      expect(responseData.data.processorStats.successRate).toBe(0.95);
    });

    it('should handle authentication failure', async () => {
      const { validateBusinessAuth } = await import('../lib/auth-middleware');
      
      (validateBusinessAuth as any).mockResolvedValue({
        success: false,
        error: 'Invalid token'
      });

      const response = await analyticsGET(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(401);
      expect(responseData.success).toBe(false);
      expect(responseData.error.code).toBe('UNAUTHORIZED');
    });

    it('should handle invalid query parameters', async () => {
      const { validateBusinessAuth } = await import('../lib/auth-middleware');
      
      (validateBusinessAuth as any).mockResolvedValue(mockAuthResult);

      // Mock URL with invalid parameters
      mockRequest.url = 'http://localhost:3000/api/v1/analytics/query?startDate=invalid-date&limit=1000';

      const response = await analyticsGET(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error.code).toBe('INVALID_REQUEST');
    });

    it('should return detailed query logs when requested', async () => {
      const { validateBusinessAuth } = await import('../lib/auth-middleware');
      const { getAnalyticsLogger } = await import('../lib/analytics-logger');
      const { getQueryProcessor } = await import('../lib/query-processor');

      (validateBusinessAuth as any).mockResolvedValue(mockAuthResult);
      (getAnalyticsLogger as any).mockReturnValue(mockAnalyticsLogger);
      (getQueryProcessor as any).mockReturnValue(mockQueryProcessor);

      // Mock URL with limit parameter to trigger query logs
      mockRequest.url = 'http://localhost:3000/api/v1/analytics/query?limit=5';

      mockAnalyticsLogger.getQueryAnalytics.mockResolvedValue({
        totalQueries: 100,
        successfulQueries: 95,
        averageProcessingTime: 250,
        averageConfidence: 0.87,
        intentDistribution: {},
        errorDistribution: {},
        topQueries: []
      });

      mockAnalyticsLogger.getSessionAnalytics.mockResolvedValue({
        totalSessions: 50,
        activeSessions: 5,
        averageSessionDuration: 15.5,
        averageQueriesPerSession: 2.0,
        sessionCompletionRate: 0.8
      });

      mockAnalyticsLogger.getRealTimeMetrics.mockResolvedValue({
        queriesLastHour: 25,
        activeSessions: 5,
        averageResponseTime: 200,
        errorRate: 0.05,
        topIntents: []
      });

      mockAnalyticsLogger.searchQueryLogs.mockResolvedValue({
        logs: [
          {
            id: 'log-1',
            businessId: 'business-123',
            queryText: 'What do you have?',
            intentDetected: 'MENU_INQUIRY',
            status: 'SUCCESS',
            createdAt: new Date()
          },
          {
            id: 'log-2',
            businessId: 'business-123',
            queryText: 'What are your hours?',
            intentDetected: 'HOURS_POLICY',
            status: 'SUCCESS',
            createdAt: new Date()
          }
        ],
        total: 2,
        hasMore: false
      });

      mockQueryProcessor.getProcessorStats.mockResolvedValue({
        totalQueries: 100,
        averageProcessingTime: 250,
        successRate: 0.95,
        intentDistribution: {}
      });

      const response = await analyticsGET(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data.queryLogs).toBeDefined();
      expect(responseData.data.queryLogs.logs).toHaveLength(2);
      expect(responseData.data.queryLogs.logs[0].queryText).toBe('What do you have?');
    });

    it('should handle internal server errors', async () => {
      const { validateBusinessAuth } = await import('../lib/auth-middleware');
      const { getAnalyticsLogger } = await import('../lib/analytics-logger');
      const { getQueryProcessor } = await import('../lib/query-processor');

      (validateBusinessAuth as any).mockResolvedValue(mockAuthResult);
      (getAnalyticsLogger as any).mockReturnValue(mockAnalyticsLogger);
      (getQueryProcessor as any).mockReturnValue(mockQueryProcessor);

      mockAnalyticsLogger.getQueryAnalytics.mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await analyticsGET(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.success).toBe(false);
      expect(responseData.error.code).toBe('INTERNAL_ERROR');
    });
  });
});

