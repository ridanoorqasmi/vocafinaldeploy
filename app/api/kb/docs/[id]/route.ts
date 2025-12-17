// ===== KB DOCUMENT DELETE API =====

import { NextRequest, NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/prisma';

const prisma = getPrismaClient();

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'tenantId is required' },
        { status: 400 }
      );
    }

    // Verify document belongs to tenant
    const document = await (prisma as any).kbDocument.findFirst({
      where: {
        id: params.id,
        tenantId
      }
    });

    if (!document) {
      return NextResponse.json(
        { success: false, error: 'Document not found or access denied' },
        { status: 404 }
      );
    }

    // Delete document (chunks will be deleted via cascade)
    await (prisma as any).kbDocument.delete({
      where: { id: params.id }
    });

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully'
    });

  } catch (error: any) {
    console.error('KB doc delete error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete document',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}



