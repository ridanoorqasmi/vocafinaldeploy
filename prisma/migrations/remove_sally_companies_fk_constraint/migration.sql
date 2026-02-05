-- Remove the problematic foreign key constraint on sally_companies.tenantId
-- This constraint was added manually and doesn't match our schema design
-- where tenantId is just a string identifier, not a foreign key

ALTER TABLE sally_companies 
DROP CONSTRAINT IF EXISTS sally_companies_tenantId_fkey;
