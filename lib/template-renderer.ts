import Handlebars from 'handlebars';

/**
 * Handlebars template renderer for follow-up messages
 */
export class TemplateRenderer {
  private static instance: TemplateRenderer | null = null;
  private handlebars: typeof Handlebars;

  private constructor() {
    this.handlebars = Handlebars.create();
    this.registerHelpers();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): TemplateRenderer {
    if (!TemplateRenderer.instance) {
      TemplateRenderer.instance = new TemplateRenderer();
    }
    return TemplateRenderer.instance;
  }

  /**
   * Register safe Handlebars helpers
   */
  private registerHelpers(): void {
    // Uppercase helper
    this.handlebars.registerHelper('uppercase', (str: string) => {
      return typeof str === 'string' ? str.toUpperCase() : str;
    });

    // Lowercase helper
    this.handlebars.registerHelper('lowercase', (str: string) => {
      return typeof str === 'string' ? str.toLowerCase() : str;
    });

    // Fallback helper - returns fallback if value is empty/null/undefined
    this.handlebars.registerHelper('fallback', (value: any, fallback: string) => {
      if (value === null || value === undefined || value === '') {
        return fallback;
      }
      return value;
    });

    // Format date helper
    this.handlebars.registerHelper('formatDate', (date: any, format: string = 'YYYY-MM-DD') => {
      if (!date) return '';
      
      try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        
        // Simple date formatting
        if (format === 'YYYY-MM-DD') {
          return d.toISOString().split('T')[0];
        } else if (format === 'MM/DD/YYYY') {
          return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}/${d.getFullYear()}`;
        } else if (format === 'DD/MM/YYYY') {
          return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
        }
        
        return d.toLocaleDateString();
      } catch (error) {
        return '';
      }
    });

    // Truncate helper
    this.handlebars.registerHelper('truncate', (str: string, length: number = 50) => {
      if (typeof str !== 'string') return str;
      if (str.length <= length) return str;
      return str.substring(0, length) + '...';
    });

    // Default helper for missing values
    this.handlebars.registerHelper('default', (value: any, defaultValue: string) => {
      return value || defaultValue;
    });
  }

  /**
   * Render template with data
   */
  render(template: string, data: Record<string, any>): string {
    try {
      const compiledTemplate = this.handlebars.compile(template);
      return compiledTemplate(data);
    } catch (error) {
      console.error('Template rendering error:', error);
      // Return original template if rendering fails
      return template;
    }
  }

  /**
   * Validate template syntax
   */
  validate(template: string): { valid: boolean; error?: string } {
    try {
      this.handlebars.compile(template);
      return { valid: true };
    } catch (error) {
      return { 
        valid: false, 
        error: error instanceof Error ? error.message : 'Unknown template error' 
      };
    }
  }

  /**
   * Get list of variables used in template
   */
  getVariables(template: string): string[] {
    try {
      const ast = this.handlebars.parse(template);
      const variables = new Set<string>();
      
      const extractVariables = (node: any) => {
        if (node.type === 'PathExpression') {
          variables.add(node.original);
        }
        if (node.body) {
          node.body.forEach(extractVariables);
        }
        if (node.params) {
          node.params.forEach(extractVariables);
        }
        if (node.hash && node.hash.pairs) {
          node.hash.pairs.forEach((pair: any) => {
            extractVariables(pair.value);
          });
        }
      };
      
      extractVariables(ast);
      return Array.from(variables);
    } catch (error) {
      console.error('Error extracting template variables:', error);
      return [];
    }
  }
}

/**
 * Convenience function to render template
 */
export function renderTemplate(template: string, data: Record<string, any>): string {
  return TemplateRenderer.getInstance().render(template, data);
}

/**
 * Convenience function to validate template
 */
export function validateTemplate(template: string): { valid: boolean; error?: string } {
  return TemplateRenderer.getInstance().validate(template);
}

/**
 * Convenience function to get template variables
 */
export function getTemplateVariables(template: string): string[] {
  return TemplateRenderer.getInstance().getVariables(template);
}

