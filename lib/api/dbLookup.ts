// ===== DATABASE LOOKUP API HELPERS =====
// Phase 2: Frontend API helpers for read-only record lookups

export interface QueryRecordRequest {
  tenantId: string;
  identifierValue: string;
}

export interface QueryRecordResponse {
  success: boolean;
  data?: Record<string, any> | null;
  error?: string;
  details?: string;
}

/**
 * Query a single record from tenant database
 * Returns the record data or null if not found
 */
export async function queryRecord(
  tenantId: string,
  identifierValue: string
): Promise<QueryRecordResponse> {
  try {
    const response = await fetch('/api/db/query-record', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tenantId,
        identifierValue
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Failed to query record',
        details: data.details
      };
    }

    return {
      success: true,
      data: data.data // May be null if no record found
    };
  } catch (error: any) {
    return {
      success: false,
      error: 'Network error',
      details: error.message
    };
  }
}



