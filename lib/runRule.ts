import { PrismaClient } from '@prisma/client';
import { createConnector } from './db-connectors/factory';
import { decrypt } from './encryption';
import { emailService } from './email-service';
import { renderTemplate } from './template-renderer';
import crypto from 'crypto';

const prisma = new PrismaClient();

export interface RuleCondition {
  all?: RuleCondition[];
  any?: RuleCondition[];
  equals?: { field: string; value: any };
  olderThanDays?: { field: string; days: number };
}

export interface RuleAction {
  channel: 'email' | 'sms' | 'whatsapp' | 'dashboard';
  templateId?: string;
  subject?: string;
  content?: string;
  messageTemplate?: string; // Sprint 3: Handlebars template
  senderEmail?: string; // Sender email address for email channel
}

export interface RunRuleResult {
  matched: number;
  sent: number;
  failed: number;
  errors?: string[];
}

export interface DryRunResult {
  matched: number;
  samples: any[];
  errors?: string[];
}

/**
 * Core rule execution engine
 */
export class RuleEngine {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Execute a rule (dry run or actual execution)
   * Sprint 3: Maintains exact signature for backward compatibility
   */
  async runRule(ruleId: string, dryRun: boolean = false): Promise<RunRuleResult | DryRunResult> {
    try {
      // Load rule with mapping and connection
      const rule = await this.prisma.rule.findUnique({
        where: { id: ruleId },
        include: {
          mapping: {
            include: {
              connection: true
            }
          }
        }
      });

      if (!rule) {
        throw new Error(`Rule ${ruleId} not found`);
      }

      if (!rule.mapping) {
        throw new Error(`Mapping not found for rule ${ruleId}`);
      }

      if (!rule.mapping.connection) {
        throw new Error(`Connection not found for mapping ${rule.mapping.id}`);
      }

      // Get database connector
      const connector = createConnector(
        rule.mapping.connection.type,
        {
          host: rule.mapping.connection.host,
          port: rule.mapping.connection.port || undefined,
          database: rule.mapping.connection.database,
          username: rule.mapping.connection.username,
          password: decrypt(rule.mapping.connection.password),
          config: rule.mapping.connection.config as any
        }
      );

      // Test connection
      const isConnected = await connector.testConnection();
      if (!isConnected) {
        throw new Error(`Cannot connect to database for rule ${ruleId}`);
      }

      // Translate condition to database query
      const whereClause = this.translateConditionToWhere(
        rule.condition as RuleCondition,
        rule.mapping.fields as any
      );

      // ========================================
      // DEBUG: Comprehensive Rule Execution Analysis
      // ========================================
      console.log('\n========== [RuleEngine] DEBUG: Rule Execution Analysis ==========');
      console.log(`[RuleEngine] Rule Name: "${rule.name}"`);
      console.log(`[RuleEngine] Rule ID: ${ruleId}`);
      console.log(`[RuleEngine] Rule Active: ${rule.active}`);
      console.log(`[RuleEngine] Resource/Table: "${rule.mapping.resource}"`);
      console.log(`[RuleEngine] Database Type: ${rule.mapping.connection?.type || 'N/A'}`);
      console.log('\n[RuleEngine] Original Condition (from rule):');
      console.log(JSON.stringify(rule.condition, null, 2));
      console.log('\n[RuleEngine] Field Mapping (canonical -> actual):');
      console.log(JSON.stringify(rule.mapping.fields, null, 2));
      console.log('\n[RuleEngine] Generated Where Clause (for database query):');
      console.log(JSON.stringify(whereClause, null, 2));
      
      // Analyze condition field mapping
      console.log('\n[RuleEngine] Field Mapping Analysis:');
      if (rule.condition) {
        this.analyzeConditionFields(rule.condition as RuleCondition, rule.mapping.fields as any);
      }
      console.log('===============================================================\n');

      // Execute query
      const results = await connector.query(rule.mapping.resource, whereClause, 20);
      
      console.log('\n[RuleEngine] Query Execution Results:');
      console.log(`  → Records matched: ${results.length}`);
      
      // If no results, provide debugging suggestions
      if (results.length === 0) {
        console.log('\n⚠️  [DEBUG] NO RECORDS MATCHED - Possible Issues:');
        console.log('  1. Field name mismatch: Check if condition field names match actual database columns');
        console.log('  2. Value mismatch: Check if condition values match actual data (case-sensitive for strings)');
        console.log('  3. Date comparison: Check if dates in database are actually older than threshold');
        console.log('  4. Data types: Ensure condition values match database column types');
        console.log('  5. Check the generated SQL query above to see exact WHERE clause being used');
        
        // Sample first few records to help debug
        try {
          const sampleQuery = await connector.query(rule.mapping.resource, {}, 5);
          if (sampleQuery.length > 0) {
            console.log('\n  [DEBUG] Sample records from table (first 5):');
            sampleQuery.forEach((record, idx) => {
              console.log(`    Record ${idx + 1}:`, JSON.stringify(record, null, 2));
            });
            console.log('  → Compare these sample records with your condition criteria above');
          }
        } catch (err) {
          console.log('  → Could not fetch sample records for debugging');
        }
      } else {
        console.log(`  → Sample of matched records (showing first 3):`);
        results.slice(0, 3).forEach((record, idx) => {
          console.log(`    Record ${idx + 1}:`, JSON.stringify(record, null, 2));
        });
      }
      console.log('');

      if (dryRun) {
        return {
          matched: results.length,
          samples: results.slice(0, 10), // Return up to 10 samples
          errors: []
        };
      }

      // Execute actions for each result
      let sent = 0;
      let failed = 0;
      const errors: string[] = [];

      console.log(`[RuleEngine] Processing ${results.length} matching records for rule ${rule.name}`);

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        try {
          console.log(`[RuleEngine] Processing record ${i + 1}/${results.length}: ${result.id || JSON.stringify(result).substring(0, 50)}`);
          
          const success = await this.executeAction(
            rule,
            result,
            rule.action as RuleAction
          );
          
          if (success) {
            sent++;
            console.log(`[RuleEngine] ✅ Successfully processed record ${i + 1}/${results.length} (email sent)`);
          } else {
            failed++;
            console.log(`[RuleEngine] ❌ Failed to process record ${i + 1}/${results.length}`);
            // Note: Detailed error already logged in executeAction/executeEmailAction
          }
        } catch (error) {
          failed++;
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Failed to execute action for entity ${result.id || 'unknown'}: ${errorMsg}`);
          console.error(`[RuleEngine] Error processing record ${i + 1}/${results.length}:`, errorMsg);
        }

        // Sprint 3: Rate limiting - 1 second delay between send attempts
        // Skip delay for last item
        if (i < results.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`[RuleEngine] Rule execution complete: ${sent} sent, ${failed} failed out of ${results.length} matched`);

      return {
        matched: results.length,
        sent,
        failed,
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error) {
      console.error('Error running rule:', error);
      throw error;
    }
  }

  /**
   * Translate rule condition to database where clause
   */
  private translateConditionToWhere(condition: RuleCondition, fieldMapping: any): any {
    if (condition.all) {
      return {
        AND: condition.all.map(subCondition => 
          this.translateConditionToWhere(subCondition, fieldMapping)
        )
      };
    }

    if (condition.any) {
      return {
        OR: condition.any.map(subCondition => 
          this.translateConditionToWhere(subCondition, fieldMapping)
        )
      };
    }

    if (condition.equals) {
      const actualField = this.getActualFieldName(condition.equals.field, fieldMapping);
      return {
        [actualField]: condition.equals.value
      };
    }

    if (condition.olderThanDays) {
      const actualField = this.getActualFieldName(condition.olderThanDays.field, fieldMapping);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - condition.olderThanDays.days);
      
      return {
        [actualField]: {
          lt: cutoffDate
        }
      };
    }

    throw new Error('Invalid condition structure');
  }

  /**
   * Analyze condition fields to debug mapping issues
   * This helps identify why conditions might not match records
   */
  private analyzeConditionFields(condition: RuleCondition, fieldMapping: any): void {
    // Analyze equals conditions
    if (condition.equals) {
      const originalField = condition.equals.field;
      const actualField = this.getActualFieldName(originalField, fieldMapping);
      const value = condition.equals.value;
      
      console.log(`  [EQUALS] Condition field: "${originalField}"`);
      console.log(`    → Mapped to actual column: "${actualField}"`);
      console.log(`    → Value to match: "${value}"`);
      console.log(`    → Mapping check: ${fieldMapping[originalField] ? `Found in mapping as "${fieldMapping[originalField]}"` : 'NOT in mapping - using field as-is'}`);
      
      // Check if field exists as actual value in mapping
      const actualFieldValues = Object.values(fieldMapping || {}) as string[];
      const isActualField = actualFieldValues.some(val => val && val.toLowerCase() === originalField.toLowerCase());
      if (isActualField) {
        console.log(`    → Note: Field "${originalField}" appears to be an actual column name (exists as value in mapping)`);
      }
    }
    
    // Analyze olderThanDays conditions
    if (condition.olderThanDays) {
      const originalField = condition.olderThanDays.field;
      const actualField = this.getActualFieldName(originalField, fieldMapping);
      const days = condition.olderThanDays.days;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      console.log(`  [OLDER_THAN_DAYS] Condition field: "${originalField}"`);
      console.log(`    → Mapped to actual column: "${actualField}"`);
      console.log(`    → Days threshold: ${days}`);
      console.log(`    → Cutoff date: ${cutoffDate.toISOString()} (records older than this will match)`);
      console.log(`    → Mapping check: ${fieldMapping[originalField] ? `Found in mapping as "${fieldMapping[originalField]}"` : 'NOT in mapping - using field as-is'}`);
    }
    
    // Recursively analyze nested conditions
    if (condition.all && Array.isArray(condition.all)) {
      console.log(`  [AND] Analyzing ${condition.all.length} nested conditions:`);
      condition.all.forEach((subCondition, index) => {
        console.log(`    Condition ${index + 1}:`);
        this.analyzeConditionFields(subCondition, fieldMapping);
      });
    }
    
    if (condition.any && Array.isArray(condition.any)) {
      console.log(`  [OR] Analyzing ${condition.any.length} nested conditions:`);
      condition.any.forEach((subCondition, index) => {
        console.log(`    Condition ${index + 1}:`);
        this.analyzeConditionFields(subCondition, fieldMapping);
      });
    }
  }

  /**
   * Get actual field name from canonical field name
   * Handles both canonical field names (e.g., "status") and actual field names (e.g., "replyStatus", "Status")
   * Also handles case-insensitive matching for database columns
   * 
   * DEBUG NOTES:
   * - This function tries to map condition field names to actual database column names
   * - If condition uses "status" but mapping has { status: "replyStatus" }, it returns "replyStatus"
   * - If condition uses "replyStatus" (actual column) and it's in mapping values, it returns "replyStatus"
   * - If no mapping found, it returns the field as-is (assumes it's already the actual column name)
   */
  private getActualFieldName(canonicalField: string, fieldMapping: any): string {
    if (!fieldMapping || typeof fieldMapping !== 'object') {
      return canonicalField;
    }

    // Normalize the input field name to lowercase for comparison
    const normalizedInput = canonicalField.toLowerCase();

    // First, check if the field is already an actual field name
    // (i.e., it exists as a value in the fieldMapping) - case-insensitive
    const actualFieldValues = Object.values(fieldMapping) as string[];
    const exactMatch = actualFieldValues.find(val => 
      val && val.toLowerCase() === normalizedInput
    );
    if (exactMatch) {
      // Field is already an actual column name, use it directly (preserve original case)
      return exactMatch;
    }

    // If fieldMapping is a simple object with canonical -> actual mapping
    // e.g., { status: "replyStatus", date: "created_at" } or { status: "status", date: "created_at" }
    // Check both exact match and case-insensitive match
    for (const [canonicalKey, actualValue] of Object.entries(fieldMapping)) {
      if (canonicalKey.toLowerCase() === normalizedInput) {
        // Found matching canonical field, return its mapped actual value
        return actualValue as string;
      }
    }

    // If fieldMapping is an array of objects with canonical and actual fields
    if (Array.isArray(fieldMapping)) {
      const mapping = fieldMapping.find((m: any) => 
        m.canonical && m.canonical.toLowerCase() === normalizedInput
      );
      if (mapping) {
        return mapping.actual;
      }
    }

    // Fallback: return the field as-is (might be actual field name that's not in mapping)
    // This handles edge cases where field names don't match mapping exactly
    return canonicalField;
  }

  /**
   * Execute action for a single entity
   * Sprint 3: Enhanced with dedupeKey and rate limiting
   */
  private async executeAction(rule: any, entity: any, action: RuleAction): Promise<boolean> {
    try {
      // Resolve contact via mapping's contactField
      const contact = this.resolveContact(entity, rule.mapping.fields as any);
      if (!contact) {
        console.log(`Skipping entity ${entity.id || 'unknown'} - no contact found`);
        return false;
      }

      // Generate dedupeKey as specified: "{ruleId}:{contact}:{yyyy-mm-dd in UTC}"
      const utcDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD in UTC
      const dedupeKey = `${rule.id}:${contact}:${utcDate}`;

      // Check for existing delivery with same dedupeKey where status is SENT
      // Only skip if already successfully sent - allow retries for failed/pending deliveries
      const existingDelivery = await this.prisma.delivery.findFirst({
        where: { 
          dedupeKey,
          status: 'sent' // Only skip if successfully sent
        }
      });

      if (existingDelivery) {
        console.log(`Skipping duplicate delivery for dedupeKey: ${dedupeKey} (already sent successfully)`);
        return false;
      }

      // Generate legacy idempotency key for backward compatibility
      const idempotencyKey = this.generateIdempotencyKey(
        rule.id,
        contact,
        utcDate
      );

      // Execute based on channel
      switch (action.channel) {
        case 'email':
          return await this.executeEmailAction(rule, entity, action, idempotencyKey);
        
        case 'sms':
        case 'whatsapp':
          // Placeholder for future SMS/WhatsApp implementation
          console.log(`SMS/WhatsApp delivery not yet implemented for ${action.channel}`);
          return false;
        
        case 'dashboard':
          // Dashboard notification - just log for now
          console.log(`Dashboard notification for entity:`, entity);
          return true;
        
        default:
          throw new Error(`Unsupported channel: ${action.channel}`);
      }

    } catch (error) {
      console.error('Error executing action:', error);
      return false;
    }
  }

  /**
   * Resolve contact from entity using mapping fields
   * 
   * DEBUG ANALYSIS:
   * - First tries to use the contact field from mapping (e.g., mapping.contact = "email")
   * - Then falls back to common field names if mapping doesn't work
   * - Returns null if no contact found, which causes executeAction to skip the entity
   */
  private resolveContact(entity: any, fieldMapping: any): string | null {
    console.log('[RuleEngine] Resolving contact from entity...');
    console.log('  → Field Mapping:', JSON.stringify(fieldMapping, null, 2));
    console.log('  → Entity keys:', Object.keys(entity));
    
    // Try to get contact field from mapping
    const contactField = fieldMapping.contact || fieldMapping.email;
    console.log(`  → Contact field from mapping: "${contactField}"`);
    
    if (contactField) {
      console.log(`  → Checking entity["${contactField}"]:`, entity[contactField] ? `"${entity[contactField]}"` : 'NOT FOUND');
      if (entity[contactField]) {
        console.log(`  → ✅ Contact resolved: "${entity[contactField]}"`);
        return entity[contactField];
      }
    }

    // Fallback to common field names
    console.log('  → Mapping contact field not found, trying fallback fields...');
    const commonFields = ['email', 'contact', 'phone', 'mobile'];
    for (const field of commonFields) {
      if (entity[field]) {
        console.log(`  → ✅ Contact resolved via fallback "${field}": "${entity[field]}"`);
        return entity[field];
      }
    }

    console.log('  → ❌ No contact found in entity! Available fields:', Object.keys(entity));
    return null;
  }

  /**
   * Execute email action
   * Sprint 3: Enhanced with Handlebars rendering and proper status tracking
   * 
   * DEBUG ANALYSIS:
   * This function handles the actual email sending process:
   * 1. Resolves contact email from entity using field mapping
   * 2. Checks for duplicate deliveries (same rule + contact + day)
   * 3. Renders email template with entity data
   * 4. Creates delivery record (status: pending)
   * 5. Sends email via email service
   * 6. Updates delivery record (status: sent/failed)
   * 
   * Common failure points:
   * - Contact resolution fails (no email found in entity)
   * - Email service returns false (SMTP config issue)
   * - Template rendering throws error
   * - Database operations fail
   */
  private async executeEmailAction(rule: any, entity: any, action: RuleAction, idempotencyKey: string): Promise<boolean> {
    console.log('\n========== [RuleEngine] Email Action Execution ==========');
    console.log(`[RuleEngine] Entity ID: ${entity.id || entity.pk || 'unknown'}`);
    console.log(`[RuleEngine] Rule: ${rule.name} (${rule.id})`);
    
    try {
      // STEP 1: Resolve contact email
      console.log('\n[Step 1] Resolving contact email...');
      const contact = this.resolveContact(entity, rule.mapping.fields as any);
      if (!contact) {
        const errorMsg = `No contact found for entity ${entity.id || 'unknown'}`;
        console.error(`  → ❌ ${errorMsg}`);
        console.log('  → Entity data:', JSON.stringify(entity, null, 2));
        throw new Error(errorMsg);
      }
      console.log(`  → ✅ Contact email resolved: "${contact}"`);

      // STEP 2: Generate dedupeKey and check for duplicates
      const utcDate = new Date().toISOString().split('T')[0];
      const dedupeKey = `${rule.id}:${contact}:${utcDate}`;
      console.log(`\n[Step 2] Checking for duplicate deliveries...`);
      console.log(`  → DedupeKey: ${dedupeKey}`);
      
      // Only skip if already successfully sent - allow retries for failed/pending deliveries
      const existingDelivery = await this.prisma.delivery.findFirst({
        where: { 
          dedupeKey,
          status: 'sent' // Only skip if successfully sent
        }
      });

      if (existingDelivery) {
        console.log(`  → ⚠️  Duplicate found, skipping (already sent successfully today)`);
        return false;
      }
      
      // Check if there's a failed delivery that we can retry
      const failedDelivery = await this.prisma.delivery.findFirst({
        where: { 
          dedupeKey,
          status: 'failed'
        }
      });
      
      if (failedDelivery) {
        console.log(`  → ℹ️  Found previous failed delivery (ID: ${failedDelivery.id}), will retry...`);
      }
      
      console.log(`  → ✅ Proceeding with delivery...`);

      // STEP 3: Render email template
      console.log(`\n[Step 3] Rendering email template...`);
      let subject = action.subject || 'Follow-up';
      let content = action.content || 'This is a follow-up message.';
      console.log(`  → Original subject: "${subject}"`);
      console.log(`  → Original content length: ${content.length} chars`);

      try {
        // Sprint 3: Use Handlebars template if provided
        if (action.messageTemplate) {
          console.log(`  → Using Handlebars template (messageTemplate)`);
          content = renderTemplate(action.messageTemplate, entity);
          // Also render subject if it contains Handlebars syntax
          if (subject && (subject.includes('{{') || subject.includes('{{{'))) {
            subject = renderTemplate(subject, entity);
          } else if (subject) {
            // Fallback to simple variable replacement for legacy {field} syntax
            subject = this.renderSimpleTemplate(subject, entity);
          }
        } else if (action.templateId) {
          console.log(`  → Using template ID: ${action.templateId}`);
          const template = await this.getTemplate(action.templateId);
          if (template) {
            subject = template.subject || subject;
            content = await this.renderTemplate(template.content, entity);
          }
        } else {
          console.log(`  → Using legacy {field} template syntax`);
          subject = this.renderSimpleTemplate(subject, entity);
          content = this.renderSimpleTemplate(content, entity);
        }
        console.log(`  → ✅ Template rendered successfully`);
        console.log(`  → Rendered subject: "${subject}"`);
        console.log(`  → Rendered content preview: ${content.substring(0, 100)}...`);
      } catch (templateError) {
        console.error(`  → ❌ Template rendering failed:`, templateError);
        throw new Error(`Template rendering failed: ${templateError instanceof Error ? templateError.message : 'Unknown error'}`);
      }

      // STEP 4: Create or update delivery record
      console.log(`\n[Step 4] Creating/updating delivery record...`);
      // Convert entityPk to string (database expects String, but entity.id might be Int)
      const entityPk = String(entity.id || entity.pk || 'unknown');
      console.log(`  → Entity PK: ${entityPk} (type: ${typeof entityPk})`);
      console.log(`  → IdempotencyKey: ${idempotencyKey}`);
      
      // Use upsert to handle case where delivery record might already exist (from previous failed attempt)
      // This prevents unique constraint errors on idempotencyKey
      const delivery = await this.prisma.delivery.upsert({
        where: { idempotencyKey },
        update: {
          // If record exists, update it to pending status (retry scenario)
          status: 'pending',
          error: null,
          sentAt: null,
          updatedAt: new Date()
        },
        create: {
          ruleId: rule.id,
          entityPk: entityPk,
          contact: contact,
          channel: action.channel,
          status: 'pending',
          idempotencyKey,
          dedupeKey,
          error: null
        }
      });
      console.log(`  → ✅ Delivery record ${delivery.id} (status: ${delivery.status})`);

      // STEP 5: Send email
      console.log(`\n[Step 5] Sending email via email service...`);
      console.log(`  → To: ${contact}`);
      console.log(`  → From: ${action.senderEmail || 'default (system)'}`);
      console.log(`  → Subject: "${subject}"`);
      
      const emailOptions = {
        to: contact,
        subject,
        html: content,
        from: action.senderEmail // Use rule's sender email if provided
      };
      
      const success = await emailService.sendEmail(emailOptions);

      // STEP 6: Update delivery status
      console.log(`\n[Step 6] Updating delivery status...`);
      if (success) {
        console.log(`  → ✅ Email sent successfully!`);
        await this.prisma.delivery.update({
          where: { id: delivery.id },
          data: {
            status: 'sent',
            sentAt: new Date(),
            error: null
          }
        });
        console.log(`  → ✅ Delivery record updated to 'sent'`);
      } else {
        console.error(`  → ❌ Email service returned false - email NOT sent`);
        await this.prisma.delivery.update({
          where: { id: delivery.id },
          data: {
            status: 'failed',
            sentAt: null,
            error: 'Email service returned false - check SMTP configuration and server logs'
          }
        });
        console.log(`  → ❌ Delivery record updated to 'failed'`);
      }
      
      console.log('========================================================\n');
      return success;

    } catch (error) {
      // Record failed delivery
      console.error(`[RuleEngine] ❌ Exception caught in executeEmailAction:`, error);
      const contact = this.resolveContact(entity, rule.mapping.fields as any);
      const utcDate = new Date().toISOString().split('T')[0];
      const dedupeKey = contact ? `${rule.id}:${contact}:${utcDate}` : null;
      
      // Regenerate idempotencyKey if needed (should already be available as parameter, but ensure it exists)
      const errorIdempotencyKey = idempotencyKey || this.generateIdempotencyKey(
        rule.id,
        contact || 'unknown',
        utcDate
      );
      
      // Convert entityPk to string (database expects String, but entity.id might be Int)
      const entityPk = String(entity.id || entity.pk || 'unknown');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const truncatedError = errorMessage.length > 500 ? errorMessage.substring(0, 500) : errorMessage;
      
      console.log(`[RuleEngine] Updating delivery record to failed status...`);
      console.log(`  → Entity PK: ${entityPk} (converted to string)`);
      console.log(`  → IdempotencyKey: ${errorIdempotencyKey}`);
      console.log(`  → Error: ${truncatedError}`);
      
      try {
        // Use upsert to handle case where delivery record might not exist (if error occurred before creation)
        // or update existing record if it was created in Step 4
        await this.prisma.delivery.upsert({
          where: { idempotencyKey: errorIdempotencyKey },
          update: {
            // Update existing record to failed status
            status: 'failed',
            sentAt: null,
            error: truncatedError,
            updatedAt: new Date()
          },
          create: {
            // Create new failed record if it doesn't exist (shouldn't happen, but safe)
            ruleId: rule.id,
            entityPk: entityPk,
            contact: contact || 'unknown',
            channel: action.channel,
            status: 'failed',
            idempotencyKey: errorIdempotencyKey,
            dedupeKey,
            error: truncatedError
          }
        });
        console.log(`  → ✅ Delivery record updated to 'failed' status`);
      } catch (dbError) {
        console.error(`  → ❌ Failed to update/create delivery record:`, dbError);
        // If upsert also fails, log but don't throw - we've already logged the original error
      }

      return false;
    }
  }

  /**
   * Generate idempotency key
   */
  private generateIdempotencyKey(ruleId: string, contact: string, date: string): string {
    const input = `${ruleId}:${contact}:${date}`;
    return crypto.createHash('sha256').update(input).digest('hex');
  }

  /**
   * Get template by ID (placeholder implementation)
   */
  private async getTemplate(templateId: string): Promise<any> {
    // In a real implementation, this would fetch from a templates table
    // For now, return a simple template
    return {
      subject: 'Follow-up Message',
      content: 'Hello {name}, this is a follow-up message from our team.'
    };
  }

  /**
   * Render template with entity data (legacy {field} syntax)
   */
  private async renderTemplate(template: string, entity: any): Promise<string> {
    return this.renderSimpleTemplate(template, entity);
  }

  /**
   * Render simple template with {field} syntax replacement
   */
  private renderSimpleTemplate(template: string, entity: any): string {
    if (!template) return '';
    
    let rendered = template;
    
    // Simple variable replacement for {field} syntax
    Object.keys(entity).forEach(key => {
      const placeholder = `{${key}}`;
      if (rendered.includes(placeholder)) {
        rendered = rendered.replace(new RegExp(placeholder, 'g'), String(entity[key] || ''));
      }
    });

    return rendered;
  }
}

// Singleton instance
let ruleEngine: RuleEngine | null = null;

export function getRuleEngine(prisma?: PrismaClient): RuleEngine {
  if (!ruleEngine) {
    if (!prisma) {
      throw new Error('PrismaClient is required for first initialization');
    }
    ruleEngine = new RuleEngine(prisma);
  }
  return ruleEngine;
}

/**
 * Convenience function to run a rule
 */
export async function runRule(ruleId: string, dryRun: boolean = false): Promise<RunRuleResult | DryRunResult> {
  const engine = getRuleEngine(prisma);
  return engine.runRule(ruleId, dryRun);
}
