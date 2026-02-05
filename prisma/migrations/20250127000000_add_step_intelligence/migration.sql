-- Step Intelligence Migration
-- Adds guidance fields to playbook_steps for contextual execution support
-- ⚠️ These fields are static per step definition, not per run

-- Add intelligence fields to playbook_steps table
DO $$
BEGIN
    -- Add step_rationale field
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'playbook_steps' 
        AND column_name = 'step_rationale'
    ) THEN
        ALTER TABLE "playbook_steps" ADD COLUMN "step_rationale" TEXT;
    END IF;

    -- Add success_signals field (stored as JSONB for array support)
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'playbook_steps' 
        AND column_name = 'success_signals'
    ) THEN
        ALTER TABLE "playbook_steps" ADD COLUMN "success_signals" JSONB;
    END IF;

    -- Add failure_signals field (stored as JSONB for array support)
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'playbook_steps' 
        AND column_name = 'failure_signals'
    ) THEN
        ALTER TABLE "playbook_steps" ADD COLUMN "failure_signals" JSONB;
    END IF;

    -- Add coach_notes field
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'playbook_steps' 
        AND column_name = 'coach_notes'
    ) THEN
        ALTER TABLE "playbook_steps" ADD COLUMN "coach_notes" TEXT;
    END IF;
END $$;

-- Migration complete - all fields are nullable and optional
-- Intelligence is generated once and reused across all runs
