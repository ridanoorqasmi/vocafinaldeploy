-- Sales Playbooks Migration
-- This migration creates playbook tables with strict isolation from workspaces
-- ⚠️ NO workspace_id columns allowed - playbooks are fully independent

-- Step 1: Create playbooks table
CREATE TABLE IF NOT EXISTS "playbooks" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pipeline_stage" TEXT NOT NULL,
    "target_persona" TEXT NOT NULL,
    "primary_use_case" TEXT NOT NULL,
    "core_message" TEXT NOT NULL,
    "risks_guardrails" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "playbooks_pkey" PRIMARY KEY ("id")
);

-- Step 2: Create playbook_steps table
CREATE TABLE IF NOT EXISTS "playbook_steps" (
    "id" TEXT NOT NULL,
    "playbook_id" TEXT NOT NULL,
    "step_index" INTEGER NOT NULL,
    "step_title" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "talk_track" TEXT NOT NULL,
    "customer_signals" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "playbook_steps_pkey" PRIMARY KEY ("id")
);

-- Step 3: Create playbook_runs table
CREATE TABLE IF NOT EXISTS "playbook_runs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "playbook_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "current_step_index" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "playbook_runs_pkey" PRIMARY KEY ("id")
);

-- Step 4: Create playbook_step_runs table
CREATE TABLE IF NOT EXISTS "playbook_step_runs" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "step_index" INTEGER NOT NULL,
    "generated_output" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "playbook_step_runs_pkey" PRIMARY KEY ("id")
);

-- Step 5: Create indexes
DO $$
BEGIN
    -- Playbooks indexes
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'playbooks') THEN
        IF NOT EXISTS (SELECT FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'playbooks' AND indexname = 'playbooks_tenant_id_idx') THEN
            CREATE INDEX "playbooks_tenant_id_idx" ON "playbooks"("tenant_id");
        END IF;
        IF NOT EXISTS (SELECT FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'playbooks' AND indexname = 'playbooks_updated_at_idx') THEN
            CREATE INDEX "playbooks_updated_at_idx" ON "playbooks"("updated_at");
        END IF;
    END IF;

    -- Playbook steps indexes
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'playbook_steps') THEN
        IF NOT EXISTS (SELECT FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'playbook_steps' AND indexname = 'playbook_steps_playbook_id_idx') THEN
            CREATE INDEX "playbook_steps_playbook_id_idx" ON "playbook_steps"("playbook_id");
        END IF;
        IF NOT EXISTS (SELECT FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'playbook_steps' AND indexname = 'playbook_steps_step_index_idx') THEN
            CREATE INDEX "playbook_steps_step_index_idx" ON "playbook_steps"("playbook_id", "step_index");
        END IF;
    END IF;

    -- Playbook runs indexes
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'playbook_runs') THEN
        IF NOT EXISTS (SELECT FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'playbook_runs' AND indexname = 'playbook_runs_tenant_id_idx') THEN
            CREATE INDEX "playbook_runs_tenant_id_idx" ON "playbook_runs"("tenant_id");
        END IF;
        IF NOT EXISTS (SELECT FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'playbook_runs' AND indexname = 'playbook_runs_playbook_id_idx') THEN
            CREATE INDEX "playbook_runs_playbook_id_idx" ON "playbook_runs"("playbook_id");
        END IF;
        IF NOT EXISTS (SELECT FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'playbook_runs' AND indexname = 'playbook_runs_status_idx') THEN
            CREATE INDEX "playbook_runs_status_idx" ON "playbook_runs"("status");
        END IF;
    END IF;

    -- Playbook step runs indexes
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'playbook_step_runs') THEN
        IF NOT EXISTS (SELECT FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'playbook_step_runs' AND indexname = 'playbook_step_runs_run_id_idx') THEN
            CREATE INDEX "playbook_step_runs_run_id_idx" ON "playbook_step_runs"("run_id");
        END IF;
        IF NOT EXISTS (SELECT FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'playbook_step_runs' AND indexname = 'playbook_step_runs_step_index_idx') THEN
            CREATE INDEX "playbook_step_runs_step_index_idx" ON "playbook_step_runs"("run_id", "step_index");
        END IF;
    END IF;
END $$;

-- Step 6: Add foreign key constraints
DO $$
BEGIN
    -- playbook_steps -> playbooks
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'playbook_steps')
       AND EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'playbooks') THEN
        IF NOT EXISTS (SELECT FROM information_schema.table_constraints WHERE constraint_schema = 'public' AND constraint_name = 'playbook_steps_playbook_id_fkey') THEN
            ALTER TABLE "playbook_steps" 
            ADD CONSTRAINT "playbook_steps_playbook_id_fkey" 
            FOREIGN KEY ("playbook_id") 
            REFERENCES "playbooks"("id") 
            ON DELETE CASCADE 
            ON UPDATE CASCADE;
        END IF;
    END IF;

    -- playbook_runs -> playbooks
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'playbook_runs')
       AND EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'playbooks') THEN
        IF NOT EXISTS (SELECT FROM information_schema.table_constraints WHERE constraint_schema = 'public' AND constraint_name = 'playbook_runs_playbook_id_fkey') THEN
            ALTER TABLE "playbook_runs" 
            ADD CONSTRAINT "playbook_runs_playbook_id_fkey" 
            FOREIGN KEY ("playbook_id") 
            REFERENCES "playbooks"("id") 
            ON DELETE CASCADE 
            ON UPDATE CASCADE;
        END IF;
    END IF;

    -- playbook_step_runs -> playbook_runs
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'playbook_step_runs')
       AND EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'playbook_runs') THEN
        IF NOT EXISTS (SELECT FROM information_schema.table_constraints WHERE constraint_schema = 'public' AND constraint_name = 'playbook_step_runs_run_id_fkey') THEN
            ALTER TABLE "playbook_step_runs" 
            ADD CONSTRAINT "playbook_step_runs_run_id_fkey" 
            FOREIGN KEY ("run_id") 
            REFERENCES "playbook_runs"("id") 
            ON DELETE CASCADE 
            ON UPDATE CASCADE;
        END IF;
    END IF;
END $$;

-- Migration complete - all operations are conditional and idempotent
-- ⚠️ NO workspace_id columns - playbooks are fully isolated from workspaces
