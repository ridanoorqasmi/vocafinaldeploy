// ===== KB DOCUMENT UPLOAD API =====

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getPrismaClient } from '@/lib/prisma';
import { processDocument } from '@/lib/services/kb/processDocument';
import { splitText } from '@/lib/services/kb/splitText';
import { generateEmbeddings } from '@/lib/services/kb/generateEmbedding';

const prisma = getPrismaClient();

export async function POST(request: NextRequest) {
  let tempFilePath: string | null = null;

  try {
    // Get form data first (can't read request body twice)
    const formData = await request.formData();
    
    // Get tenantId from query params or form data
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') || (formData.get('tenantId') as string) || null;

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'tenantId is required' },
        { status: 400 }
      );
    }

    // Get file from form data
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    const allowedExtensions = ['.pdf', '.docx', '.txt'];

    const mimeType = file.type || '';
    const filename = file.name || 'document';
    const isValidType = allowedTypes.includes(mimeType) || 
                        allowedExtensions.some(ext => filename.toLowerCase().endsWith(ext));

    if (!isValidType) {
      return NextResponse.json(
        { success: false, error: 'Unsupported file type. Only PDF, DOCX, and TXT are supported.' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }

    // Save file to temporary location
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const tempDir = path.join(process.cwd(), 'tmp');
    
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    tempFilePath = path.join(tempDir, `${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
    fs.writeFileSync(tempFilePath, buffer);

    // Process document
    const processedDoc = await processDocument(tempFilePath, mimeType, filename);

    // Split into chunks
    const chunks = splitText(processedDoc.text, 1000, 200);

    if (chunks.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Document contains no text content' },
        { status: 400 }
      );
    }

    // Create document record
    const document = await (prisma as any).kbDocument.create({
      data: {
        tenantId,
        filename: processedDoc.metadata.filename,
        mimeType: processedDoc.metadata.mimeType,
        size: processedDoc.metadata.size
      }
    });

    // Generate embeddings for all chunks
    const chunkTexts = chunks.map(chunk => chunk.content);
    const embeddings = await generateEmbeddings(chunkTexts);

    // Create chunk records with embeddings
    const chunkData = chunks.map((chunk, index) => {
      const chunkContent = chunk.content || '';
      console.log(`Chunk ${index}: content length = ${chunkContent.length}, preview = ${chunkContent.substring(0, 50)}`);
      
      if (!chunkContent || chunkContent.trim().length === 0) {
        console.warn(`Warning: Chunk ${index} has empty content!`);
      }
      
      return {
        tenantId,
        documentId: document.id,
        content: chunkContent,
        embedding: embeddings[index]
      };
    });

    console.log(`Creating ${chunkData.length} chunks for document ${document.id}`);
    const result = await (prisma as any).kbChunk.createMany({
      data: chunkData
    });
    console.log(`Created ${result.count} chunks successfully`);

    // Clean up temporary file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    return NextResponse.json({
      success: true,
      data: {
        documentId: document.id,
        filename: document.filename,
        chunkCount: chunks.length,
        size: document.size
      }
    });

  } catch (error: any) {
    console.error('KB upload error:', error);
    console.error('Error stack:', error?.stack);
    console.error('Error details:', {
      message: error?.message,
      name: error?.name,
      code: error?.code
    });

    // Clean up temporary file on error
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupError) {
        console.warn('Failed to delete temporary file:', cleanupError);
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to upload document',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}



