// ===== KB DOCUMENTS LIST API =====

import { NextRequest, NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/prisma';

const prisma = getPrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'tenantId is required' },
        { status: 400 }
      );
    }

    // Get all documents for tenant with chunk count
    const documents = await (prisma as any).kbDocument.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: { chunks: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const docsWithCounts = documents.map(doc => ({
      id: doc.id,
      filename: doc.filename,
      mimeType: doc.mimeType,
      size: doc.size,
      createdAt: doc.createdAt,
      chunkCount: doc._count.chunks
    }));

    return NextResponse.json({
      success: true,
      data: docsWithCounts
    });

  } catch (error: any) {
    console.error('KB docs list error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve documents',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}



