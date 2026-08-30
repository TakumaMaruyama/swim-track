import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, pool } from "db";
import { users } from "db/schema";
import bcrypt from "bcryptjs";
import type { Express, NextFunction, Request, Response } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import configuration from "./config";
import { normalizeFullName } from "./fullName";
import { validateNewPassword } from "./passwordPolicy";

export { normalizeFullName };

export type CredentialState = "setup_required" | "temporary" | "active";

declare module "express-session" {
  interface SessionData {
    userId?: number;
    role?: string;
    authVersion?: number;
    credentialState?: CredentialState;
    pendingSetupUserId?: number;
    pendingSetupAuthVersion?: number;
    pendingSetupIssuedAt?: number;
  }
}

declare global {
  namespace Express {
    interface Request {
      authUser?: {
        id: number;
        role: string;
        gender: string;
        credentialState: CredentialState;
        authVersion: number;
      };
    }
  }
}

const GENERIC_AUTH_FAILURE = "認証に失敗しました";
const SESSION_COOKIE_NAME = "swimtrack.sid";
const SESSION_TABLE_NAME = "swimtrack_sessions";
const SETUP_SESSION_TTL_MS = 10 * 60 * 1000;
const AUTH_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const AUTH_ATTEMPT_LIMIT = 20;
const IP_AUTH_ATTEMPT_LIMIT = 100;
const AUTH_IDENTITY_MAX_CHARACTERS = 100;

const authUserColumns = {
  id: users.id,
  username: users.username,
  password: users.password,
  credentialState: users.credentialState,
  authVersion: users.authVersion,
  role: users.role,
  isActive: users.isActive,
  gender: users.gender,
};

type AuthUser = Pick<
  typeof users.$inferSelect,
  "id" | "username" | "password" | "credentialState" | "authVersion" | "role" | "isActive" | "gender"
>;

function isCredentialState(value: string): value is CredentialState {
  return value === "setup_required" || value === "temporary" || value === "active";
}

function authResponseUser(user: AuthUser) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    isActive: user.isActive,
    gender: user.gender,
    credentialState: user.credentialState,
    mustChangePassword: user.credentialState === "temporary",
  };
}

function regenerate(req: Request): Promise<void> {
  return new Promise((resolve, reject) =>
    req.session.regenerate((error) => (error ? reject(error) : resolve())),
  );
}

function save(req: Request): Promise<void> {
  return new Promise((resolve, reject) =>
    req.session.save((error) => (error ? reject(error) : resolve())),
  );
}

function destroy(req: Request): Promise<void> {
  return new Promise((resolve, reject) =>
    req.session.destroy((error) => (error ? reject(error) : resolve())),
  );
}

function clearPendingSetup(req: Request) {
  const hadPending = req.session.pendingSetupUserId !== undefined;
  delete req.session.pendingSetupUserId;
  delete req.session.pendingSetupAuthVersion;
  delete req.session.pendingSetupIssuedAt;
  return hadPending;
}

async function consumeAuthAttempt(
  req: Request,
  identity: unknown,
) {
  const rawIdentity = typeof identity === "string" ? Array.from(identity) : [];
  const normalizedIdentity = rawIdentity.length > AUTH_IDENTITY_MAX_CHARACTERS
    ? "<too-long>"
    : normalizeFullName(rawIdentity.join("")) || "<invalid>";
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const hashes = [
    createHash("sha256").update(`ip:${ip}`).digest("hex"),
    createHash("sha256").update(`identity:${ip}:${normalizedIdentity}`).digest("hex"),
  ];
  const result = await pool.query<{ key_hash: string; attempt_count: number }>(`
    WITH purged AS (
      DELETE FROM swimtrack_auth_attempts
      WHERE reset_at < now() - interval '1 day'
    )
    INSERT INTO swimtrack_auth_attempts (key_hash, attempt_count, reset_at)
    VALUES
      ($1, 1, now() + ($3::bigint * interval '1 millisecond')),
      ($2, 1, now() + ($3::bigint * interval '1 millisecond'))
    ON CONFLICT (key_hash) DO UPDATE SET
      attempt_count = CASE
        WHEN swimtrack_auth_attempts.reset_at <= now() THEN 1
        ELSE swimtrack_auth_attempts.attempt_count + 1
      END,
      reset_at = CASE
        WHEN swimtrack_auth_attempts.reset_at <= now()
          THEN now() + ($3::bigint * interval '1 millisecond')
        ELSE swimtrack_auth_attempts.reset_at
      END
    RETURNING key_hash, attempt_count
  `, [hashes[0], hashes[1], AUTH_ATTEMPT_WINDOW_MS]);
  const attemptsByKey = new Map(result.rows.map((row) => [row.key_hash, Number(row.attempt_count)]));
  return (
    (attemptsByKey.get(hashes[0]) ?? IP_AUTH_ATTEMPT_LIMIT + 1) > IP_AUTH_ATTEMPT_LIMIT ||
    (attemptsByKey.get(hashes[1]) ?? AUTH_ATTEMPT_LIMIT + 1) > AUTH_ATTEMPT_LIMIT
  );
}

