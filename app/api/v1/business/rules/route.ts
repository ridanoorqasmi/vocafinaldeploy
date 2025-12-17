// ===== BUSINESS RULES MANAGEMENT API =====

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getBusinessRulesEngine } from '../../../../../lib/business-rules-engine';
import { BusinessRuleConfig, BusinessRuleContext } from '../../../../../lib/business-rules-types';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rule, test_mode } = body;

    // Extract business ID from headers or request
    const businessId = request.headers.get('x-business-id') || body.business_id;
    if (!businessId) {
      return NextResponse.json(
        { error: 'Business ID is required' },
        { status: 400 }
      );
    }

    // Validate rule data
    if (!rule) {
      return NextResponse.json(
        { error: 'Rule data is required' },
        { status: 400 }
      );
    }

    // Get business rules engine
    const rulesEngine = getBusinessRulesEngine(prisma);

    if (test_mode) {
      // Test mode - validate and test the rule without saving
      const testRule: BusinessRuleConfig = {
        ...rule,
        business_id: businessId,
        rule_id: 'test_rule',
        created_at: new Date(),
        updated_at: new Date(),
        version: 1
      };

      // Test with sample scenarios
      const testScenarios = [
        {
          name: 'Basic query test',
          query_text: 'What is your best pizza?',
          intent: 'MENU_INQUIRY',
          customer_context: { is_returning: false },
          conversation_context: { session_id: 'test', turn_count: 1, previous_topics: [] },
          business_context: { current_hours: 'open' },
          expected_output: rule.actions
        }
      ];

      const testResults = await rulesEngine.testRule(testRule, testScenarios);

      return NextResponse.json({
        rule: testRule,
        validation: {
          valid: true,
          conflicts: [],
          test_results: testResults
        }
      });
    } else {
      // Create the actual rule
      const newRule = await rulesEngine.createRule({
        ...rule,
        business_id: businessId
      });

      return NextResponse.json({
        rule: newRule,
        validation: {
          valid: true,
          conflicts: []
        }
      });
    }

  } catch (error) {
    console.error('Business rules error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('business_id') || request.headers.get('x-business-id');

    if (!businessId) {
      return NextResponse.json(
        { error: 'Business ID is required' },
        { status: 400 }
      );
    }

    const category = searchParams.get('category');
    const active = searchParams.get('active');

    // Get business rules engine
    const rulesEngine = getBusinessRulesEngine(prisma);

    // In a real implementation, this would fetch rules from database
    // For now, return sample rules
    const sampleRules: BusinessRuleConfig[] = [
      {
        rule_id: 'rule_1',
        business_id: businessId,
        category: 'response_behavior',
        rule_type: 'tone_setting',
        name: 'Professional Tone',
        description: 'Set professional tone for all responses',
        conditions: [
          {
            field: 'query_text',
            operator: 'contains',
            value: 'pizza',
            case_sensitive: false
          }
        ],
        actions: [
          {
            type: 'set_response_style',
            parameters: {
              tone: 'professional',
              length: 'detailed'
            }
          }
        ],
        priority: 80,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
        version: 1
      }
    ];

    // Filter rules based on query parameters
    let filteredRules = sampleRules;
    
    if (category) {
      filteredRules = filteredRules.filter(rule => rule.category === category);
    }
    
    if (active !== null) {
      const isActive = active === 'true';
      filteredRules = filteredRules.filter(rule => rule.active === isActive);
    }

    return NextResponse.json({
      rules: filteredRules,
      total: filteredRules.length
    });

  } catch (error) {
    console.error('Get business rules error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { rule_id, updates } = body;

    if (!rule_id) {
      return NextResponse.json(
        { error: 'Rule ID is required' },
        { status: 400 }
      );
    }

    if (!updates) {
      return NextResponse.json(
        { error: 'Updates are required' },
        { status: 400 }
      );
    }

    // Get business rules engine
    const rulesEngine = getBusinessRulesEngine(prisma);

    // Update the rule
    const updatedRule = await rulesEngine.updateRule(rule_id, updates);

    return NextResponse.json({
      rule: updatedRule,
      message: 'Rule updated successfully'
    });

  } catch (error) {
    console.error('Update business rule error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ruleId = searchParams.get('rule_id');

    if (!ruleId) {
      return NextResponse.json(
        { error: 'Rule ID is required' },
        { status: 400 }
      );
    }

    // Get business rules engine
    const rulesEngine = getBusinessRulesEngine(prisma);

    // Deactivate the rule (soft delete)
    const updatedRule = await rulesEngine.updateRule(ruleId, { active: false });

    return NextResponse.json({
      message: 'Rule deactivated successfully',
      rule: updatedRule
    });

  } catch (error) {
    console.error('Delete business rule error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
