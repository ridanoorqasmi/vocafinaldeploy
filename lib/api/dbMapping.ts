// ===== TABLE MAPPING API HELPERS =====
// Phase 2: Frontend API helpers for tenant table/field mappings

export interface TableMapping {
  tableName: string;
  primaryKeyColumn: string;
  displayFields: string[];
}

export interface TableMappingResponse {
  id: string;
  tenantId: string;
  tableName: string | null;
  primaryKeyColumn: string | null;
  displayFields: string[] | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Save table/field mapping for a tenant
 */
export async function saveTableMapping(
  tenantId: string,
  mapping: TableMapping
): Promise<{ success: boolean; data?: TableMappingResponse; error?: string }> {
  try {
    const response = await fetch('/api/db/mapping', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tenantId,
        ...mapping
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Failed to save table mapping'
      };
    }

    return {
      success: true,
      data: data.data
    };
  } catch (error: any) {
    return {
      success: false,
      error: 'Network error',
      details: error.message
    };
  }
}

/**
 * Get table/field mapping for a tenant
 */
export async function getTableMapping(
  tenantId: string
): Promise<{ success: boolean; data?: TableMappingResponse | null; error?: string }> {
  try {
    const response = await fetch(`/api/db/mapping?tenantId=${tenantId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Failed to retrieve table mapping'
      };
    }

    return {
      success: true,
      data: data.data
    };
  } catch (error: any) {
    return {
      success: false,
      error: 'Network error',
      details: error.message
    };
  }
}



