// ===== DATABASE CONFIGURATION API HELPERS =====
// Phase 2: Frontend API helpers for tenant database configuration

export interface DatabaseConfig {
  dbType: 'POSTGRESQL' | 'MYSQL' | 'SQLITE' | 'MONGODB' | 'FIREBASE';
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

export interface DatabaseConfigResponse {
  id?: string;
  tenantId: string;
  dbType: 'POSTGRESQL' | 'MYSQL' | 'SQLITE' | 'MONGODB' | 'FIREBASE';
  host: string;
  port: number;
  username: string;
  password: string; // Masked as '***'
  database: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Save database configuration for a tenant
 */
export async function saveDatabaseConfig(
  tenantId: string,
  config: DatabaseConfig,
  testOnly: boolean = false
): Promise<{ success: boolean; data?: DatabaseConfigResponse; error?: string; details?: string }> {
  try {
    const url = `/api/db/config${testOnly ? '?test=true' : ''}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tenantId,
        ...config
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Failed to save database configuration',
        details: data.details
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
 * Test database connection without saving
 */
export async function testDatabaseConnection(
  tenantId: string,
  config: DatabaseConfig
): Promise<{ success: boolean; message?: string; error?: string; details?: string }> {
  return saveDatabaseConfig(tenantId, config, true);
}

/**
 * Get database configuration for a tenant (masked)
 */
export async function getDatabaseConfig(
  tenantId: string
): Promise<{ success: boolean; data?: DatabaseConfigResponse | null; error?: string }> {
  try {
    const response = await fetch(`/api/db/config?tenantId=${tenantId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Failed to retrieve database configuration'
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


