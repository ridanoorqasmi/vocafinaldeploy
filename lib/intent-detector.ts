// ===== INTENT DETECTION SERVICE =====

import { QueryIntent, IntentDetectionConfig, DEFAULT_INTENT_CONFIG } from './query-types';
import { getOpenAIClient } from './openai-client';

export interface IntentDetectionResult {
  intent: QueryIntent;
  confidence: number;
  reasoning?: string;
  alternatives?: Array<{
    intent: QueryIntent;
    confidence: number;
  }>;
}

export interface IntentPattern {
  intent: QueryIntent;
  keywords: string[];
  patterns: RegExp[];
  examples: string[];
}

export class IntentDetector {
  private config: IntentDetectionConfig;
  private openaiClient: any;
  private intentPatterns: IntentPattern[];

  constructor(config?: Partial<IntentDetectionConfig>) {
    this.config = { ...DEFAULT_INTENT_CONFIG, ...config };
    this.openaiClient = getOpenAIClient();
    this.intentPatterns = this.initializeIntentPatterns();
  }

  /**
   * Detect intent from query text
   */
  async detectIntent(query: string): Promise<IntentDetectionResult> {
    try {
      // First try rule-based detection for speed
      const ruleBasedResult = this.detectIntentRuleBased(query);
      
      if (ruleBasedResult.confidence >= this.config.confidenceThreshold) {
        return ruleBasedResult;
      }

      // Fall back to AI-based detection for better accuracy
      const aiResult = await this.detectIntentAI(query);
      
      // Combine results if both are available
      if (ruleBasedResult.confidence > 0.3 && aiResult.confidence > 0.3) {
        return this.combineIntentResults(ruleBasedResult, aiResult);
      }

      // Return the better result
      return aiResult.confidence > ruleBasedResult.confidence ? aiResult : ruleBasedResult;

    } catch (error) {
      console.error('Intent detection error:', error);
      
      // Fallback to rule-based detection
      const fallbackResult = this.detectIntentRuleBased(query);
      return {
        intent: fallbackResult.intent,
        confidence: Math.max(0.1, fallbackResult.confidence * 0.5),
        reasoning: 'Fallback detection due to AI service error'
      };
    }
  }

  /**
   * Rule-based intent detection using patterns and keywords
   */
  private detectIntentRuleBased(query: string): IntentDetectionResult {
    const lowerQuery = query.toLowerCase();
    const scores: Record<QueryIntent, number> = {
      MENU_INQUIRY: 0,
      HOURS_POLICY: 0,
      PRICING_QUESTION: 0,
      DIETARY_RESTRICTIONS: 0,
      LOCATION_INFO: 0,
      GENERAL_CHAT: 0,
      COMPLAINT_FEEDBACK: 0,
      UNKNOWN: 0
    };

    // Score each intent based on patterns
    for (const pattern of this.intentPatterns) {
      let patternScore = 0;

      // Check keywords
      for (const keyword of pattern.keywords) {
        if (lowerQuery.includes(keyword.toLowerCase())) {
          patternScore += 1;
        }
      }

      // Check regex patterns
      for (const regex of pattern.patterns) {
        if (regex.test(lowerQuery)) {
          patternScore += 2;
        }
      }

      scores[pattern.intent] = patternScore;
    }

    // Find the highest scoring intent
    const sortedIntents = Object.entries(scores)
      .sort(([, a], [, b]) => b - a)
      .map(([intent, score]) => ({
        intent: intent as QueryIntent,
        confidence: Math.min(1, score / 5) // Normalize to 0-1
      }));

    const bestMatch = sortedIntents[0];
    const alternatives = sortedIntents.slice(1, 4).filter(alt => alt.confidence > 0.1);

    return {
      intent: bestMatch.intent,
      confidence: bestMatch.confidence,
      reasoning: `Rule-based detection with ${bestMatch.confidence.toFixed(2)} confidence`,
      alternatives: alternatives.length > 0 ? alternatives : undefined
    };
  }

