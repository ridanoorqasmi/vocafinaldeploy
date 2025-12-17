// ===== KB DOCUMENT PROCESSING SERVICE =====

import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

export interface ProcessedDocument {
  text: string;
  metadata: {
    filename: string;
    mimeType: string;
    size: number;
    pageCount?: number;
  };
}

/**
 * Process document file and extract text
 * Supports: PDF, DOCX, TXT
 */
export async function processDocument(
  filePath: string,
  mimeType: string,
  filename: string
): Promise<ProcessedDocument> {
  const fileBuffer = fs.readFileSync(filePath);
  const size = fileBuffer.length;

  let text = '';

  try {
    if (mimeType === 'application/pdf' || filename.endsWith('.pdf')) {
      // PDF processing
      const pdfData = await pdfParse(fileBuffer);
      text = pdfData.text;
      return {
        text: text.trim(),
        metadata: {
          filename,
          mimeType: 'application/pdf',
          size,
          pageCount: pdfData.numpages
        }
      };
    } else if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      filename.endsWith('.docx')
    ) {
      // DOCX processing
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      text = result.value;
      return {
        text: text.trim(),
        metadata: {
          filename,
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          size
        }
      };
    } else if (mimeType === 'text/plain' || filename.endsWith('.txt')) {
      // Plain text processing
      text = fileBuffer.toString('utf-8');
      return {
        text: text.trim(),
        metadata: {
          filename,
          mimeType: 'text/plain',
          size
        }
      };
    } else {
      throw new Error(`Unsupported file type: ${mimeType}`);
    }
  } catch (error) {
    throw new Error(`Failed to process document: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}



