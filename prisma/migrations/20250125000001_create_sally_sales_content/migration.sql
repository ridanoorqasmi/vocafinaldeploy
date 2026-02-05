-- Create sally_sales_content table
-- This migration creates the sally_sales_content table if it doesn't exist
-- Safe to run multiple times (idempotent)

-- Step 1: Create sally_companies table if it doesn't exist (required for FK)
CREATE TABLE IF NOT EXISTS "sally_companies" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sally_companies_pkey" PRIMARY KEY ("id")
);

-- Step 2: Create indexes on sally_companies (only if table exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'sally_companies'
    ) THEN
        -- Create indexes if they don't exist
        IF NOT EXISTS (
            SELECT FROM pg_indexes 
            WHERE schemaname = 'public' 
            AND tablename = 'sally_companies' 
            AND indexname = 'sally_companies_userId_idx'
        ) THEN
            CREATE INDEX "sally_companies_userId_idx" ON "sally_companies"("userId");
        END IF;

        IF NOT EXISTS (
            SELECT FROM pg_indexes 
            WHERE schemaname = 'public' 
            AND tablename = 'sally_companies' 
            AND indexname = 'sally_companies_tenantId_idx'
        ) THEN
            CREATE INDEX "sally_companies_tenantId_idx" ON "sally_companies"("tenantId");
        END IF;
    END IF;
END $$;

-- Step 3: Add foreign key to users table (only if both tables exist)
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'sally_companies'
    ) AND EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
    ) THEN
        -- Drop constraint if it exists (to allow re-running)
        IF EXISTS (
            SELECT FROM information_schema.table_constraints 
            WHERE constraint_schema = 'public' 
            AND constraint_name = 'sally_companies_userId_fkey'
        ) THEN
            ALTER TABLE "sally_companies" DROP CONSTRAINT "sally_companies_userId_fkey";
        END IF;
        
        -- Add foreign key constraint
        ALTER TABLE "sally_companies" 
        ADD CONSTRAINT "sally_companies_userId_fkey" 
        FOREIGN KEY ("userId") 
        REFERENCES "users"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
    END IF;
END $$;

-- Step 4: Create sally_sales_content table
CREATE TABLE IF NOT EXISTS "sally_sales_content" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "inputJson" JSONB NOT NULL,
    "outputJson" JSONB NOT NULL,
    "strategy" TEXT,
    "strategyReason" TEXT,
    "mode" TEXT,
    "selectedAssets" JSONB,
    "advancedInputs" JSONB,
    "workspaceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sally_sales_content_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sally_sales_content_userId_companyId_key" UNIQUE ("userId", "companyId")
);

-- Step 5: Create indexes on sally_sales_content (only if table exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'sally_sales_content'
    ) THEN
        -- Create indexes if they don't exist
        IF NOT EXISTS (
            SELECT FROM pg_indexes 
            WHERE schemaname = 'public' 
            AND tablename = 'sally_sales_content' 
            AND indexname = 'sally_sales_content_userId_idx'
        ) THEN
            CREATE INDEX "sally_sales_content_userId_idx" ON "sally_sales_content"("userId");
        END IF;

        IF NOT EXISTS (
            SELECT FROM pg_indexes 
            WHERE schemaname = 'public' 
            AND tablename = 'sally_sales_content' 
            AND indexname = 'sally_sales_content_companyId_idx'
        ) THEN
            CREATE INDEX "sally_sales_content_companyId_idx" ON "sally_sales_content"("companyId");
        END IF;

        IF NOT EXISTS (
            SELECT FROM pg_indexes 
            WHERE schemaname = 'public' 
            AND tablename = 'sally_sales_content' 
            AND indexname = 'sally_sales_content_createdAt_idx'
        ) THEN
            CREATE INDEX "sally_sales_content_createdAt_idx" ON "sally_sales_content"("createdAt");
        END IF;

        IF NOT EXISTS (
            SELECT FROM pg_indexes 
            WHERE schemaname = 'public' 
            AND tablename = 'sally_sales_content' 
            AND indexname = 'sally_sales_content_workspaceId_idx'
        ) THEN
            CREATE INDEX "sally_sales_content_workspaceId_idx" ON "sally_sales_content"("workspaceId");
        END IF;
    END IF;
END $$;

-- Step 6: Add foreign key to sally_companies (only if both tables exist)
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'sally_sales_content'
    ) AND EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'sally_companies'
    ) THEN
        -- Drop constraint if it exists (to allow re-running)
        IF EXISTS (
            SELECT FROM information_schema.table_constraints 
            WHERE constraint_schema = 'public' 
            AND constraint_name = 'sally_sales_content_companyId_fkey'
        ) THEN
            ALTER TABLE "sally_sales_content" DROP CONSTRAINT "sally_sales_content_companyId_fkey";
        END IF;
        
        -- Add foreign key constraint
        ALTER TABLE "sally_sales_content" 
        ADD CONSTRAINT "sally_sales_content_companyId_fkey" 
        FOREIGN KEY ("companyId") 
        REFERENCES "sally_companies"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
    END IF;
END $$;

-- Step 7: Add foreign key to sales_workspaces (only if both tables exist)
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'sally_sales_content'
    ) AND EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'sales_workspaces'
    ) THEN
        -- Drop constraint if it exists (to allow re-running)
        IF EXISTS (
            SELECT FROM information_schema.table_constraints 
            WHERE constraint_schema = 'public' 
            AND constraint_name = 'sally_sales_content_workspaceId_fkey'
        ) THEN
            ALTER TABLE "sally_sales_content" DROP CONSTRAINT "sally_sales_content_workspaceId_fkey";
        END IF;
        
        -- Add foreign key constraint
        ALTER TABLE "sally_sales_content" 
        ADD CONSTRAINT "sally_sales_content_workspaceId_fkey" 
        FOREIGN KEY ("workspaceId") 
        REFERENCES "sales_workspaces"("id") 
        ON DELETE SET NULL 
        ON UPDATE CASCADE;
    END IF;
END $$;

-- Migration complete - all operations are conditional and idempotent
