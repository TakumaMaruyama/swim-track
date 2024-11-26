ALTER TABLE "swim_records" ADD COLUMN IF NOT EXISTS "is_competition" boolean DEFAULT false;
ALTER TABLE "swim_records" ADD COLUMN IF NOT EXISTS "competition_name" text;
ALTER TABLE "swim_records" ADD COLUMN IF NOT EXISTS "competition_location" text;
