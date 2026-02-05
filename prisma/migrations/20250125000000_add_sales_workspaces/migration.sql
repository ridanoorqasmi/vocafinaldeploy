-- Sales Workspaces Migration
-- This migration is idempotent and safe - checks for table existence before operations
-- Safe to run even if tables don't exist yet

-- Step 1: Create sales_workspaces table
CREATE TABLE IF NOT EXISTS "sales_workspaces" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "goalType" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_workspaces_pkey" PRIMARY KEY ("id")
);

-- Step 2: Create indexes on sales_workspaces (only if table exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'sales_workspaces'
    ) THEN
        -- Create indexes if they don't exist
        IF NOT EXISTS (
            SELECT FROM pg_indexes 
            WHERE schemaname = 'public' 
            AND tablename = 'sales_workspaces' 
            AND indexname = 'sales_workspaces_userId_idx'
        ) THEN
            CREATE INDEX "sales_workspaces_userId_idx" ON "sales_workspaces"("userId");
        END IF;

        IF NOT EXISTS (
            SELECT FROM pg_indexes 
            WHERE schemaname = 'public' 
            AND tablename = 'sales_workspaces' 
            AND indexname = 'sales_workspaces_companyId_idx'
        ) THEN
            CREATE INDEX "sales_workspaces_companyId_idx" ON "sales_workspaces"("companyId");
        END IF;

        IF NOT EXISTS (
            SELECT FROM pg_indexes 
            WHERE schemaname = 'public' 
            AND tablename = 'sales_workspaces' 
            AND indexname = 'sales_workspaces_updatedAt_idx'
        ) THEN
            CREATE INDEX "sales_workspaces_updatedAt_idx" ON "sales_workspaces"("updatedAt");
        END IF;
    END IF;
END $$;

-- Step 3: Add foreign key to sally_companies (only if both tables exist)
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'sales_workspaces'
    ) AND EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'sally_companies'
    ) THEN
        -- Drop constraint if it exists (to allow re-running)
        IF EXISTS (
            SELECT FROM information_schema.table_constraints 
            WHERE constraint_schema = 'public' 
            AND constraint_name = 'sales_workspaces_companyId_fkey'
        ) THEN
            ALTER TABLE "sales_workspaces" DROP CONSTRAINT "sales_workspaces_companyId_fkey";
        END IF;
        
        -- Add foreign key constraint
        ALTER TABLE "sales_workspaces" 
        ADD CONSTRAINT "sales_workspaces_companyId_fkey" 
        FOREIGN KEY ("companyId") 
        REFERENCES "sally_companies"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
    END IF;
END $$;

-- Step 4: Add workspaceId column to sally_sales_content (only if table exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'sally_sales_content'
    ) THEN
        -- Add workspaceId column if it doesn't exist
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'sally_sales_content' 
            AND column_name = 'workspaceId'
        ) THEN
            ALTER TABLE "sally_sales_content" ADD COLUMN "workspaceId" TEXT;
        END IF;

        -- Create index if it doesn't exist
        IF NOT EXISTS (
            SELECT FROM pg_indexes 
            WHERE schemaname = 'public' 
            AND tablename = 'sally_sales_content' 
            AND indexname = 'sally_sales_content_workspaceId_idx'
        ) THEN
            CREATE INDEX "sally_sales_content_workspaceId_idx" ON "sally_sales_content"("workspaceId");
        END IF;

        -- Add foreign key constraint if it doesn't exist
        IF NOT EXISTS (
            SELECT FROM information_schema.table_constraints 
            WHERE constraint_schema = 'public' 
            AND constraint_name = 'sally_sales_content_workspaceId_fkey'
        ) THEN
            -- Only add FK if sales_workspaces table exists
            IF EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'sales_workspaces'
            ) THEN
                ALTER TABLE "sally_sales_content" 
                ADD CONSTRAINT "sally_sales_content_workspaceId_fkey" 
                FOREIGN KEY ("workspaceId") 
                REFERENCES "sales_workspaces"("id") 
                ON DELETE SET NULL 
                ON UPDATE CASCADE;
            END IF;
        END IF;
    END IF;
END $$;

-- Migration complete - all operations are conditional and idempotent
