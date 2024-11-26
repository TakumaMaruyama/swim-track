ALTER TABLE "swim_records" DROP COLUMN IF EXISTS "is_competition";
ALTER TABLE "swim_records" DROP COLUMN IF EXISTS "competition_id";
DROP TABLE IF EXISTS "competitions";