function rateLimited(res: Response) {
  res.setHeader("Retry-After", String(Math.ceil(AUTH_ATTEMPT_WINDOW_MS / 1000)));
  return res.status(429).json({ ok: false, message: GENERIC_AUTH_FAILURE });
}

async function findUniqueStudentByFullName(fullName: unknown) {
  if (typeof fullName !== "string") return null;
  if (Array.from(fullName).length > AUTH_IDENTITY_MAX_CHARACTERS) return null;
  const loginKey = normalizeFullName(fullName);
  if (!loginKey) return null;
  const matches = await db
    .select(authUserColumns)
    .from(users)
    .where(and(eq(users.role, "student"), eq(users.loginKey, loginKey)))
    .limit(2);
  return matches.length === 1 ? matches[0] : null;
}

async function establishSession(req: Request, user: AuthUser) {
  try {
    await regenerate(req);
  } catch (error) {
    logSessionFailure("regenerate", error);
    throw error;
  }
  req.session.userId = user.id;
  req.session.role = user.role;
  req.session.authVersion = user.authVersion;
  req.session.credentialState = user.credentialState as CredentialState;
  try {
    await save(req);
  } catch (error) {
    logSessionFailure("save", error);
    throw error;
  }
}

function logSessionFailure(stage: "regenerate" | "save", error: unknown) {
  const candidate = error as {
    name?: unknown;
    message?: unknown;
    code?: unknown;
    table?: unknown;
    constraint?: unknown;
  } | null;
  console.error("SwimTrack session establishment failed", {
    stage,
    name: typeof candidate?.name === "string" ? candidate.name : "UnknownError",
    message: typeof candidate?.message === "string" ? candidate.message : "Unknown error",
    code: typeof candidate?.code === "string" ? candidate.code : undefined,
    table: typeof candidate?.table === "string" ? candidate.table : undefined,
    constraint: typeof candidate?.constraint === "string" ? candidate.constraint : undefined,
  });
}

function logAuthRouteFailure(route: string, stage: string, error: unknown) {
  const candidate = error as { name?: unknown; message?: unknown; code?: unknown } | null;
  console.error("SwimTrack authentication route failed", {
    route,
    stage,
    name: typeof candidate?.name === "string" ? candidate.name : "UnknownError",
    message: typeof candidate?.message === "string" ? candidate.message : "Unknown error",
    code: typeof candidate?.code === "string" ? candidate.code : undefined,
  });
}

export async function revalidateSession(req: Request) {
  if (!req.session.userId || req.session.authVersion === undefined) return null;
  const [user] = await db
    .select(authUserColumns)
    .from(users)
    .where(eq(users.id, req.session.userId))
    .limit(1);
  if (
    !user ||
    !user.isActive ||
    !isCredentialState(user.credentialState) ||
    user.authVersion !== req.session.authVersion ||
    user.role !== req.session.role
  ) {
    await destroy(req).catch(() => undefined);
    return null;
  }
  req.authUser = {
    id: user.id,
    role: user.role,
    gender: user.gender,
    credentialState: user.credentialState,
    authVersion: user.authVersion,
  };
  return user;
}

export async function requireAuthenticated(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await revalidateSession(req);
    if (!user) return res.status(401).json({ ok: false, message: "未認証です" });
    if (user.credentialState !== "active") {
      return res.status(403).json({
        ok: false,
        credentialState: user.credentialState,
        message: "パスワードの変更が必要です",
      });
    }
    next();
  } catch {
    res.status(500).json({ ok: false, message: "認証状態を確認できませんでした" });
  }
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  await requireAuthenticated(req, res, () => {
    if (req.authUser?.role !== "admin") {
      return res.status(403).json({ ok: false, message: "管理者権限が必要です" });
    }
    next();
  });
}

