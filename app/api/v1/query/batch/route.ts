// ===== BATCH QUERY PROCESSING API =====

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getBatchProcessingService } from '../../../../../lib/batch-processing-service';
import { getQueryProcessor } from '../../../../../lib/query-processor';
import { BatchInput, BatchProcessingOptions } from '../../../../../lib/business-rules-types';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { queries, processing_options } = body;

    // Validate request
    if (!queries || !Array.isArray(queries) || queries.length === 0) {
      return NextResponse.json(
        { error: 'Queries array is required and must not be empty' },
        { status: 400 }
      );
    }

    if (queries.length > 1000) {
      return NextResponse.json(
        { error: 'Maximum 1000 queries allowed per batch' },
        { status: 400 }
      );
    }

    // Extract business ID from headers or request
    const businessId = request.headers.get('x-business-id') || body.business_id;
    if (!businessId) {
      return NextResponse.json(
        { error: 'Business ID is required' },
        { status: 400 }
      );
    }

    // Prepare batch inputs
    const batchInputs: BatchInput[] = queries.map((query: any, index: number) => ({
      input_id: query.query_id || `query_${index}`,
      data: {
        query_text: query.query_text,
        session_id: query.session_id,
        preferences: query.preferences,
        context: query.context
      },
      metadata: {
        original_index: index,
        created_at: new Date()
      }
    }));

    // Set default processing options
    const options: BatchProcessingOptions = {
      parallel_processing: processing_options?.parallel_processing ?? true,
      priority: processing_options?.priority ?? 'normal',
      timeout_ms: processing_options?.timeout_ms ?? 300000, // 5 minutes
      callback_url: processing_options?.callback_url,
      max_concurrent_workers: processing_options?.max_concurrent_workers ?? 5,
      retry_failed_items: processing_options?.retry_failed_items ?? false,
      max_retries: processing_options?.max_retries ?? 3
    };

    // Get services
    const queryProcessor = getQueryProcessor(prisma);
    const batchService = getBatchProcessingService(prisma, queryProcessor);

    // Create batch job
    const batchJob = await batchService.createBatchJob(
      businessId,
      'bulk_queries',
      batchInputs,
      options
    );

    // Calculate estimates
    const estimatedTokens = queries.length * 150; // Average tokens per query
    const estimatedCost = estimatedTokens * 0.0015; // Approximate cost per token

    return NextResponse.json({
      batch_job: {
        job_id: batchJob.job_id,
        status: batchJob.processing_status,
        estimated_completion: batchJob.progress.estimated_completion,
        webhook_configured: !!options.callback_url
      },
      processing: {
        total_queries: queries.length,
        estimated_tokens: estimatedTokens,
        estimated_cost: estimatedCost,
        queue_position: 0 // Would be calculated based on actual queue
      }
    });

  } catch (error) {
    console.error('Batch processing error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('job_id');

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    // Get services
    const queryProcessor = getQueryProcessor(prisma);
    const batchService = getBatchProcessingService(prisma, queryProcessor);

    // Get job status
    const job = await batchService.getBatchJobStatus(jobId);
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Get job summary if completed
    let summary = null;
    if (job.processing_status === 'completed') {
      summary = await batchService.getBatchJobSummary(jobId);
    }

    return NextResponse.json({
      job: {
        job_id: job.job_id,
        status: job.processing_status,
        progress: {
          completed: job.progress.processed_items,
          failed: job.progress.failed_items,
          remaining: job.progress.total_items - job.progress.processed_items - job.progress.failed_items,
          percentage: Math.round((job.progress.processed_items / job.progress.total_items) * 100)
        },
        results: job.results,
        summary: summary
      }
    });

  } catch (error) {
    console.error('Batch status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
