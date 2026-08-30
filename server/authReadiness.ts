import { pool } from "db";
import { CHECKSUM, MIGRATION_ID } from "../scripts/auth-migration";

export async function assertAuthSchemaReady() {
  const result = await pool.query<{
    users_table: string | null;
    sessions_table: string | null;
    auth_attempts_table: string | null;
    history_table: string | null;
    auth_columns: string;
    auth_attempt_columns: string;
    required_constraints: string;
    auth_attempt_constraints: string;
    required_indexes: string;
    invalid_users: string;
    checksum: string | null;
  }>(`
    SELECT
      to_regclass('public.users')::text AS users_table,
      to_regclass('public.swimtrack_sessions')::text AS sessions_table,
      to_regclass('public.swimtrack_auth_attempts')::text AS auth_attempts_table,
      to_regclass('public.auth_migration_history')::text AS history_table,
      (
        SELECT count(*)::text
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users'
          AND column_name IN ('login_key', 'credential_state', 'auth_version', 'password_set_by')
      ) AS auth_columns,
      (
        SELECT count(*)::text
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'swimtrack_auth_attempts'
          AND column_name IN ('key_hash', 'attempt_count', 'reset_at')
      ) AS auth_attempt_columns,
      (
        SELECT count(*)::text
        FROM pg_constraint
        WHERE conrelid = 'public.users'::regclass
          AND convalidated
          AND conname IN (
            'users_credential_state_check',
            'users_password_set_by_fkey',
            'users_student_login_key_check'
          )
      ) AS required_constraints,
      (
        SELECT count(*)::text
        FROM pg_constraint
        WHERE conrelid = to_regclass('public.swimtrack_auth_attempts')
          AND convalidated
          AND conname = 'swimtrack_auth_attempts_count_check'
          AND lower(pg_get_constraintdef(oid)) LIKE '%attempt_count > 0%'
      ) AS auth_attempt_constraints,
      (
        SELECT count(*)::text
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname IN (
            'users_student_login_key_unique',
            'swimtrack_sessions_expire_idx',
            'swimtrack_auth_attempts_reset_idx'
          )
      ) AS required_indexes,
      (
        SELECT count(*)::text
        FROM users
        WHERE credential_state NOT IN ('setup_required', 'temporary', 'active')
          OR auth_version < 1
          OR (role = 'student' AND login_key IS NULL)
      ) AS invalid_users,
      (
        SELECT checksum
        FROM auth_migration_history
        WHERE migration_id = $1
      ) AS checksum
  `, [MIGRATION_ID]);

  const row = result.rows[0];
  if (
    !row?.users_table ||
    !row.sessions_table ||
    !row.auth_attempts_table ||
    !row.history_table ||
    row.auth_columns !== "4" ||
    row.auth_attempt_columns !== "3" ||
    row.required_constraints !== "3" ||
    row.auth_attempt_constraints !== "1" ||
    row.required_indexes !== "3" ||
    row.invalid_users !== "0" ||
    row.checksum !== CHECKSUM
  ) {
    throw new Error("SwimTrack authentication schema is not ready; run the dedicated auth migration");
  }

  const constraints = await pool.query<{ conname: string; definition: string }>(`
    SELECT conname, lower(pg_get_constraintdef(oid)) AS definition
    FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass
      AND conname IN (
        'users_credential_state_check',
        'users_password_set_by_fkey',
        'users_student_login_key_check'
      )
  `);
  const definitions = new Map(constraints.rows.map((constraint) => [constraint.conname, constraint.definition]));
  const stateDefinition = definitions.get("users_credential_state_check") ?? "";
  const setterDefinition = definitions.get("users_password_set_by_fkey") ?? "";
  const loginKeyDefinition = definitions.get("users_student_login_key_check") ?? "";
  if (
    !stateDefinition.includes("credential_state") ||
    !stateDefinition.includes("setup_required") ||
    !stateDefinition.includes("temporary") ||
    !stateDefinition.includes("active") ||
    !setterDefinition.includes("foreign key (password_set_by) references users(id) on delete set null") ||
    !loginKeyDefinition.includes("role") ||
    !loginKeyDefinition.includes("student") ||
    !loginKeyDefinition.includes("login_key is not null")
  ) {
    throw new Error("SwimTrack authentication constraints do not match the required definitions");
  }
}
