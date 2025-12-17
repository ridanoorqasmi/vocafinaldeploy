-- CreateTable: TenantDatabaseConfig
CREATE TABLE IF NOT EXISTS "public"."tenant_database_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "database" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_database_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TenantTableMapping
CREATE TABLE IF NOT EXISTS "public"."tenant_table_mappings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tableName" TEXT,
    "primaryKeyColumn" TEXT,
    "displayFields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_table_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_database_configs_tenantId_key" ON "public"."tenant_database_configs"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tenant_database_configs_tenantId_idx" ON "public"."tenant_database_configs"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_table_mappings_tenantId_key" ON "public"."tenant_table_mappings"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tenant_table_mappings_tenantId_idx" ON "public"."tenant_table_mappings"("tenantId");



