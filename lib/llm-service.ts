// ===== LLM SERVICE - GPT-4o INTEGRATION =====

import OpenAI from 'openai';
import { getOpenAIClient } from './openai-client';

export interface LLMConfig {
  model: string;
  maxTokens: number;
  temperature: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  timeout: number;
  maxRetries: number;
}

export interface LLMResponse {
  text: string;
  tokensUsed: number;
  cost: number;
  model: string;
  finishReason: string;
  processingTimeMs: number;
}

export interface StreamingLLMResponse {
  chunk: string;
  completed: boolean;
  tokensUsed: number;
  cost: number;
  sessionId: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
}

export interface BusinessQuota {
  businessId: string;
  monthlyLimit: number;
  currentUsage: number;
  remainingQuota: number;
  resetDate: Date;
}

export class LLMService {
  private openai: OpenAI;
  private config: LLMConfig;
  private tokenCosts: {
    inputCostPer1K: number;
    outputCostPer1K: number;
  };

  constructor(config?: Partial<LLMConfig>) {
    this.openai = getOpenAIClient();
    this.config = {
      model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o',
      maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '4000'),
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
      topP: parseFloat(process.env.OPENAI_TOP_P || '1.0'),
      frequencyPenalty: parseFloat(process.env.OPENAI_FREQUENCY_PENALTY || '0.0'),
      presencePenalty: parseFloat(process.env.OPENAI_PRESENCE_PENALTY || '0.0'),
      timeout: parseInt(process.env.RESPONSE_TIMEOUT_MS || '30000'),
      maxRetries: parseInt(process.env.RESPONSE_MAX_RETRIES || '3'),
      ...config
    };

