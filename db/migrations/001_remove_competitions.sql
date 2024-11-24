-- Remove foreign key constraint first
ALTER TABLE swim_records DROP CONSTRAINT IF EXISTS swim_records_competition_id_fkey;

-- Remove columns from swim_records
ALTER TABLE swim_records DROP COLUMN IF EXISTS is_competition;
ALTER TABLE swim_records DROP COLUMN IF EXISTS competition_id;

-- Drop competitions table
DROP TABLE IF EXISTS competitions;
