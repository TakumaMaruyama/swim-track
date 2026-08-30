import { createHash } from "node:crypto";
import { pool } from "../db";
import { normalizeFullName } from "../server/fullName";

const MIGRATION_ID = "auth_login_key_v2";
const LOCK_KEY = 7_341_925_117;
const APPLY_SQL = `
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_state text NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_updated_at timestamp;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_set_by integer;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at timestamp;
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_key text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'users'::regclass AND conname = 'users_auth_state_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_auth_state_check
      CHECK (auth_state IN ('initial_setup', 'active', 'temp_password'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'users'::regclass AND conname = 'users_password_set_by_fkey'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_password_set_by_fkey
      FOREIGN KEY (password_set_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS swimtrack_sessions (
  sid varchar NOT NULL PRIMARY KEY,
  sess json NOT NULL,
  expire timestamp(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS swimtrack_sessions_expire_idx ON swimtrack_sessions (expire);

UPDATE users
SET auth_state = 'initial_setup', session_version = session_version + 1
WHERE role = 'student'
  AND auth_state = 'active'
  AND password_updated_at IS NULL;
`;
const LOGIN_KEY_INDEX_SQL = `
CREATE UNIQUE INDEX IF NOT EXISTS users_student_login_key_unique
  ON users (login_key)
  WHERE role = 'student' AND login_key IS NOT NULL;
`;
// This marker makes the checksum cover the JS normalization pass as well as SQL.
const CHECKSUM = createHash("sha256")
  .update(`${APPLY_SQL}\n${LOGIN_KEY_INDEX_SQL}\nloginKey:normalizeFullName:shared-js-v1`)
  .digest("hex");

async function tableExists(name: string) {
  const result = await pool.query<{ exists: boolean }>(
    "SELECT to_regclass($1) IS NOT NULL AS exists",
    [`public.${name}`],
  );
  return result.rows[0]?.exists === true;
}