  /**
   * AI-based intent detection using OpenAI
   */
  private async detectIntentAI(query: string): Promise<IntentDetectionResult> {
    const prompt = this.buildIntentDetectionPrompt(query);
    
    try {
      const response = await this.openaiClient.chat.completions.create({
        model: 'gpt-4o-mini', // Use faster model for intent detection
        messages: [
          {
            role: 'system',
            content: 'You are an expert at classifying restaurant customer queries. Analyze the query and determine the most likely intent.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 200,
        temperature: 0.1 // Low temperature for consistent classification
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      return this.parseAIResponse(content);

    } catch (error) {
      console.error('AI intent detection error:', error);
      throw error;
    }
  }

  /**
   * Combine results from rule-based and AI detection
   */
  private combineIntentResults(ruleResult: IntentDetectionResult, aiResult: IntentDetectionResult): IntentDetectionResult {
    // If both agree on the intent, boost confidence
    if (ruleResult.intent === aiResult.intent) {
      const combinedConfidence = Math.min(1, (ruleResult.confidence + aiResult.confidence) / 2 + 0.1);
      return {
        intent: ruleResult.intent,
        confidence: combinedConfidence,
        reasoning: `Combined detection: rule-based (${ruleResult.confidence.toFixed(2)}) + AI (${aiResult.confidence.toFixed(2)})`,
        alternatives: aiResult.alternatives
      };
    }

    // If they disagree, use the higher confidence result
    if (aiResult.confidence > ruleResult.confidence) {
      return {
        ...aiResult,
        reasoning: `AI detection preferred over rule-based (${ruleResult.confidence.toFixed(2)})`
      };
    } else {
      return {
        ...ruleResult,
        reasoning: `Rule-based detection preferred over AI (${aiResult.confidence.toFixed(2)})`
      };
    }
  }

  /**
   * Build prompt for AI intent detection
   */
  private buildIntentDetectionPrompt(query: string): string {
    return `Analyze this restaurant customer query and classify it into one of these intents:

QUERY: "${query}"

INTENT CATEGORIES:
- MENU_INQUIRY: Questions about food items, dishes, ingredients, recommendations
- HOURS_POLICY: Questions about operating hours, policies, procedures
- PRICING_QUESTION: Questions about prices, costs, deals, discounts
- DIETARY_RESTRICTIONS: Questions about allergies, dietary needs, special diets
- LOCATION_INFO: Questions about address, directions, delivery areas
- GENERAL_CHAT: Greetings, small talk, general conversation
- COMPLAINT_FEEDBACK: Complaints, issues, feedback, problems
- UNKNOWN: Unclear or ambiguous queries

Respond in this exact JSON format:
{
  "intent": "INTENT_NAME",
  "confidence": 0.95,
  "reasoning": "Brief explanation of why this intent was chosen"
}`;
  }

  /**
   * Parse AI response into structured result
   */
  private parseAIResponse(content: string): IntentDetectionResult {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate the response
      if (!parsed.intent || !parsed.confidence) {
        throw new Error('Invalid response format');
      }

      const validIntents: QueryIntent[] = [
        'MENU_INQUIRY', 'HOURS_POLICY', 'PRICING_QUESTION', 'DIETARY_RESTRICTIONS',
        'LOCATION_INFO', 'GENERAL_CHAT', 'COMPLAINT_FEEDBACK', 'UNKNOWN'
      ];

      if (!validIntents.includes(parsed.intent)) {
        parsed.intent = 'UNKNOWN';
      }

      return {
        intent: parsed.intent,
        confidence: Math.min(1, Math.max(0, parsed.confidence)),
        reasoning: parsed.reasoning || 'AI-based detection'
      };

    } catch (error) {
      console.error('Error parsing AI response:', error);
      return {
        intent: 'UNKNOWN',
        confidence: 0.1,
        reasoning: 'Failed to parse AI response'
      };
    }
  }

  /**
   * Initialize intent patterns for rule-based detection
   */
  private initializeIntentPatterns(): IntentPattern[] {
    return [
      {
        intent: 'MENU_INQUIRY',
        keywords: ['menu', 'food', 'dish', 'pizza', 'burger', 'pasta', 'salad', 'appetizer', 'entree', 'dessert', 'drink', 'beverage', 'special', 'recommendation', 'ingredients', 'recipe'],
        patterns: [
          /what.*on.*menu/i,
          /do you have.*food/i,
          /what.*recommend/i,
          /best.*dish/i,
          /what.*ingredients/i,
          /is.*available/i
        ],
        examples: ['What\'s on your menu?', 'Do you have pizza?', 'What do you recommend?']
      },
      {
        intent: 'HOURS_POLICY',
        keywords: ['hours', 'open', 'close', 'closed', 'time', 'when', 'policy', 'rules', 'delivery', 'pickup', 'reservation', 'booking'],
        patterns: [
          /what.*hours/i,
          /when.*open/i,
          /when.*close/i,
          /are you.*open/i,
          /delivery.*policy/i,
          /reservation.*policy/i
        ],
        examples: ['What are your hours?', 'When do you close?', 'Do you deliver?']
      },
      {
        intent: 'PRICING_QUESTION',
        keywords: ['price', 'cost', 'how much', 'expensive', 'cheap', 'deal', 'discount', 'special', 'promotion', 'offer', 'dollar', '$'],
        patterns: [
          /how much.*cost/i,
          /what.*price/i,
          /how much.*dollar/i,
          /any.*deal/i,
          /discount.*available/i,
          /\$\d+/i
        ],
        examples: ['How much does the pizza cost?', 'What\'s the price?', 'Any deals today?']
      },
      {
        intent: 'DIETARY_RESTRICTIONS',
        keywords: ['vegan', 'vegetarian', 'gluten', 'allergy', 'allergic', 'dairy', 'nuts', 'peanut', 'soy', 'kosher', 'halal', 'keto', 'paleo', 'diet'],
        patterns: [
          /do you have.*vegan/i,
          /is.*gluten.*free/i,
          /allergic.*to/i,
          /dietary.*restriction/i,
          /special.*diet/i
        ],
        examples: ['Do you have vegan options?', 'I\'m allergic to nuts', 'Is this gluten-free?']
      },
      {
        intent: 'LOCATION_INFO',
        keywords: ['where', 'location', 'address', 'directions', 'near', 'close', 'delivery', 'area', 'zip', 'city', 'street'],
        patterns: [
          /where.*located/i,
          /what.*address/i,
          /how.*get.*there/i,
          /deliver.*to/i,
          /near.*me/i
        ],
        examples: ['Where are you located?', 'What\'s your address?', 'Do you deliver to my area?']
      },
      {
        intent: 'GENERAL_CHAT',
        keywords: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'how are you', 'thank you', 'thanks', 'bye', 'goodbye'],
        patterns: [
          /^(hello|hi|hey)$/i,
          /good.*morning/i,
          /how.*are.*you/i,
          /thank.*you/i
        ],
        examples: ['Hello', 'Hi there', 'How are you?', 'Thank you']
      },
      {
        intent: 'COMPLAINT_FEEDBACK',
        keywords: ['complaint', 'problem', 'issue', 'wrong', 'bad', 'terrible', 'awful', 'disappointed', 'angry', 'upset', 'refund', 'money back'],
        patterns: [
          /my.*order.*wrong/i,
          /terrible.*service/i,
          /want.*refund/i,
          /very.*disappointed/i,
          /worst.*ever/i
        ],
        examples: ['My order was wrong', 'This is terrible', 'I want a refund']
      }
    ];
  }

  /**
   * Get intent statistics for analytics
   */
  getIntentStats(): Record<QueryIntent, { patterns: number; keywords: number; examples: number }> {
    const stats: Record<QueryIntent, { patterns: number; keywords: number; examples: number }> = {} as any;

    for (const pattern of this.intentPatterns) {
      stats[pattern.intent] = {
        patterns: pattern.patterns.length,
        keywords: pattern.keywords.length,
        examples: pattern.examples.length
      };
    }

    return stats;
  }

  /**
   * Validate configuration
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.config.confidenceThreshold < 0 || this.config.confidenceThreshold > 1) {
      errors.push('confidenceThreshold must be between 0 and 1');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// ===== SINGLETON INSTANCE =====
let intentDetectorInstance: IntentDetector | null = null;

export function getIntentDetector(config?: Partial<IntentDetectionConfig>): IntentDetector {
  if (!intentDetectorInstance) {
    intentDetectorInstance = new IntentDetector(config);
  }
  return intentDetectorInstance;
}

