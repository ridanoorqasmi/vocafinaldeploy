// ===== RESPONSE TEMPLATE ENGINE =====

import { PrismaClient } from '@prisma/client';
import {
  ResponseTemplate,
  TemplateCategory,
  TemplateCondition,
  TemplateVariable,
  TemplateTestScenario,
  TemplateTestResult
} from './business-rules-types';

export class ResponseTemplateEngine {
  private prisma: PrismaClient;
  private templateCache: Map<string, ResponseTemplate[]> = new Map();
  private cacheExpiry: Map<string, Date> = new Map();
  private readonly CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Get the best matching template for a given context
   */
  async getBestTemplate(
    businessId: string,
    category: TemplateCategory,
    context: Record<string, any>
  ): Promise<ResponseTemplate | null> {
    try {
      // Get templates for the business and category
      const templates = await this.getTemplates(businessId, category);
      
      if (templates.length === 0) {
        return null;
      }

      // Find templates that match the context
      const matchingTemplates = templates.filter(template => 
        this.templateMatchesContext(template, context)
      );

      if (matchingTemplates.length === 0) {
        // Return the most successful template as fallback
        return templates.sort((a, b) => b.success_rate - a.success_rate)[0];
      }

      // Sort by success rate and usage count
      matchingTemplates.sort((a, b) => {
        const scoreA = a.success_rate * 0.7 + (a.usage_count / 1000) * 0.3;
        const scoreB = b.success_rate * 0.7 + (b.usage_count / 1000) * 0.3;
        return scoreB - scoreA;
      });

      return matchingTemplates[0];
    } catch (error) {
      console.error('Error getting best template:', error);
      return null;
    }
  }

  /**
   * Render a template with variables
   */
  async renderTemplate(
    template: ResponseTemplate,
    variables: Record<string, any>,
    businessContext?: Record<string, any>
  ): Promise<string> {
    try {
      let renderedContent = template.content;

      // Replace template variables
      for (const variable of template.variables) {
        const value = this.getVariableValue(variable, variables, businessContext);
        const placeholder = `{${variable.name}}`;
        
        if (value !== undefined && value !== null) {
          renderedContent = renderedContent.replace(new RegExp(placeholder, 'g'), String(value));
        } else if (variable.required) {
          console.warn(`Required variable ${variable.name} not provided for template ${template.template_id}`);
          renderedContent = renderedContent.replace(new RegExp(placeholder, 'g'), variable.default_value || '[MISSING]');
        } else {
          renderedContent = renderedContent.replace(new RegExp(placeholder, 'g'), variable.default_value || '');
        }
      }

      // Update usage statistics
      await this.updateTemplateUsage(template.template_id);

      return renderedContent;
    } catch (error) {
      console.error('Error rendering template:', error);
      return template.content; // Return original content as fallback
    }
  }

  /**
   * Create a new response template
   */
  async createTemplate(template: Omit<ResponseTemplate, 'template_id' | 'created_at' | 'updated_at' | 'usage_count' | 'success_rate'>): Promise<ResponseTemplate> {
    // Validate template
    const validation = await this.validateTemplate(template);
    if (!validation.valid) {
      throw new Error(`Template validation failed: ${validation.errors.join(', ')}`);
    }

    const newTemplate: ResponseTemplate = {
      ...template,
      template_id: this.generateTemplateId(),
      created_at: new Date(),
      updated_at: new Date(),
      usage_count: 0,
      success_rate: 1.0
    };

    // Save to database
    await this.saveTemplate(newTemplate);
    
    // Invalidate cache
    this.invalidateCache(template.business_id);
    
    return newTemplate;
  }

  /**
   * Test a template against scenarios
   */
  async testTemplate(template: ResponseTemplate, scenarios: TemplateTestScenario[]): Promise<TemplateTestResult[]> {
    const results: TemplateTestResult[] = [];

    for (const scenario of scenarios) {
      const startTime = Date.now();
      
      try {
        // Render template with scenario variables
        const renderedOutput = await this.renderTemplate(template, scenario.variables, scenario.input_context);
        
        // Validate variables
        const variableErrors = this.validateTemplateVariables(template, scenario.variables);
        
        const result: TemplateTestResult = {
          scenario_name: scenario.scenario_name,
          passed: renderedOutput === scenario.expected_output && variableErrors.length === 0,
          actual_output: renderedOutput,
          execution_time_ms: Date.now() - startTime,
          variable_errors: variableErrors
        };

        results.push(result);
      } catch (error) {
        results.push({
          scenario_name: scenario.scenario_name,
          passed: false,
          actual_output: '',
          execution_time_ms: Date.now() - startTime,
          variable_errors: [error instanceof Error ? error.message : 'Unknown error']
        });
      }
    }

    return results;
  }

