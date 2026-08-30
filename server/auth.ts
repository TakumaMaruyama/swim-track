import { and, eq } from "drizzle-orm";
import { db, pool } from "db";
import { users } from "db/schema";
import bcrypt from "bcryptjs";
import type { Express, NextFunction, Request, Response } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import configuration from "./config";
import { normalizeFullName } from "./fullName";
export { normalizeFullName };

export type AuthState = "initial_setup" | "active" | "temp_password";

declare module "express-session" {
  interface SessionData {
    userId?: number;
    role?: string;
    sessionVersion?: number;
    authState?: AuthState;
    pendingSetupUserId?: number;
    pendingSetupVersion?: number;
  }
}

declare global {
  namespace Express {
    interface Request {
      authUser?: {
        id: number;
        role: string;
        authState: AuthState;
        sessionVersion: number;
      };
    }
  }
}

const GENERIC_AUTH_FAILURE = "認証に失敗しました";
const PASSWORD_MIN_LENGTH = 6;
const SESSION_COOKIE_NAME = "swimtrack.sid";
const SESSION_TABLE_NAME = "swimtrack_sessions";

function publicUser<T extends { password: string }>(user: T) {
  const { password: _password, ...safe } = user;
  return safe;
}

function authResponseUser<T extends { password: string; authState: string }>(user: T) {
  return {
    ...publicUser(user),
    mustChangePassword: user.authState === "temp_password",
    passwordState: user.authState === "temp_password" ? "temporary" : user.authState,
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

async function findUniqueStudentByFullName(fullName: unknown) {
  if (typeof fullName !== "string" || !normalizeFullName(fullName)) return null;
  const normalized = normalizeFullName(fullName);
  const candidates = await db
    .select()
    .from(users)
    .where(and(eq(users.role, "student"), eq(users.loginKey, normalized)));
  const matches = candidates.filter((user) => user.loginKey === normalized);
  return matches.length === 1 ? matches[0] : null;
}

async function establishSession(req: Request, user: typeof users.$inferSelect) {
  await regenerate(req);
  req.session.userId = user.id;
  req.session.role = user.role;
  req.session.sessionVersion = user.sessionVersion;
  req.session.authState = user.authState as AuthState;
  await save(req);
}

export async function revalidateSession(req: Request) {
  if (!req.session.userId || req.session.sessionVersion === undefined) return null;
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, req.session.userId))
    .limit(1);
  if (
    !user ||
    !user.isActive ||
    user.sessionVersion !== req.session.sessionVersion ||
    user.role !== req.session.role
  ) {
    await destroy(req).catch(() => undefined);
    return null;
  }
  req.authUser = {
    id: user.id,
    role: user.role,
    authState: user.authState as AuthState,
    sessionVersion: user.sessionVersion,
  };
  return user;
}