export const configureAuth = (app: Express, options?: { store?: session.Store }) => {
  if (!configuration.sessionSecret) throw new Error("SESSION_SECRET is required");
  if (!configuration.databaseUrl) throw new Error("DATABASE_URL is required");

  if (configuration.nodeEnv === "production") app.set("trust proxy", 1);
  const PgStore = connectPgSimple(session);
  app.use(
    session({
      name: SESSION_COOKIE_NAME,
      secret: configuration.sessionSecret,
      resave: false,
      saveUninitialized: false,
      store: options?.store ?? new PgStore({
        pool,
        tableName: SESSION_TABLE_NAME,
        createTableIfMissing: false,
      }),
      cookie: {
        secure: configuration.nodeEnv === "production",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000,
      },
    }),
  );

  app.use("/api/auth", async (req, res, next) => {
    if (!req.session.userId) return next();
    try {
      const user = await revalidateSession(req);
      if (!user) return res.status(401).json({ ok: false, message: "未認証です" });
      if (
        user.credentialState === "temporary" &&
        !["/athlete/password", "/logout", "/session"].includes(req.path)
      ) {
        return res.status(403).json({
          ok: false,
          credentialState: "temporary",
          message: "パスワードの変更が必要です",
        });
      }
      next();
    } catch {
      res.status(500).json({ ok: false, message: "認証状態を確認できませんでした" });
    }
  });

  app.post("/api/auth/athlete/start", async (req, res) => {
    try {
      const fullName = req.body.fullName;
      if (await consumeAuthAttempt(req, fullName)) return rateLimited(res);
      const hadPending = clearPendingSetup(req);
      const user = await findUniqueStudentByFullName(fullName);
      if (!user || !user.isActive || !isCredentialState(user.credentialState)) {
        if (hadPending) await save(req);
        return res.status(401).json({ ok: false, message: GENERIC_AUTH_FAILURE });
      }
      if (user.credentialState !== "setup_required") {
        if (hadPending) await save(req);
        return res.json({
          ok: true,
          credentialState: user.credentialState,
          requiresPasswordSetup: false,
        });
      }
      await regenerate(req);
      req.session.pendingSetupUserId = user.id;
      req.session.pendingSetupAuthVersion = user.authVersion;
      req.session.pendingSetupIssuedAt = Date.now();
      await save(req);
      return res.json({
        ok: true,
        credentialState: "setup_required",
        requiresPasswordSetup: true,
      });
    } catch {
      res.status(500).json({ ok: false, message: "認証処理中にエラーが発生しました" });
    }
  });

  app.post("/api/auth/athlete/login", async (req, res) => {
    try {
      const { fullName, password } = req.body;
      if (await consumeAuthAttempt(req, fullName)) return rateLimited(res);
      const hadPending = clearPendingSetup(req);
      const user = await findUniqueStudentByFullName(fullName);
      if (
        !user ||
        !user.isActive ||
        user.credentialState === "setup_required" ||
        typeof password !== "string" ||
        !(await bcrypt.compare(password, user.password))
      ) {
        if (hadPending) await save(req);
        return res.status(401).json({ ok: false, message: GENERIC_AUTH_FAILURE });
      }
      await establishSession(req, user);
      res.json({
        ok: true,
        user: authResponseUser(user),
        credentialState: user.credentialState,
        mustChangePassword: user.credentialState === "temporary",
      });
    } catch {
      res.status(500).json({ ok: false, message: "ログイン処理中にエラーが発生しました" });
    }
  });

  app.post("/api/auth/athlete/password", async (req, res) => {
    try {
      const confirmation = req.body.passwordConfirmation ?? req.body.confirmPassword;
      const validationError = validateNewPassword(req.body.password, confirmation);
      if (validationError) return res.status(400).json({ ok: false, message: validationError });

      const authenticated = await revalidateSession(req);
      if (authenticated) {
        if (authenticated.role !== "student" || authenticated.credentialState !== "temporary") {
          return res.status(401).json({ ok: false, message: GENERIC_AUTH_FAILURE });
        }
        const [updated] = await db
          .update(users)
          .set({
            password: await hashPassword(req.body.password),
            credentialState: "active",
            passwordSetBy: authenticated.id,
            authVersion: authenticated.authVersion + 1,
          })
          .where(and(
            eq(users.id, authenticated.id),
            eq(users.role, "student"),
            eq(users.authVersion, authenticated.authVersion),
            eq(users.credentialState, "temporary"),
            eq(users.isActive, true),
          ))
          .returning(authUserColumns);
        if (!updated) return res.status(401).json({ ok: false, message: GENERIC_AUTH_FAILURE });
        await establishSession(req, updated);
        return res.json({
          ok: true,
          user: authResponseUser(updated),
          credentialState: "active",
          mustChangePassword: false,
        });
      }

      const pendingUserId = req.session.pendingSetupUserId;
      const pendingVersion = req.session.pendingSetupAuthVersion;
      const issuedAt = req.session.pendingSetupIssuedAt;
      if (
        !pendingUserId ||
        pendingVersion === undefined ||
        issuedAt === undefined ||
        Date.now() - issuedAt > SETUP_SESSION_TTL_MS
      ) {
        clearPendingSetup(req);
        await save(req).catch(() => undefined);
        return res.status(401).json({ ok: false, message: GENERIC_AUTH_FAILURE });
      }
      const [updated] = await db
        .update(users)
        .set({
          password: await hashPassword(req.body.password),
          credentialState: "active",
          passwordSetBy: pendingUserId,
          authVersion: pendingVersion + 1,
        })
        .where(and(
          eq(users.id, pendingUserId),
          eq(users.role, "student"),
          eq(users.authVersion, pendingVersion),
          eq(users.credentialState, "setup_required"),
          eq(users.isActive, true),
        ))
        .returning(authUserColumns);
      if (!updated) {
        clearPendingSetup(req);
        await save(req).catch(() => undefined);
        return res.status(401).json({ ok: false, message: GENERIC_AUTH_FAILURE });
      }
      await establishSession(req, updated);
      return res.json({
        ok: true,
        user: authResponseUser(updated),
        credentialState: "active",
        mustChangePassword: false,
      });
    } catch {
      res.status(500).json({ ok: false, message: "パスワード設定中にエラーが発生しました" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    let stage = "rate-limit";
    try {
      const { username, password } = req.body;
      if (await consumeAuthAttempt(req, username)) return rateLimited(res);
      if (typeof username !== "string" || typeof password !== "string") {
        return res.status(401).json({ ok: false, message: GENERIC_AUTH_FAILURE });
      }
      stage = "admin-query";
      const [admin] = await db
        .select(authUserColumns)
        .from(users)
        .where(and(eq(users.username, username), eq(users.role, "admin")))
        .limit(1);
      if (
        !admin ||
        !admin.isActive ||
        admin.credentialState !== "active"
      ) {
        return res.status(401).json({ ok: false, message: GENERIC_AUTH_FAILURE });
      }
      stage = "password-compare";
      if (!(await bcrypt.compare(password, admin.password))) {
        return res.status(401).json({ ok: false, message: GENERIC_AUTH_FAILURE });
      }
      stage = "session";
      await establishSession(req, admin);
      res.json({ ok: true, user: authResponseUser(admin), credentialState: "active" });
    } catch (error) {
      logAuthRouteFailure("admin-login", stage, error);
      res.status(500).json({ ok: false, message: "ログイン処理中にエラーが発生しました" });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    let destroyError: unknown;
    try {
      await destroy(req);
    } catch (error) {
      destroyError = error;
    }
    res.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      sameSite: "lax",
      secure: configuration.nodeEnv === "production",
      path: "/",
    });
    if (destroyError) {
      console.error("Failed to destroy SwimTrack session");
      return res.status(500).json({ ok: false, message: "ログアウトに失敗しました" });
    }
    res.json({ ok: true, message: "ログアウトしました" });
  });

  app.get("/api/auth/session", async (req, res) => {
    try {
      const user = await revalidateSession(req);
      if (!user) return res.status(401).json({ ok: false, message: "未認証です" });
      res.json({
        ok: true,
        user: authResponseUser(user),
        credentialState: user.credentialState,
        mustChangePassword: user.credentialState === "temporary",
      });
    } catch {
      res.status(500).json({ ok: false, message: "セッション確認中にエラーが発生しました" });
    }
  });

  app.get("/api/users/passwords", requireAdmin, async (_req, res) => {
    const rows = await db.select({
      id: users.id,
      username: users.username,
      role: users.role,
      isActive: users.isActive,
      credentialState: users.credentialState,
    }).from(users);
    res.json(rows);
  });

  const setTemporaryPassword = async (req: Request, res: Response) => {
    const userId = Number.parseInt(req.params.id, 10);
    const validationError = validateNewPassword(req.body.password, req.body.password);
    if (!Number.isFinite(userId) || validationError) {
      return res.status(400).json({ message: validationError || "無効な選手IDです" });
    }
    const [target] = await db
      .select({ id: users.id, authVersion: users.authVersion })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.role, "student")))
      .limit(1);
    if (!target) return res.status(404).json({ message: "選手が見つかりません" });
    const [updated] = await db
      .update(users)
      .set({
        password: await hashPassword(req.body.password),
        credentialState: "temporary",
        passwordSetBy: req.authUser!.id,
        authVersion: target.authVersion + 1,
      })
      .where(and(
        eq(users.id, userId),
        eq(users.role, "student"),
        eq(users.authVersion, target.authVersion),
      ))
      .returning(authUserColumns);
    if (!updated) return res.status(409).json({ message: "選手情報が更新されました。再試行してください" });
    return res.json(authResponseUser(updated));
  };
  app.put("/api/admin/athletes/:id/temporary-password", requireAdmin, setTemporaryPassword);
  app.put("/api/users/:id/password", requireAdmin, setTemporaryPassword);

  app.use("/api", (req, res, next) => {
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
    return requireAuthenticated(req, res, next);
  });
};

export const hashPassword = async (password: string): Promise<string> => bcrypt.hash(password, 10);