async function preflight() {
  if (!(await tableExists("users")) || !(await tableExists("swim_records"))) {
    throw new Error("Required users and swim_records tables were not found");
  }

  const [identity, roles, orphaned, passwordFormats, usersForNames, columns, sessionTable, ledgerTable] =
    await Promise.all([
      pool.query<{ database: string; schema: string }>(
        "SELECT current_database() AS database, current_schema() AS schema",
      ),
      pool.query<{ role: string; count: string }>(
        "SELECT role, count(*)::text AS count FROM users GROUP BY role ORDER BY role",
      ),
      pool.query<{ count: string }>(`
        SELECT count(*)::text AS count
        FROM swim_records r
        LEFT JOIN users u ON u.id = r.student_id
        WHERE r.student_id IS NOT NULL AND u.id IS NULL
      `),
      pool.query<{ bcrypt: string; other: string }>(`
        SELECT
          count(*) FILTER (WHERE password ~ '^\\$2[aby]\\$[0-9]{2}\\$.{53}$')::text AS bcrypt,
          count(*) FILTER (WHERE password !~ '^\\$2[aby]\\$[0-9]{2}\\$.{53}$')::text AS other
        FROM users
      `),
      pool.query<{ id: number; username: string }>("SELECT id, username FROM users WHERE role = 'student'"),
      pool.query<{ column_name: string }>(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'users'
          AND column_name IN (
            'auth_state', 'session_version', 'password_updated_at', 'password_set_by', 'last_login_at',
            'login_key'
          )
      `),
      tableExists("swimtrack_sessions"),
      tableExists("auth_migration_history"),
    ]);

  const nameCounts = new Map<string, number>();
  for (const row of usersForNames.rows) {
    const name = normalizeFullName(row.username);
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
  }
  const ambiguousGroups = [...nameCounts.values()].filter((count) => count > 1).length;
  const ambiguousUsers = [...nameCounts.values()]
    .filter((count) => count > 1)
    .reduce((sum, count) => sum + count, 0);
  const authColumnsExist = columns.rowCount === 6;
  const targetCandidates = authColumnsExist
    ? await pool.query<{ count: string }>(`
        SELECT count(*)::text AS count
        FROM users
        WHERE role = 'student' AND auth_state = 'active' AND password_updated_at IS NULL
      `)
    : { rows: [{ count: String(usersForNames.rowCount) }] };
  let appliedChecksumMatches = true;
  if (ledgerTable) {
    const ledger = await pool.query<{ checksum: string }>(
      "SELECT checksum FROM auth_migration_history WHERE migration_id = $1",
      [MIGRATION_ID],
    );
    if (ledger.rows[0] && ledger.rows[0].checksum !== CHECKSUM) {
      appliedChecksumMatches = false;
    }
  }

  console.log("Auth migration preflight", {
    mode: process.argv.includes("--apply") ? "apply" : "dry-run",
    database: identity.rows[0],
    migrationId: MIGRATION_ID,
    existingAuthColumns: columns.rowCount,
    sessionTableExists: sessionTable,
    ledgerTableExists: ledgerTable,
    roleCounts: Object.fromEntries(roles.rows.map((row) => [row.role, Number(row.count)])),
    orphanedRecords: Number(orphaned.rows[0]?.count ?? 0),
    passwordFormatCounts: {
      bcrypt: Number(passwordFormats.rows[0]?.bcrypt ?? 0),
      other: Number(passwordFormats.rows[0]?.other ?? 0),
    },
    students: usersForNames.rowCount,
    targetInitialSetupCandidates: Number(targetCandidates.rows[0]?.count ?? 0),
    ambiguousNormalizedNameGroups: ambiguousGroups,
    ambiguousStudents: ambiguousUsers,
    appliedChecksumMatches,
    dryRunDatabaseChanges: process.argv.includes("--apply") ? undefined : 0,
  });
  if (!appliedChecksumMatches) {
    throw new Error("Applied auth migration checksum does not match this runner");
  }
  return { ambiguousGroups, targetCandidates: Number(targetCandidates.rows[0]?.count ?? 0) };
}

async function apply() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query("SELECT pg_advisory_xact_lock($1)", [LOCK_KEY]);
    const catalog = await client.query<{ users: string | null; records: string | null }>(
      "SELECT to_regclass('public.users')::text AS users, to_regclass('public.swim_records')::text AS records",
    );
    if (!catalog.rows[0]?.users || !catalog.rows[0]?.records) {
      throw new Error("Catalog changed after preflight; refusing auth migration");
    }
    await client.query(`
      CREATE TABLE IF NOT EXISTS auth_migration_history (
        migration_id text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamp NOT NULL DEFAULT now()
      )
    `);
    const applied = await client.query<{ checksum: string }>(
      "SELECT checksum FROM auth_migration_history WHERE migration_id = $1 FOR UPDATE",
      [MIGRATION_ID],
    );
    if (applied.rows[0]) {
      if (applied.rows[0].checksum !== CHECKSUM) {
        throw new Error("Applied auth migration checksum does not match this runner");
      }
      await client.query("COMMIT");
      console.log("Auth migration already applied; no changes made");
      return;
    }
    await client.query(APPLY_SQL);
    const loginKeyColumn = await client.query<{ data_type: string; is_nullable: string }>(`
      SELECT data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'users'
        AND column_name = 'login_key'
    `);
    if (
      loginKeyColumn.rows[0]?.data_type !== "text" ||
      loginKeyColumn.rows[0]?.is_nullable !== "YES"
    ) {
      throw new Error("users.login_key catalog definition is unsafe");
    }
    const students = await client.query<{ id: number; username: string }>(
      "SELECT id, username FROM users WHERE role = 'student' FOR UPDATE",
    );
    const normalizedNames = new Map<string, number>();
    for (const student of students.rows) {
      const normalized = normalizeFullName(student.username);
      if (!normalized || normalizedNames.has(normalized)) {
        throw new Error("Normalized student full names are ambiguous or empty; refusing auth migration");
      }
      normalizedNames.set(normalized, student.id);
      await client.query(
        "UPDATE users SET login_key = $1 WHERE id = $2 AND role = 'student'",
        [normalized, student.id],
      );
    }
    const existingIndex = await client.query<{ indexdef: string }>(`
      SELECT indexdef FROM pg_indexes
      WHERE schemaname = current_schema()
        AND tablename = 'users'
        AND indexname = 'users_student_login_key_unique'
    `);
    if (existingIndex.rows[0]) {
      const definition = existingIndex.rows[0].indexdef.toLowerCase();
      if (
        !definition.includes("unique index") ||
        !definition.includes("(login_key)") ||
        !definition.includes("role = 'student'") ||
        !definition.includes("login_key is not null")
      ) {
        throw new Error("Existing users_student_login_key_unique index definition is unsafe");
      }
    }
    await client.query(LOGIN_KEY_INDEX_SQL);
    await client.query(
      "INSERT INTO auth_migration_history (migration_id, checksum) VALUES ($1, $2)",
      [MIGRATION_ID, CHECKSUM],
    );
    await client.query("COMMIT");
    console.log("Auth migration applied");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  const shouldApply = process.argv.includes("--apply");
  const unknownFlags = process.argv.slice(2).filter((arg) => arg !== "--apply");
  if (unknownFlags.length) throw new Error(`Unknown arguments: ${unknownFlags.join(", ")}`);
  const result = await preflight();
  if (!shouldApply) {
    console.log("Dry-run complete; database changes: 0. Pass --apply to apply explicitly.");
    return;
  }
  if (result.ambiguousGroups > 0) {
    throw new Error("Refusing migration because normalized student full names are ambiguous");
  }
  await apply();
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Auth migration failed");
    process.exitCode = 1;
  })
  .finally(() => pool.end());