    this.tokenCosts = {
      inputCostPer1K: parseFloat(process.env.GPT4O_COST_PER_1K_INPUT_TOKENS || '0.005'),
      outputCostPer1K: parseFloat(process.env.GPT4O_COST_PER_1K_OUTPUT_TOKENS || '0.015')
    };
  }

  /**
   * Generate a complete response using GPT-4o
   */
  async generateResponse(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    businessId: string,
    sessionId?: string
  ): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      // Check quota before making request
      await this.checkQuota(businessId);

      const response = await this.openai.chat.completions.create({
        model: this.config.model,
        messages,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        top_p: this.config.topP,
        frequency_penalty: this.config.frequencyPenalty,
        presence_penalty: this.config.presencePenalty
      });

      const processingTime = Date.now() - startTime;
      const usage = this.calculateTokenUsage(response.usage);
      
      // Track usage for billing
      await this.trackUsage(businessId, usage);

      return {
        text: response.choices[0]?.message?.content || '',
        tokensUsed: usage.totalTokens,
        cost: usage.cost,
        model: this.config.model,
        finishReason: response.choices[0]?.finish_reason || 'unknown',
        processingTimeMs: processingTime
      };

    } catch (error) {
      console.error('LLM Service Error:', error);
      throw this.handleLLMError(error);
    }
  }

  /**
   * Generate streaming response using GPT-4o
   */
  async *generateStreamingResponse(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    businessId: string,
    sessionId: string
  ): AsyncGenerator<StreamingLLMResponse, void, unknown> {
    const startTime = Date.now();
    let totalTokens = 0;
    let accumulatedCost = 0;

    try {
      // Check quota before making request
      await this.checkQuota(businessId);

      const stream = await this.openai.chat.completions.create({
        model: this.config.model,
        messages,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        top_p: this.config.topP,
        frequency_penalty: this.config.frequencyPenalty,
        presence_penalty: this.config.presencePenalty,
        stream: true
      });

      let fullResponse = '';
      let isCompleted = false;

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        
        if (content) {
          fullResponse += content;
          
          // Estimate tokens for this chunk (rough approximation)
          const chunkTokens = Math.ceil(content.length / 4);
          totalTokens += chunkTokens;
          
          yield {
            chunk: content,
            completed: false,
            tokensUsed: totalTokens,
            cost: this.calculateCost(0, totalTokens), // Rough estimate
            sessionId
          };
        }

        // Check if stream is complete
        if (chunk.choices[0]?.finish_reason) {
          isCompleted = true;
          
          // Final token count from usage if available
          if (chunk.usage) {
            const usage = this.calculateTokenUsage(chunk.usage);
            totalTokens = usage.totalTokens;
            accumulatedCost = usage.cost;
          }

          // Track final usage
          await this.trackUsage(businessId, {
            promptTokens: 0, // Will be calculated from messages
            completionTokens: totalTokens,
            totalTokens,
            cost: accumulatedCost
          });

          yield {
            chunk: '',
            completed: true,
            tokensUsed: totalTokens,
            cost: accumulatedCost,
            sessionId
          };
        }
      }

    } catch (error) {
      console.error('LLM Streaming Error:', error);
      throw this.handleLLMError(error);
    }
  }

  /**
   * Check if business has remaining quota
   */
  private async checkQuota(businessId: string): Promise<void> {
    // This would integrate with your billing/quota system
    // For now, we'll implement a basic check
    const quota = await this.getBusinessQuota(businessId);
    
    if (quota.remainingQuota <= 0) {
      throw new Error(`Monthly token quota exceeded for business ${businessId}. Reset date: ${quota.resetDate.toISOString()}`);
    }
  }

  /**
   * Get business quota information
   */
  async getBusinessQuota(businessId: string): Promise<BusinessQuota> {
    // This would integrate with your database/billing system
    // For now, return a default quota
    const monthlyLimit = parseInt(process.env.MONTHLY_TOKEN_LIMIT_PER_BUSINESS || '1000000');
    
    return {
      businessId,
      monthlyLimit,
      currentUsage: 0, // Would be fetched from database
      remainingQuota: monthlyLimit,
      resetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    };
  }

  /**
   * Track token usage for billing
   */
  private async trackUsage(businessId: string, usage: TokenUsage): Promise<void> {
    // This would integrate with your billing system
    console.log(`Tracking usage for business ${businessId}:`, usage);
    
    // In a real implementation, you would:
    // 1. Store usage in database
    // 2. Update billing records
    // 3. Check for quota limits
    // 4. Send alerts if approaching limits
  }

  /**
   * Calculate token usage and cost
   */
  private calculateTokenUsage(usage: OpenAI.Completions.CompletionUsage | undefined): TokenUsage {
    if (!usage) {
      return {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        cost: 0
      };
    }

    const cost = this.calculateCost(usage.prompt_tokens, usage.completion_tokens);

    return {
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
      cost
    };
  }

  /**
   * Calculate cost based on token usage
   */
  private calculateCost(promptTokens: number, completionTokens: number): number {
    const promptCost = (promptTokens / 1000) * this.tokenCosts.inputCostPer1K;
    const completionCost = (completionTokens / 1000) * this.tokenCosts.outputCostPer1K;
    return promptCost + completionCost;
  }

  /**
   * Handle LLM API errors with appropriate fallbacks
   */
  private handleLLMError(error: any): Error {
    if (error.code === 'rate_limit_exceeded') {
      return new Error('Rate limit exceeded. Please try again in a moment.');
    }
    
    if (error.code === 'insufficient_quota') {
      return new Error('API quota exceeded. Please contact support.');
    }
    
    if (error.code === 'invalid_api_key') {
      return new Error('API authentication failed. Please contact support.');
    }
    
    if (error.type === 'timeout') {
      return new Error('Request timeout. Please try again.');
    }
    
    // Generic error
    return new Error('AI service temporarily unavailable. Please try again later.');
  }

  /**
   * Generate fallback response when LLM is unavailable
   */
  generateFallbackResponse(intent: string, businessName: string): string {
    const fallbackResponses: Record<string, string> = {
      'MENU_INQUIRY': `I'd be happy to help you with our menu at ${businessName}. However, I'm currently experiencing technical difficulties. Please contact us directly for the most up-to-date information.`,
      'HOURS_POLICY': `I can help you with our hours and policies at ${businessName}. Due to a technical issue, please call us directly for current information.`,
      'PRICING_QUESTION': `I'd love to help you with pricing information for ${businessName}. Please contact us directly for the most accurate and current pricing.`,
      'DIETARY_RESTRICTIONS': `I can help you with dietary options at ${businessName}. Please contact us directly to discuss your specific dietary needs.`,
      'LOCATION_INFO': `I can help you with location information for ${businessName}. Please contact us directly for directions and location details.`,
      'GENERAL_CHAT': `Thank you for contacting ${businessName}! I'm currently experiencing technical difficulties. Please feel free to reach out to us directly.`,
      'COMPLAINT_FEEDBACK': `I appreciate you reaching out to ${businessName}. Please contact us directly so we can address your concerns properly.`,
      'UNKNOWN': `Thank you for contacting ${businessName}. I'm currently experiencing technical difficulties. Please contact us directly for assistance.`
    };

    return fallbackResponses[intent] || fallbackResponses['UNKNOWN'];
  }

  /**
   * Validate response quality
   */
  validateResponse(response: string, context: any): {
    isValid: boolean;
    confidence: number;
    issues: string[];
  } {
    const issues: string[] = [];
    let confidence = 1.0;

    // Check for empty response
    if (!response || response.trim().length === 0) {
      issues.push('Empty response');
      confidence = 0;
    }

    // Check for appropriate length
    if (response.length < 10) {
      issues.push('Response too short');
      confidence *= 0.5;
    }

    if (response.length > 2000) {
      issues.push('Response too long');
      confidence *= 0.8;
    }

    // Check for business relevance
    if (context.businessName && !response.toLowerCase().includes(context.businessName.toLowerCase())) {
      // This is not always an issue, but worth noting
      confidence *= 0.9;
    }

    // Check for inappropriate content (basic check)
    const inappropriateWords = ['hate', 'stupid', 'idiot', 'kill', 'die'];
    const hasInappropriateContent = inappropriateWords.some(word => 
      response.toLowerCase().includes(word)
    );
    
    if (hasInappropriateContent) {
      issues.push('Potentially inappropriate content');
      confidence = 0;
    }

    return {
      isValid: issues.length === 0,
      confidence: Math.max(0, confidence),
      issues
    };
  }
}

// ===== SINGLETON INSTANCE =====
let llmServiceInstance: LLMService | null = null;

export function getLLMService(config?: Partial<LLMConfig>): LLMService {
  if (!llmServiceInstance) {
    llmServiceInstance = new LLMService(config);
  }
  return llmServiceInstance;
}