  /**
   * Get templates for a business and category
   */
  private async getTemplates(businessId: string, category: TemplateCategory): Promise<ResponseTemplate[]> {
    const cacheKey = `templates_${businessId}_${category}`;
    const cachedTemplates = this.templateCache.get(cacheKey);
    const cacheExpiry = this.cacheExpiry.get(cacheKey);
    
    if (cachedTemplates && cacheExpiry && new Date() < cacheExpiry) {
      return cachedTemplates;
    }

    // Fetch from database
    const templates = await this.fetchTemplatesFromDatabase(businessId, category);
    
    // Cache the results
    this.templateCache.set(cacheKey, templates);
    this.cacheExpiry.set(cacheKey, new Date(Date.now() + this.CACHE_TTL_MS));
    
    return templates;
  }

  /**
   * Check if template matches the given context
   */
  private templateMatchesContext(template: ResponseTemplate, context: Record<string, any>): boolean {
    if (!template.conditions || template.conditions.length === 0) {
      return true; // No conditions means always match
    }

    // All conditions must match
    return template.conditions.every(condition => 
      this.evaluateTemplateCondition(condition, context)
    );
  }

  /**
   * Evaluate a template condition
   */
  private evaluateTemplateCondition(condition: TemplateCondition, context: Record<string, any>): boolean {
    const fieldValue = this.getFieldValue(condition.field, context);
    
    if (fieldValue === undefined || fieldValue === null) {
      return false;
    }

    const conditionValue = condition.value;
    const isCaseSensitive = condition.case_sensitive ?? true;

    switch (condition.operator) {
      case 'equals':
        return isCaseSensitive ? fieldValue === conditionValue : 
               String(fieldValue).toLowerCase() === String(conditionValue).toLowerCase();
      
      case 'contains':
        return isCaseSensitive ? String(fieldValue).includes(String(conditionValue)) :
               String(fieldValue).toLowerCase().includes(String(conditionValue).toLowerCase());
      
      case 'starts_with':
        return isCaseSensitive ? String(fieldValue).startsWith(String(conditionValue)) :
               String(fieldValue).toLowerCase().startsWith(String(conditionValue).toLowerCase());
      
      case 'ends_with':
        return isCaseSensitive ? String(fieldValue).endsWith(String(conditionValue)) :
               String(fieldValue).toLowerCase().endsWith(String(conditionValue).toLowerCase());
      
      case 'regex':
        const regex = new RegExp(String(conditionValue), isCaseSensitive ? '' : 'i');
        return regex.test(String(fieldValue));
      
      case 'greater_than':
        return Number(fieldValue) > Number(conditionValue);
      
      case 'less_than':
        return Number(fieldValue) < Number(conditionValue);
      
      default:
        return false;
    }
  }

