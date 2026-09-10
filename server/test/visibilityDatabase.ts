import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import bcrypt from "bcryptjs";
import * as schema from "db/schema";

// Isolated PostgreSQL fixture: never connects to DATABASE_URL or stored user data.
export async function createVisibilityDatabase() {
  const pool = new PGlite();
  await pool.exec(`
    CREATE TABLE users (
      id integer PRIMARY KEY, username text NOT NULL, login_key text,
      name_kana text, password text NOT NULL, role text NOT NULL,
      is_active boolean NOT NULL DEFAULT true, gender text DEFAULT 'male',
      credential_state text NOT NULL DEFAULT 'active', auth_version integer NOT NULL DEFAULT 1,
      birth_date timestamp, join_date timestamp, all_time_start_date timestamp,
      created_at timestamp DEFAULT now()
    );
    CREATE TABLE competitions (
      id integer PRIMARY KEY, name text, location text, date timestamp, created_at timestamp DEFAULT now()
    );
    CREATE TABLE swim_records (
      id integer PRIMARY KEY, student_id integer REFERENCES users(id), style text,
      distance integer, time text, date timestamp, pool_length integer DEFAULT 25,
      is_competition boolean DEFAULT false, competition_id integer REFERENCES competitions(id),
      competition_name text, competition_location text, gender text DEFAULT 'male'
    );
    CREATE TABLE announcements (
      id integer PRIMARY KEY, content text, updated_at timestamp, created_at timestamp, created_by integer
    );
    CREATE TABLE swimtrack_auth_attempts (
      key_hash text PRIMARY KEY, attempt_count integer NOT NULL, reset_at timestamptz NOT NULL
    );
  `);
  const db = drizzle(pool, { schema });
  const password = await bcrypt.hash("test-password", 4);
  async function reset() {
    await pool.exec(`
      TRUNCATE swim_records, competitions, users, swimtrack_auth_attempts CASCADE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date timestamp;
      INSERT INTO competitions (id, name, location, date) VALUES
        (1, '混在する大会', 'テスト会場', '2026-08-01'),
        (2, '無効選手のみの大会', 'テスト会場', '2026-08-02'),
        (3, '記録なしの大会', 'テスト会場', '2026-08-03');
    `);
    await pool.query(`INSERT INTO users (id, username, login_key, password, role, is_active) VALUES
      (1, '有効選手', '有効選手', $1, 'student', true),
      (2, '無効選手', '無効選手', $1, 'student', false),
      (7, 'admin', null, $1, 'admin', true)`, [password]);
    await pool.exec(`
      INSERT INTO swim_records (id, student_id, style, distance, time, date, competition_id) VALUES
        (11, 1, '自由形', 50, '00:40.00', '2020-01-01', 1),
        (12, 1, '自由形', 50, '00:35.00', now() - interval '10 days', 1),
        (21, 2, '自由形', 50, '00:30.00', '2020-01-01', 1),
        (22, 2, '自由形', 50, '00:25.00', now(), 2),
        (23, 2, '自由形', 50, '00:24.00', now() - interval '1 day', 2),
        (24, 2, '自由形', 50, '00:23.00', now() - interval '2 days', 2),
        (25, 2, '自由形', 50, '00:22.00', now() - interval '3 days', 2),
        (26, 2, '自由形', 50, '00:21.00', now() - interval '4 days', 2),
        (31, null, '自由形', 50, '00:20.00', now(), 1);
    `);
  }
  return { db, pool, reset };
}
