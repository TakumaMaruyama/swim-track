CREATE TABLE IF NOT EXISTS "competitions" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "name" text NOT NULL,
  "date" timestamp NOT NULL,
  "location" text NOT NULL,
  "created_at" timestamp DEFAULT now()
);

-- Add competition_id column to swim_records if it doesn't exist
ALTER TABLE "swim_records" ADD COLUMN IF NOT EXISTS "competition_id" integer REFERENCES "competitions"("id");

-- Migrate existing competition data
INSERT INTO "competitions" ("name", "date", "location")
SELECT DISTINCT
  "competition_name" as "name",
  "date",
  "competition_location" as "location"
FROM "swim_records"
WHERE "is_competition" = true
  AND "competition_name" IS NOT NULL
  AND "competition_location" IS NOT NULL;

-- Update swim_records with new competition_id references
UPDATE "swim_records" sr
SET "competition_id" = c.id
FROM "competitions" c
WHERE sr."is_competition" = true
  AND sr."competition_name" = c."name"
  AND sr."competition_location" = c."location"
  AND sr."date" = c."date";
