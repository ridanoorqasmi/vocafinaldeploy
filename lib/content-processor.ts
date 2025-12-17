// ===== CONTENT PROCESSING UTILITIES =====

import { EmbeddingType } from './embedding-types';
import { OPENAI_CONFIG } from './openai-client';

// Content processing interfaces
export interface ProcessedContent {
  text: string;
  metadata: Record<string, any>;
  tokenCount: number;
}

export interface MenuItemData {
  name: string;
  description?: string;
  category?: string;
  price?: number;
  allergens?: string[];
  calories?: number;
  prepTime?: number;
}

export interface PolicyData {
  title: string;
  content: string;
  type: string;
  effectiveDate?: Date;
}

export interface FAQData {
  question: string;
  answer: string;
  category?: string;
  tags?: string[];
}

export interface BusinessData {
  name: string;
  description?: string;
  cuisineType?: string;
  location?: string;
  industry?: string;
}

// Text preprocessing utilities
export class ContentProcessor {
  
  /**
   * Clean and normalize text content
   */
  static cleanText(text: string): string {
    if (!text) return '';
    
    return text
      .trim()
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .replace(/[^\w\s\-.,!?()]/g, '') // Remove special characters except basic punctuation
      .trim();
  }
  
  /**
   * Estimate token count (rough approximation)
   */
  static estimateTokenCount(text: string): number {
    if (!text) return 0;
    
    // Rough approximation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }
  
  /**
   * Truncate text to fit within token limit
   */
  static truncateToTokenLimit(text: string, maxTokens: number = OPENAI_CONFIG.maxTokens): string {
    if (!text) return '';
    
    const estimatedTokens = this.estimateTokenCount(text);
    
    if (estimatedTokens <= maxTokens) {
      return text;
    }
    
    // Truncate to approximately the right length
    const targetLength = Math.floor((maxTokens * 4) * 0.9); // 90% of limit for safety
    const truncated = text.substring(0, targetLength);
    
    // Try to end at a word boundary
    const lastSpaceIndex = truncated.lastIndexOf(' ');
    if (lastSpaceIndex > targetLength * 0.8) {
      return truncated.substring(0, lastSpaceIndex) + '...';
    }
    
    return truncated + '...';
  }
  
  /**
   * Process menu item content
   */
  static processMenuItem(data: MenuItemData): ProcessedContent {
    const parts: string[] = [];
    
    // Add name
    if (data.name) {
      parts.push(data.name);
    }
    
    // Add description
    if (data.description) {
      parts.push(data.description);
    }
    
    // Add category
    if (data.category) {
      parts.push(`Category: ${data.category}`);
    }
    
    // Add price
    if (data.price !== undefined && data.price !== null) {
      parts.push(`Price: $${data.price.toFixed(2)}`);
    }
    
    // Add allergens
    if (data.allergens && data.allergens.length > 0) {
      parts.push(`Allergens: ${data.allergens.join(', ')}`);
    }
    
    // Add calories
    if (data.calories) {
      parts.push(`Calories: ${data.calories}`);
    }
    
    // Add prep time
    if (data.prepTime) {
      parts.push(`Prep time: ${data.prepTime} minutes`);
    }
    
    const text = parts.join(' - ');
    const cleanedText = this.cleanText(text);
    const finalText = this.truncateToTokenLimit(cleanedText);
    
    return {
      text: finalText,
      metadata: {
        type: 'menu_item',
        name: data.name,
        category: data.category,
        price: data.price,
        allergens: data.allergens,
        calories: data.calories,
        prepTime: data.prepTime,
        originalLength: text.length,
        processedLength: finalText.length
      },
      tokenCount: this.estimateTokenCount(finalText)
    };
  }
  
  /**
   * Process policy content
   */
  static processPolicy(data: PolicyData): ProcessedContent {
    const parts: string[] = [];
    
    // Add title
    if (data.title) {
      parts.push(data.title);
    }
    
    // Add content
    if (data.content) {
      parts.push(data.content);
    }
    
    // Add type
    if (data.type) {
      parts.push(`Type: ${data.type}`);
    }
    
    // Add effective date
    if (data.effectiveDate) {
      parts.push(`Effective: ${data.effectiveDate.toISOString().split('T')[0]}`);
    }
    
    const text = parts.join(' - ');
    const cleanedText = this.cleanText(text);
    const finalText = this.truncateToTokenLimit(cleanedText);
    
    return {
      text: finalText,
      metadata: {
        type: 'policy',
        title: data.title,
        policyType: data.type,
        effectiveDate: data.effectiveDate,
        originalLength: text.length,
        processedLength: finalText.length
      },
      tokenCount: this.estimateTokenCount(finalText)
    };
  }
  
  /**
   * Process FAQ content
   */
  static processFAQ(data: FAQData): ProcessedContent {
    const parts: string[] = [];
    
    // Add question
    if (data.question) {
      parts.push(`Question: ${data.question}`);
    }
    
    // Add answer
    if (data.answer) {
      parts.push(`Answer: ${data.answer}`);
    }
    
    // Add category
    if (data.category) {
      parts.push(`Category: ${data.category}`);
    }
    
    // Add tags
    if (data.tags && data.tags.length > 0) {
      parts.push(`Tags: ${data.tags.join(', ')}`);
    }
    
    const text = parts.join(' - ');
    const cleanedText = this.cleanText(text);
    const finalText = this.truncateToTokenLimit(cleanedText);
    
    return {
      text: finalText,
      metadata: {
        type: 'faq',
        question: data.question,
        answer: data.answer,
        category: data.category,
        tags: data.tags,
        originalLength: text.length,
        processedLength: finalText.length
      },
      tokenCount: this.estimateTokenCount(finalText)
    };
  }
  
  /**
   * Process business content
   */
  static processBusiness(data: BusinessData): ProcessedContent {
    const parts: string[] = [];
    
    // Add name
    if (data.name) {
      parts.push(data.name);
    }
    
    // Add description
    if (data.description) {
      parts.push(data.description);
    }
    
    // Add cuisine type
    if (data.cuisineType) {
      parts.push(`Cuisine: ${data.cuisineType}`);
    }
    
    // Add location
    if (data.location) {
      parts.push(`Location: ${data.location}`);
    }
    
    // Add industry
    if (data.industry) {
      parts.push(`Industry: ${data.industry}`);
    }
    
    const text = parts.join(' - ');
    const cleanedText = this.cleanText(text);
    const finalText = this.truncateToTokenLimit(cleanedText);
    
    return {
      text: finalText,
      metadata: {
        type: 'business',
        name: data.name,
        description: data.description,
        cuisineType: data.cuisineType,
        location: data.location,
        industry: data.industry,
        originalLength: text.length,
        processedLength: finalText.length
      },
      tokenCount: this.estimateTokenCount(finalText)
    };
  }
  
  /**
   * Process content based on type
   */
  static processContent(
    contentType: EmbeddingType,
    data: MenuItemData | PolicyData | FAQData | BusinessData
  ): ProcessedContent {
    switch (contentType) {
      case 'MENU':
        return this.processMenuItem(data as MenuItemData);
      case 'POLICY':
        return this.processPolicy(data as PolicyData);
      case 'FAQ':
        return this.processFAQ(data as FAQData);
      case 'BUSINESS':
        return this.processBusiness(data as BusinessData);
      default:
        throw new Error(`Unsupported content type: ${contentType}`);
    }
  }
  
  /**
   * Validate content before processing
   */
  static validateContent(contentType: EmbeddingType, data: any): boolean {
    switch (contentType) {
      case 'MENU':
        return !!(data as MenuItemData).name;
      case 'POLICY':
        return !!(data as PolicyData).title && !!(data as PolicyData).content;
      case 'FAQ':
        return !!(data as FAQData).question && !!(data as FAQData).answer;
      case 'BUSINESS':
        return !!(data as BusinessData).name;
      default:
        return false;
    }
  }
  
  /**
   * Extract key information for similarity search
   */
  static extractSearchableContent(contentType: EmbeddingType, data: any): string {
    switch (contentType) {
      case 'MENU':
        const menuData = data as MenuItemData;
        return [menuData.name, menuData.description, menuData.category].filter(Boolean).join(' ');
      case 'POLICY':
        const policyData = data as PolicyData;
        return [policyData.title, policyData.content, policyData.type].filter(Boolean).join(' ');
      case 'FAQ':
        const faqData = data as FAQData;
        return [faqData.question, faqData.answer, faqData.category].filter(Boolean).join(' ');
      case 'BUSINESS':
        const businessData = data as BusinessData;
        return [businessData.name, businessData.description, businessData.cuisineType].filter(Boolean).join(' ');
      default:
        return '';
    }
  }
}

