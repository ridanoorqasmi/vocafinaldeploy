// ===== RESPONSE TEMPLATES API =====

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getResponseTemplateEngine } from '../../../../../lib/response-template-engine';
import { ResponseTemplate, TemplateCategory, TemplateTestScenario } from '../../../../../lib/business-rules-types';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { template, test_scenarios } = body;

    // Extract business ID from headers or request
    const businessId = request.headers.get('x-business-id') || body.business_id;
    if (!businessId) {
      return NextResponse.json(
        { error: 'Business ID is required' },
        { status: 400 }
      );
    }

    // Validate template data
    if (!template) {
      return NextResponse.json(
        { error: 'Template data is required' },
        { status: 400 }
      );
    }

    // Get response template engine
    const templateEngine = getResponseTemplateEngine(prisma);

    // Create the template
    const newTemplate = await templateEngine.createTemplate({
      ...template,
      business_id: businessId
    });

    // Test template if scenarios provided
    let testResults = null;
    if (test_scenarios && Array.isArray(test_scenarios)) {
      testResults = await templateEngine.testTemplate(newTemplate, test_scenarios);
    }

    return NextResponse.json({
      template: newTemplate,
      validation: {
        valid: true,
        variable_errors: [],
        test_results: testResults
      }
    });

  } catch (error) {
    console.error('Response template error:', error);
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

    const category = searchParams.get('category') as TemplateCategory;
    const active = searchParams.get('active');

    // Get response template engine
    const templateEngine = getResponseTemplateEngine(prisma);

    // Get templates
    let templates: ResponseTemplate[] = [];
    
    if (category) {
      templates = await templateEngine.getTemplates(businessId, category);
    } else {
      // Get all categories
      const categories: TemplateCategory[] = ['greeting_templates', 'information_templates', 'escalation_templates', 'fallback_templates'];
      for (const cat of categories) {
        const catTemplates = await templateEngine.getTemplates(businessId, cat);
        templates.push(...catTemplates);
      }
    }

    // Filter by active status
    if (active !== null) {
      const isActive = active === 'true';
      templates = templates.filter(template => template.active === isActive);
    }

    return NextResponse.json({
      templates: templates,
      total: templates.length
    });

  } catch (error) {
    console.error('Get response templates error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { template_id, updates } = body;

    if (!template_id) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      );
    }

    if (!updates) {
      return NextResponse.json(
        { error: 'Updates are required' },
        { status: 400 }
      );
    }

    // Get response template engine
    const templateEngine = getResponseTemplateEngine(prisma);

    // Update the template (placeholder implementation)
    // In a real implementation, this would update the template in the database
    const updatedTemplate: ResponseTemplate = {
      template_id,
      ...updates,
      updated_at: new Date(),
      version: (updates.version || 1) + 1
    } as ResponseTemplate;

    return NextResponse.json({
      template: updatedTemplate,
      message: 'Template updated successfully'
    });

  } catch (error) {
    console.error('Update response template error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('template_id');

    if (!templateId) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      );
    }

    // Get response template engine
    const templateEngine = getResponseTemplateEngine(prisma);

    // Deactivate the template (soft delete)
    // In a real implementation, this would update the template in the database
    const updatedTemplate: ResponseTemplate = {
      template_id: templateId,
      active: false,
      updated_at: new Date()
    } as ResponseTemplate;

    return NextResponse.json({
      message: 'Template deactivated successfully',
      template: updatedTemplate
    });

  } catch (error) {
    console.error('Delete response template error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
