-- Quick Verification: Check if sales_workspaces table exists and has correct structure

-- 1. Check if table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'sales_workspaces'
) AS table_exists;

-- 2. If table exists, show its structure
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'sales_workspaces'
ORDER BY ordinal_position;

-- 3. Count any existing workspaces (should be 0 for new table)
SELECT COUNT(*) AS workspace_count FROM "sales_workspaces";
