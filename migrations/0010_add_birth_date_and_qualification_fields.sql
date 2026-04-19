ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "birth_date" timestamp;

ALTER TABLE "competitions"
  ADD COLUMN IF NOT EXISTS "is_qualification_target" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "qualifying_meet_id" text,
  ADD COLUMN IF NOT EXISTS "qualifying_level" text,
  ADD COLUMN IF NOT EXISTS "qualifying_season" integer,
  ADD COLUMN IF NOT EXISTS "qualifying_course" text;
