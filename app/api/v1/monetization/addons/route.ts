import { NextRequest, NextResponse } from 'next/server';
import { addOnService } from '@/lib/services/addon-service';
import { z } from 'zod';

// Validation schemas
const CreateAddOnSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  priceCents: z.number().min(0),
  billingPeriod: z.enum(['monthly', 'yearly', 'one_time']),
  eventType: z.string().optional(),
  quantityIncluded: z.number().min(0).optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().default(0),
  metadata: z.record(z.any()).default({})
});

const PurchaseAddOnSchema = z.object({
  businessId: z.string().uuid(),
  addOnId: z.string().uuid(),
  quantity: z.number().min(1).default(1)
});

const CreateUpsellCampaignSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  triggerConditions: z.record(z.any()),
  targetAddOnId: z.string().uuid(),
  ctaText: z.string().min(1).max(100),
  ctaUrl: z.string().url().optional(),
  isActive: z.boolean().default(true),
  priority: z.number().default(0)
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const type = searchParams.get('type');

    if (type === 'active') {
      const addOns = await addOnService.getActiveAddOns();
      return NextResponse.json({
        success: true,
        data: addOns
      });
    }

    if (type === 'business' && businessId) {
      const businessAddOns = await addOnService.getBusinessAddOns(businessId);
      return NextResponse.json({
        success: true,
        data: businessAddOns
      });
    }

    if (type === 'campaigns' && businessId) {
      const campaigns = await addOnService.getUpsellCampaigns(businessId);
      return NextResponse.json({
        success: true,
        data: campaigns
      });
    }

    if (type === 'analytics') {
      const analytics = await addOnService.getAddOnAnalytics();
      return NextResponse.json({
        success: true,
        data: analytics
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid type parameter' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error getting add-ons:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get add-ons' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'create_addon') {
      const validatedData = CreateAddOnSchema.parse(body);
      const addOn = await addOnService.createAddOn(validatedData);
      
      return NextResponse.json({
        success: true,
        data: addOn
      });
    }

    if (action === 'purchase') {
      const validatedData = PurchaseAddOnSchema.parse(body);
      const result = await addOnService.purchaseAddOn(
        validatedData.businessId,
        validatedData.addOnId,
        validatedData.quantity
      );
      
      return NextResponse.json({
        success: true,
        data: result
      });
    }

    if (action === 'create_campaign') {
      const validatedData = CreateUpsellCampaignSchema.parse(body);
      const campaign = await addOnService.createUpsellCampaign(validatedData);
      
      return NextResponse.json({
        success: true,
        data: campaign
      });
    }

    if (action === 'record_interaction') {
      const { businessId, campaignId, interactionType, interactionData } = body;
      const interaction = await addOnService.recordUpsellInteraction(
        businessId,
        campaignId,
        interactionType,
        interactionData
      );
      
      return NextResponse.json({
        success: true,
        data: interaction
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error processing add-on request:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process add-on request' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, businessAddOnId } = body;

    if (action === 'cancel' && businessAddOnId) {
      const result = await addOnService.cancelBusinessAddOn(businessAddOnId);
      
      return NextResponse.json({
        success: true,
        data: result
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating add-on:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update add-on' },
      { status: 500 }
    );
  }
}
