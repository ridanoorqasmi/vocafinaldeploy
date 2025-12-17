-- Create DatabaseType enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE "public"."DatabaseType" AS ENUM ('POSTGRESQL', 'MYSQL', 'SQLITE', 'MONGODB', 'FIREBASE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add dbType column to tenant_database_configs table
ALTER TABLE "public"."tenant_database_configs" 
ADD COLUMN IF NOT EXISTS "dbType" "public"."DatabaseType" NOT NULL DEFAULT 'POSTGRESQL';


