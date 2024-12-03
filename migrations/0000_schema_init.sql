-- Migration: Initial schema setup
-- Description: Creates the base tables with proper foreign key relationships

-- UP Migration
CREATE TABLE IF NOT EXISTS "users" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "username" text NOT NULL UNIQUE,
  "role" text NOT NULL DEFAULT 'student',
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "settings" (
  "key" text PRIMARY KEY,
  "value" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "categories" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "name" text NOT NULL,
  "description" text,
  "created_at" timestamp DEFAULT now(),
  "created_by" integer REFERENCES "users"("id")
);

CREATE TABLE IF NOT EXISTS "documents" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "title" text NOT NULL,
  "filename" text NOT NULL,
  "mime_type" text NOT NULL,
  "uploader_id" integer REFERENCES "users"("id"),
  "category_id" integer REFERENCES "categories"("id"),
  "access" text NOT NULL DEFAULT 'all',
  "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "competitions" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "name" text NOT NULL,
  "date" timestamp NOT NULL,
  "location" text NOT NULL,
  "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "swim_records" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "student_id" integer REFERENCES "users"("id"),
  "style" text NOT NULL,
  "distance" integer NOT NULL,
  "time" text NOT NULL,
  "date" timestamp DEFAULT now(),
  "pool_length" integer NOT NULL DEFAULT 25,
  "is_competition" boolean DEFAULT false,
  "competition_id" integer REFERENCES "competitions"("id"),
  "competition_name" text,
  "competition_location" text
);

-- Insert initial settings
INSERT INTO settings (key, value) 
VALUES ('general_password', 'swimtrack2024')
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value;

-- DOWN Migration
DROP TABLE IF EXISTS "swim_records";
DROP TABLE IF EXISTS "documents";
DROP TABLE IF EXISTS "competitions";
DROP TABLE IF EXISTS "categories";
DROP TABLE IF EXISTS "settings";
DROP TABLE IF EXISTS "users";