export async function requireAuthenticated(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await revalidateSession(req);
    if (!user) return res.status(401).json({ ok: false, message: "未認証です" });
    if (user.authState === "temp_password") {
      return res.status(403).json({
        ok: false,
        state: "temp_password",
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
  if (!configuration.sessionSecret) {
    throw new Error("SESSION_SECRET is required");
  }
  if (!configuration.databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

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

  // A temporary-password session is deliberately useful only for completing
  // its mandatory password change, checking state, or logging out.
  app.use("/api/auth", async (req, res, next) => {
    if (!req.session.userId) return next();
    try {
      const user = await revalidateSession(req);
      if (!user) return res.status(401).json({ ok: false, message: "未認証です" });
      if (
        user.authState === "temp_password" &&
        !["/change-password", "/change-temp-password", "/logout", "/session"].includes(req.path)
      ) {
        return res.status(403).json({ ok: false, state: "temp_password", message: "パスワードの変更が必要です" });
      }
      next();
    } catch {
      res.status(500).json({ ok: false, message: "認証状態を確認できませんでした" });
    }
  });

  const identityCheck = async (req: Request, res: Response) => {
    try {
      const fullName = req.body.fullName ?? req.body.username;
      const user = await findUniqueStudentByFullName(fullName);
      if (!user || !user.isActive) {
        return res.status(401).json({ ok: false, message: GENERIC_AUTH_FAILURE });
      }
      if (user.authState !== "initial_setup") {
        return res.json({ ok: true, authState: "active", requiresPasswordSetup: false });
      }
      await regenerate(req);
      req.session.pendingSetupUserId = user.id;
      req.session.pendingSetupVersion = user.sessionVersion;
      await save(req);
      res.json({
        ok: true,
        state: "initial_setup",
        authState: "initial_setup",
        requiresPasswordSetup: true,
      });
    } catch {
      res.status(500).json({ ok: false, message: "認証処理中にエラーが発生しました" });
    }
  };
  app.post("/api/auth/identity-check", identityCheck);
  app.post("/api/auth/check-identity", identityCheck);
  app.post("/api/auth/identify", identityCheck);

  const initialPassword = async (req: Request, res: Response) => {
    try {
      const { password, passwordConfirmation, confirmPassword } = req.body;
      const confirmation = passwordConfirmation ?? confirmPassword;
      if (typeof password !== "string" || password.length < PASSWORD_MIN_LENGTH || password !== confirmation) {
        return res.status(400).json({ ok: false, message: "パスワードは6文字以上で確認入力と一致させてください" });
      }
      if (!req.session.pendingSetupUserId || req.session.pendingSetupVersion === undefined) {
        return res.status(401).json({ ok: false, message: GENERIC_AUTH_FAILURE });
      }
      const [user] = await db
        .update(users)
        .set({
          password: await hashPassword(password),
          authState: "active",
          passwordUpdatedAt: new Date(),
          passwordSetBy: req.session.pendingSetupUserId,
          sessionVersion: req.session.pendingSetupVersion + 1,
        })
        .where(and(
          eq(users.id, req.session.pendingSetupUserId),
          eq(users.sessionVersion, req.session.pendingSetupVersion),
          eq(users.authState, "initial_setup"),
          eq(users.isActive, true),
        ))
        .returning();
      if (!user) return res.status(401).json({ ok: false, message: GENERIC_AUTH_FAILURE });
      await establishSession(req, user);
      res.json({ ok: true, user: authResponseUser(user), authState: user.authState });
    } catch {
      res.status(500).json({ ok: false, message: "パスワード設定中にエラーが発生しました" });
    }
  };
  app.post("/api/auth/initial-password", initialPassword);
  app.post("/api/auth/setup-password", initialPassword);

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const identity = req.body.fullName ?? req.body.username;
      const password = req.body.password;
      if (typeof identity !== "string" || typeof password !== "string") {
        return res.status(401).json({ ok: false, message: GENERIC_AUTH_FAILURE });
      }
      let user;
      const student = await findUniqueStudentByFullName(identity);
      if (student) {
        user = student;
      } else if (req.body.fullName === undefined) {
        const admins = await db.select().from(users).where(and(eq(users.username, identity), eq(users.role, "admin"))).limit(1);
        user = admins[0];
      }
      if (!user || !user.isActive || user.authState === "initial_setup" || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ ok: false, message: GENERIC_AUTH_FAILURE });
      }
      const [updated] = await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id)).returning();
      await establishSession(req, updated);
      res.json({
        ok: true,
        user: authResponseUser(updated),
        state: updated.authState,
        authState: updated.authState,
        mustChangePassword: updated.authState === "temp_password",
      });
    } catch {
      res.status(500).json({ ok: false, message: "ログイン処理中にエラーが発生しました" });
    }
  });

  const changeTempPassword = async (req: Request, res: Response) => {
    try {
      const user = await revalidateSession(req);
      if (!user || user.authState !== "temp_password") {
        return res.status(401).json({ ok: false, message: GENERIC_AUTH_FAILURE });
      }
      const { password, passwordConfirmation, confirmPassword } = req.body;
      const confirmation = passwordConfirmation ?? confirmPassword;
      if (typeof password !== "string" || password.length < PASSWORD_MIN_LENGTH || password !== confirmation) {
        return res.status(400).json({ ok: false, message: "パスワードは6文字以上で確認入力と一致させてください" });
      }
      const [updated] = await db.update(users).set({
        password: await hashPassword(password),
        authState: "active",
        passwordUpdatedAt: new Date(),
        passwordSetBy: user.id,
        sessionVersion: user.sessionVersion + 1,
      }).where(and(eq(users.id, user.id), eq(users.sessionVersion, user.sessionVersion))).returning();
      if (!updated) return res.status(401).json({ ok: false, message: GENERIC_AUTH_FAILURE });
      await establishSession(req, updated);
      res.json({ ok: true, user: authResponseUser(updated), authState: updated.authState });
    } catch {
      res.status(500).json({ ok: false, message: "パスワード変更中にエラーが発生しました" });
    }
  };
  app.post("/api/auth/change-temp-password", changeTempPassword);
  app.post("/api/auth/change-password", changeTempPassword);

  app.post("/api/auth/logout", async (req, res) => {
    await destroy(req).catch(() => undefined);
    res.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      sameSite: "lax",
      secure: configuration.nodeEnv === "production",
      path: "/",
    });
    res.json({ ok: true, message: "ログアウトしました" });
  });

  app.get("/api/auth/session", async (req, res) => {
    try {
      const user = await revalidateSession(req);
      if (!user) return res.status(401).json({ ok: false, message: "未認証です" });
      res.json({
        ok: true,
        user: authResponseUser(user),
        state: user.authState,
        authState: user.authState,
        mustChangePassword: user.authState === "temp_password",
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
      authState: users.authState,
      passwordUpdatedAt: users.passwordUpdatedAt,
    }).from(users);
    res.json(rows);
  });

  app.put("/api/users/:id/password", requireAdmin, async (req, res) => {
    const userId = Number.parseInt(req.params.id, 10);
    const password = req.body.password;
    if (!Number.isFinite(userId) || typeof password !== "string" || password.length < PASSWORD_MIN_LENGTH) {
      return res.status(400).json({ message: "パスワードは6文字以上で指定してください" });
    }
    const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!target) return res.status(404).json({ message: "ユーザーが見つかりません" });
    const [updated] = await db.update(users).set({
      password: await hashPassword(password),
      authState: target.role === "student" ? "temp_password" : "active",
      passwordUpdatedAt: new Date(),
      passwordSetBy: req.authUser!.id,
      sessionVersion: target.sessionVersion + 1,
    }).where(and(eq(users.id, userId), eq(users.sessionVersion, target.sessionVersion))).returning();
    if (!updated) return res.status(409).json({ message: "ユーザー情報が更新されました。再試行してください" });
    res.json(authResponseUser(updated));
  });

  // Public read APIs remain public for backward compatibility. Every write is
  // authenticated and DB-revalidated here before route-specific role/ownership checks.
  app.use("/api", (req, res, next) => {
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
    return requireAuthenticated(req, res, next);
  });
};

export const hashPassword = async (password: string): Promise<string> => bcrypt.hash(password, 10);