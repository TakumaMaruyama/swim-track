CREATE TABLE IF NOT EXISTS "announcements" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "title" text NOT NULL,
  "content" text NOT NULL,
  "created_by" integer REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Add RLS policies to ensure only coaches can create/edit/delete announcements
ALTER TABLE "announcements" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "announcements_select_policy" ON "announcements"
  FOR SELECT USING (true);

CREATE POLICY "announcements_insert_policy" ON "announcements"
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM "users"
      WHERE "users"."id" = current_user::integer
      AND "users"."role" = 'coach'
    )
  );

CREATE POLICY "announcements_update_policy" ON "announcements"
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM "users"
      WHERE "users"."id" = current_user::integer
      AND "users"."role" = 'coach'
    )
  );

CREATE POLICY "announcements_delete_policy" ON "announcements"
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM "users"
      WHERE "users"."id" = current_user::integer
      AND "users"."role" = 'coach'
    )
  );
