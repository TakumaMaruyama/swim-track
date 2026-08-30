import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "../db";
import { normalizeFullName } from "../server/fullName";
import { UNUSABLE_PASSWORD_HASH } from "../server/passwordPolicy";

export const MIGRATION_ID = "auth_login_key_v3";
export const LOCK_KEY = 7_341_925_117;
export const PASSWORD_SENTINEL = UNUSABLE_PASSWORD_HASH;
export const APPLY_SQL = `
ALTER TABLE users ADD COLUMN IF NOT EXISTS credential_state text NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_version integer NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_set_by integer;
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_key text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'users'::regclass AND conname = 'users_credential_state_check') THEN
    ALTER TABLE users ADD CONSTRAINT users_credential_state_check CHECK (credential_state IN ('setup_required', 'temporary', 'active'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'users'::regclass AND conname = 'users_password_set_by_fkey') THEN
    ALTER TABLE users ADD CONSTRAINT users_password_set_by_fkey FOREIGN KEY (password_set_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'users'::regclass AND conname = 'users_student_login_key_check') THEN
    ALTER TABLE users ADD CONSTRAINT users_student_login_key_check CHECK (role <> 'student' OR login_key IS NOT NULL) NOT VALID;
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS swimtrack_sessions (sid varchar NOT NULL PRIMARY KEY, sess json NOT NULL, expire timestamp(6) NOT NULL);
CREATE INDEX IF NOT EXISTS swimtrack_sessions_expire_idx ON swimtrack_sessions (expire);
CREATE TABLE IF NOT EXISTS swimtrack_auth_attempts (
  key_hash char(64) PRIMARY KEY,
  attempt_count integer NOT NULL,
  reset_at timestamp with time zone NOT NULL,
  CONSTRAINT swimtrack_auth_attempts_count_check CHECK (attempt_count > 0)
);
CREATE INDEX IF NOT EXISTS swimtrack_auth_attempts_reset_idx ON swimtrack_auth_attempts (reset_at);
`;
export const LOGIN_KEY_INDEX_SQL = `CREATE UNIQUE INDEX IF NOT EXISTS users_student_login_key_unique ON users (login_key) WHERE role = 'student' AND login_key IS NOT NULL;`;
export const CHECKSUM = createHash("sha256")
  .update(`${APPLY_SQL}\n${LOGIN_KEY_INDEX_SQL}\nloginKey:normalizeFullName:shared-js-v2\nsentinel:${PASSWORD_SENTINEL}`)
  .digest("hex");

type BaseAdmin = {
  id: number;
  username: string;
  password: string;
  is_active: boolean;
  role: string;
};

type AdminAuthSnapshot = BaseAdmin & {
  credential_state: string;
  auth_version: number;
};

type Inspection = {
  students: Array<{ id: number; username: string }>;
  admins: BaseAdmin[];
  ownerlessRecords: number;
  totalRecords: number;
  roleCounts: Record<string, number>;
};

export function findNormalizedNameCollision(names: string[]) {
  const seen = new Set<string>();
  for (const raw of names) {
    const normalized = normalizeFullName(raw);
    if (!normalized || seen.has(normalized)) return normalized || "<empty>";
    seen.add(normalized);
  }
  return null;
}

async function inspectLockedDatabase(client: PoolClient): Promise<Inspection> {
  const catalog = await client.query<{ users: string | null; records: string | null }>(
    "SELECT to_regclass('public.users')::text AS users, to_regclass('public.swim_records')::text AS records",
  );
  if (!catalog.rows[0]?.users || !catalog.rows[0]?.records) {
    throw new Error("Required users and swim_records tables were not found");
  }

  const roles = await client.query<{ role: string; count: string }>(
    "SELECT role, count(*)::text AS count FROM users GROUP BY role ORDER BY role",
  );
  const roleCounts = Object.fromEntries(roles.rows.map((row) => [row.role, Number(row.count)]));
  const unknownRoles = Object.keys(roleCounts).filter((role) => role !== "admin" && role !== "student");
  if (unknownRoles.length > 0) {
    throw new Error(`Unexpected user roles: ${unknownRoles.join(", ")}`);
  }
  if ((roleCounts.admin ?? 0) < 1) {
    throw new Error("At least one admin is required; refusing auth migration");
  }

  const students = await client.query<{ id: number; username: string }>(
    "SELECT id, username FROM users WHERE role = 'student' ORDER BY id FOR UPDATE",
  );
  const collision = findNormalizedNameCollision(students.rows.map((student) => student.username));
  if (collision) {
    throw new Error(`Normalized student full names are ambiguous or empty: ${collision}`);
  }
  const admins = await client.query<BaseAdmin>(
    "SELECT id, username, password, is_active, role FROM users WHERE role = 'admin' ORDER BY id FOR UPDATE",
  );
  const records = await client.query<{ total: string; ownerless: string }>(`
    SELECT count(*)::text AS total,
      count(*) FILTER (WHERE student_id IS NULL)::text AS ownerless
    FROM swim_records
  `);
  return {
    students: students.rows,
    admins: admins.rows,
    totalRecords: Number(records.rows[0]?.total ?? 0),
    ownerlessRecords: Number(records.rows[0]?.ownerless ?? 0),
    roleCounts,
  };
}