  /**
   * Get field value from context using dot notation
   */
  private getFieldValue(field: string, context: Record<string, any>): any {
    const parts = field.split('.');
    let value: any = context;
    
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  /**
   * Get variable value from variables or business context
   */
  private getVariableValue(
    variable: TemplateVariable,
    variables: Record<string, any>,
    businessContext?: Record<string, any>
  ): any {
    // First check if variable is provided directly
    if (variables[variable.name] !== undefined) {
      return variables[variable.name];
    }

    // Then check business context based on variable type
    switch (variable.type) {
      case 'business_var':
        return businessContext?.[variable.name];
      
      case 'temporal_var':
        return this.getTemporalVariable(variable.name);
      
      case 'customer_var':
        return variables[`customer_${variable.name}`] || variables[variable.name];
      
      case 'context_var':
        return variables[`context_${variable.name}`] || variables[variable.name];
      
      case 'dynamic_var':
        return businessContext?.[`dynamic_${variable.name}`] || variables[variable.name];
      
      default:
        return undefined;
    }
  }

  /**
   * Get temporal variables (time-based)
   */
  private getTemporalVariable(variableName: string): any {
    const now = new Date();
    
    switch (variableName) {
      case 'current_time':
        return now.toLocaleTimeString();
      
      case 'current_date':
        return now.toLocaleDateString();
      
      case 'current_day':
        return now.toLocaleDateString('en-US', { weekday: 'long' });
      
      case 'next_open':
        // This would be calculated based on business hours
        return '9:00 AM';
      
      case 'days_until_weekend':
        const daysUntilWeekend = (6 - now.getDay()) % 7;
        return daysUntilWeekend === 0 ? 0 : daysUntilWeekend;
      
      default:
        return undefined;
    }
  }

  /**
   * Validate template variables
   */
  private validateTemplateVariables(template: ResponseTemplate, variables: Record<string, any>): string[] {
    const errors: string[] = [];

    for (const variable of template.variables) {
      const value = variables[variable.name];
      
      if (variable.required && (value === undefined || value === null || value === '')) {
        errors.push(`Required variable ${variable.name} is missing or empty`);
      }
      
      if (value !== undefined && variable.validation_regex) {
        const regex = new RegExp(variable.validation_regex);
        if (!regex.test(String(value))) {
          errors.push(`Variable ${variable.name} does not match validation pattern`);
        }
      }
    }

    return errors;
  }

  /**
   * Validate a template
   */
  private async validateTemplate(template: ResponseTemplate): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Basic validation
    if (!template.business_id) errors.push('Business ID is required');
    if (!template.name) errors.push('Template name is required');
    if (!template.category) errors.push('Category is required');
    if (!template.content) errors.push('Content is required');

    // Validate variables in content
    const variableMatches = template.content.match(/\{([^}]+)\}/g);
    if (variableMatches) {
      const contentVariables = variableMatches.map(match => match.slice(1, -1));
      const definedVariables = template.variables.map(v => v.name);
      
      for (const contentVar of contentVariables) {
        if (!definedVariables.includes(contentVar)) {
          errors.push(`Variable {${contentVar}} used in content but not defined in variables`);
        }
      }
    }

    // Validate conditions
    for (const condition of template.conditions) {
      if (!condition.field) errors.push('Condition field is required');
      if (!condition.operator) errors.push('Condition operator is required');
      if (condition.value === undefined || condition.value === null) errors.push('Condition value is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Update template usage statistics
   */
  private async updateTemplateUsage(templateId: string): Promise<void> {
    // In a real implementation, this would update the database
    console.log(`Updating usage for template: ${templateId}`);
  }

  /**
   * Generate a unique template ID
   */
  private generateTemplateId(): string {
    return `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Save template to database (placeholder)
   */
  private async saveTemplate(template: ResponseTemplate): Promise<void> {
    // In a real implementation, this would use Prisma to save to database
    console.log('Saving template:', template.template_id);
  }

  /**
   * Fetch templates from database (placeholder)
   */
  private async fetchTemplatesFromDatabase(businessId: string, category: TemplateCategory): Promise<ResponseTemplate[]> {
    // In a real implementation, this would use Prisma to fetch from database
    // For now, return some sample templates
    return [
      {
        template_id: 'greeting_1',
        business_id: businessId,
        name: 'Welcome Greeting',
        category: 'greeting_templates',
        content: 'Welcome to {business_name}! How can I help you today?',
        conditions: [],
        variables: [
          { name: 'business_name', type: 'business_var', required: true }
        ],
        active: true,
        version: 1,
        created_at: new Date(),
        updated_at: new Date(),
        usage_count: 0,
        success_rate: 1.0
      }
    ];
  }

  /**
   * Invalidate cache for a business
   */
  private invalidateCache(businessId: string): void {
    const categories: TemplateCategory[] = ['greeting_templates', 'information_templates', 'escalation_templates', 'fallback_templates'];
    
    for (const category of categories) {
      const cacheKey = `templates_${businessId}_${category}`;
      this.templateCache.delete(cacheKey);
      this.cacheExpiry.delete(cacheKey);
    }
  }
}

// Singleton instance
let responseTemplateEngine: ResponseTemplateEngine | null = null;

export function getResponseTemplateEngine(prisma?: PrismaClient): ResponseTemplateEngine {
  if (!responseTemplateEngine) {
    if (!prisma) {
      throw new Error('PrismaClient is required for first initialization');
    }
    responseTemplateEngine = new ResponseTemplateEngine(prisma);
  }
  return responseTemplateEngine;
}
