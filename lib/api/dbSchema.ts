// ===== DATABASE SCHEMA API HELPERS =====
// Phase 2: Frontend API helpers for fetching database tables and columns

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
}

/**
 * Get list of tables from tenant's database
 */
export async function getDatabaseTables(
  tenantId: string
): Promise<{ success: boolean; data?: string[]; error?: string }> {
  try {
    const response = await fetch(`/api/db/tables?tenantId=${tenantId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Failed to fetch tables'
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
 * Get columns for a specific table
 */
export async function getTableColumns(
  tenantId: string,
  tableName: string
): Promise<{ success: boolean; data?: ColumnInfo[]; error?: string }> {
  try {
    const response = await fetch(`/api/db/table-columns?tenantId=${tenantId}&tableName=${tableName}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Failed to fetch columns'
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