async function validateCreatedSchema(
  client: PoolClient,
  options: { requireLoginKeyConstraintValidated?: boolean } = {},
) {
  const columns = await client.query<{
    column_name: string;
    data_type: string;
    is_nullable: string;
    column_default: string | null;
  }>(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'users'
      AND column_name IN ('credential_state', 'auth_version', 'password_set_by', 'login_key')
    ORDER BY column_name
  `);
  const authColumns = new Map(columns.rows.map((row) => [row.column_name, row]));
  if (
    columns.rowCount !== 4 ||
    authColumns.get("credential_state")?.data_type !== "text" ||
    authColumns.get("credential_state")?.is_nullable !== "NO" ||
    !authColumns.get("credential_state")?.column_default?.includes("active") ||
    authColumns.get("auth_version")?.data_type !== "integer" ||
    authColumns.get("auth_version")?.is_nullable !== "NO" ||
    authColumns.get("auth_version")?.column_default !== "1" ||
    authColumns.get("login_key")?.data_type !== "text" ||
    authColumns.get("login_key")?.is_nullable !== "YES" ||
    authColumns.get("password_set_by")?.data_type !== "integer" ||
    authColumns.get("password_set_by")?.is_nullable !== "YES"
  ) {
    throw new Error("Existing auth column definitions are unsafe");
  }
  const sessions = await client.query<{ column_name: string; data_type: string; is_nullable: string }>(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'swimtrack_sessions'
    ORDER BY column_name
  `);
  const sessionColumns = new Map(sessions.rows.map((row) => [row.column_name, row]));
  if (
    sessions.rowCount !== 3 ||
    sessionColumns.get("sid")?.data_type !== "character varying" ||
    sessionColumns.get("sid")?.is_nullable !== "NO" ||
    sessionColumns.get("sess")?.data_type !== "json" ||
    sessionColumns.get("sess")?.is_nullable !== "NO" ||
    sessionColumns.get("expire")?.data_type !== "timestamp without time zone" ||
    sessionColumns.get("expire")?.is_nullable !== "NO"
  ) {
    throw new Error("Existing swimtrack_sessions table definition is unsafe");
  }
  const sessionSafety = await client.query<{ primary_key: string; expire_index: string }>(`
    SELECT
      count(*) FILTER (
        WHERE c.contype = 'p' AND a.attname = 'sid'
      )::text AS primary_key,
      (SELECT count(*)::text FROM pg_indexes
       WHERE schemaname = current_schema()
         AND tablename = 'swimtrack_sessions'
         AND indexname = 'swimtrack_sessions_expire_idx'
         AND lower(indexdef) LIKE '%(expire)%') AS expire_index
    FROM pg_constraint c
    JOIN unnest(c.conkey) WITH ORDINALITY AS key(attnum, ordinality) ON true
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = key.attnum
    WHERE c.conrelid = 'swimtrack_sessions'::regclass
  `);
  if (
    sessionSafety.rows[0]?.primary_key !== "1" ||
    sessionSafety.rows[0]?.expire_index !== "1"
  ) {
    throw new Error("Existing swimtrack_sessions keys or indexes are unsafe");
  }
  const attemptColumns = await client.query<{
    column_name: string;
    data_type: string;
    is_nullable: string;
    character_maximum_length: number | null;
  }>(`
    SELECT column_name, data_type, is_nullable, character_maximum_length
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'swimtrack_auth_attempts'
    ORDER BY column_name
  `);
  const attemptColumnMap = new Map(attemptColumns.rows.map((row) => [row.column_name, row]));
  if (
    attemptColumns.rowCount !== 3 ||
    attemptColumnMap.get("key_hash")?.data_type !== "character" ||
    attemptColumnMap.get("key_hash")?.character_maximum_length !== 64 ||
    attemptColumnMap.get("key_hash")?.is_nullable !== "NO" ||
    attemptColumnMap.get("attempt_count")?.data_type !== "integer" ||
    attemptColumnMap.get("attempt_count")?.is_nullable !== "NO" ||
    attemptColumnMap.get("reset_at")?.data_type !== "timestamp with time zone" ||
    attemptColumnMap.get("reset_at")?.is_nullable !== "NO"
  ) {
    throw new Error("Existing swimtrack_auth_attempts table definition is unsafe");
  }
  const attemptSafety = await client.query<{
    primary_key: string;
    reset_index: string;
    count_check: string;
  }>(`
    SELECT
      count(*) FILTER (
        WHERE c.contype = 'p' AND a.attname = 'key_hash'
      )::text AS primary_key,
      (SELECT count(*)::text FROM pg_indexes
       WHERE schemaname = current_schema()
         AND tablename = 'swimtrack_auth_attempts'
         AND indexname = 'swimtrack_auth_attempts_reset_idx'
         AND lower(indexdef) LIKE '%(reset_at)%') AS reset_index,
      (SELECT count(*)::text FROM pg_constraint
       WHERE conrelid = 'swimtrack_auth_attempts'::regclass
         AND contype = 'c'
         AND convalidated
         AND conname = 'swimtrack_auth_attempts_count_check'
         AND lower(pg_get_constraintdef(oid)) LIKE '%attempt_count > 0%') AS count_check
    FROM pg_constraint c
    JOIN unnest(c.conkey) WITH ORDINALITY AS key(attnum, ordinality) ON true
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = key.attnum
    WHERE c.conrelid = 'swimtrack_auth_attempts'::regclass
  `);
  if (
    attemptSafety.rows[0]?.primary_key !== "1" ||
    attemptSafety.rows[0]?.reset_index !== "1" ||
    attemptSafety.rows[0]?.count_check !== "1"
  ) {
    throw new Error("Existing swimtrack_auth_attempts keys or constraints are unsafe");
  }
  const constraints = await client.query<{
    conname: string;
    contype: string;
    convalidated: boolean;
    definition: string;
  }>(`
    SELECT conname, contype, convalidated, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid = 'users'::regclass
      AND conname IN (
        'users_credential_state_check',
        'users_password_set_by_fkey',
        'users_student_login_key_check'
      )
  `);
  const constraintMap = new Map(constraints.rows.map((row) => [row.conname, row]));
  const stateDefinition = constraintMap.get("users_credential_state_check")?.definition.toLowerCase() ?? "";
  const passwordSetterDefinition = constraintMap.get("users_password_set_by_fkey")?.definition.toLowerCase() ?? "";
  const loginKeyDefinition = constraintMap.get("users_student_login_key_check")?.definition.toLowerCase() ?? "";
  if (
    constraintMap.get("users_credential_state_check")?.contype !== "c" ||
    !constraintMap.get("users_credential_state_check")?.convalidated ||
    !stateDefinition.includes("credential_state") ||
    !stateDefinition.includes("setup_required") ||
    !stateDefinition.includes("temporary") ||
    !stateDefinition.includes("active") ||
    constraintMap.get("users_password_set_by_fkey")?.contype !== "f" ||
    !constraintMap.get("users_password_set_by_fkey")?.convalidated ||
    !passwordSetterDefinition.includes("foreign key (password_set_by) references users(id) on delete set null") ||
    constraintMap.get("users_student_login_key_check")?.contype !== "c" ||
    !loginKeyDefinition.includes("role") ||
    !loginKeyDefinition.includes("student") ||
    !loginKeyDefinition.includes("login_key is not null") ||
    (options.requireLoginKeyConstraintValidated &&
      !constraintMap.get("users_student_login_key_check")?.convalidated)
  ) {
    throw new Error("Existing auth constraints are unsafe");
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
}

async function dryRun() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query("SELECT pg_advisory_xact_lock($1)", [LOCK_KEY]);
    const inspection = await inspectLockedDatabase(client);
    console.log("Auth migration dry-run", {
      migrationId: MIGRATION_ID,
      roleCounts: inspection.roleCounts,
      students: inspection.students.length,
      records: inspection.totalRecords,
      ownerlessRecords: inspection.ownerlessRecords,
      databaseChanges: 0,
    });
    await client.query("ROLLBACK");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function apply() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query("SELECT pg_advisory_xact_lock($1)", [LOCK_KEY]);
    const inspection = await inspectLockedDatabase(client);

    await client.query(APPLY_SQL);
    await validateCreatedSchema(client);
    const adminAuthBefore = await client.query<AdminAuthSnapshot>(
      `SELECT id, username, password, is_active, role, credential_state, auth_version
       FROM users WHERE role = 'admin' ORDER BY id FOR UPDATE`,
    );
    if (
      adminAuthBefore.rows.length !== inspection.admins.length ||
      adminAuthBefore.rows.some((admin) =>
        admin.credential_state !== "active" ||
        !Number.isInteger(admin.auth_version) ||
        admin.auth_version < 1 ||
        !/^\$2[aby]\$\d\d\$.{53}$/.test(admin.password)
      )
    ) {
      throw new Error("Active administrator credentials are required; refusing auth migration");
    }
    await client.query(`
      CREATE TABLE IF NOT EXISTS auth_migration_history (
        migration_id text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamp NOT NULL DEFAULT now()
      )
    `);
    const ledger = await client.query<{ checksum: string }>(
      "SELECT checksum FROM auth_migration_history WHERE migration_id = $1 FOR UPDATE",
      [MIGRATION_ID],
    );
    if (ledger.rows[0]) {
      if (ledger.rows[0].checksum !== CHECKSUM) {
        throw new Error("Applied auth migration checksum does not match this runner");
      }
      await client.query("COMMIT");
      console.log("Auth migration already applied; no changes made");
      return;
    }

    for (const student of inspection.students) {
      const result = await client.query(
        `UPDATE users
         SET login_key = $1,
             credential_state = 'setup_required',
             auth_version = auth_version + 1,
             password = $2,
             password_set_by = NULL
         WHERE id = $3 AND role = 'student'`,
        [normalizeFullName(student.username), PASSWORD_SENTINEL, student.id],
      );
      if (result.rowCount !== 1) throw new Error("Student set changed during auth migration");
    }
    await client.query(LOGIN_KEY_INDEX_SQL);
    await client.query("ALTER TABLE users VALIDATE CONSTRAINT users_student_login_key_check");
    await validateCreatedSchema(client, { requireLoginKeyConstraintValidated: true });

    const verification = await client.query<{
      students: string;
      setup: string;
      sentinel: string;
      records: string;
      ownerless: string;
    }>(`
      SELECT
        (SELECT count(*)::text FROM users WHERE role = 'student') AS students,
        (SELECT count(*)::text FROM users WHERE role = 'student' AND credential_state = 'setup_required') AS setup,
        (SELECT count(*)::text FROM users WHERE role = 'student' AND password = $1) AS sentinel,
        (SELECT count(*)::text FROM swim_records) AS records,
        (SELECT count(*)::text FROM swim_records WHERE student_id IS NULL) AS ownerless
    `, [PASSWORD_SENTINEL]);
    const result = verification.rows[0];
    if (
      !result ||
      Number(result.students) !== inspection.students.length ||
      result.students !== result.setup ||
      result.students !== result.sentinel ||
      Number(result.records) !== inspection.totalRecords ||
      Number(result.ownerless) !== inspection.ownerlessRecords
    ) {
      throw new Error("Post-migration verification failed");
    }
    const adminCheck = await client.query<AdminAuthSnapshot>(
      `SELECT id, username, password, is_active, role, credential_state, auth_version
       FROM users WHERE role = 'admin' ORDER BY id`,
    );
    if (
      JSON.stringify(inspection.admins) !== JSON.stringify(adminCheck.rows.map((admin) => ({
        id: admin.id,
        username: admin.username,
        password: admin.password,
        is_active: admin.is_active,
        role: admin.role,
      }))) ||
      JSON.stringify(adminAuthBefore.rows) !== JSON.stringify(adminCheck.rows)
    ) {
      throw new Error("Admin credentials changed during auth migration");
    }
    await client.query(
      "INSERT INTO auth_migration_history (migration_id, checksum) VALUES ($1, $2)",
      [MIGRATION_ID, CHECKSUM],
    );
    await client.query("COMMIT");
    console.log("Auth migration applied", {
      students: inspection.students.length,
      records: inspection.totalRecords,
      ownerlessRecords: inspection.ownerlessRecords,
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function run(argv = process.argv.slice(2)) {
  const unknownFlags = argv.filter((arg) => arg !== "--apply");
  if (unknownFlags.length) throw new Error(`Unknown arguments: ${unknownFlags.join(", ")}`);
  if (!argv.includes("--apply")) return dryRun();
  return apply();
}

if (process.argv[1]?.endsWith("auth-migration.ts")) {
  run()
    .catch((error) => {
      console.error(error instanceof Error ? error.message : "Auth migration failed");
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
