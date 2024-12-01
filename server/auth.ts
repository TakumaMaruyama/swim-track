import passport from "passport";
import { IVerifyOptions, Strategy as LocalStrategy } from "passport-local";
import { type Express } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import { users, insertUserSchema, type User as SelectUser } from "db/schema";
import { db } from "db";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { z } from "zod";

// 認証用の固定値
const ADMIN_USERNAME = "丸山拓真";
const ADMIN_PASSWORD = "dpjm3756";
const GENERAL_PASSWORD = "seiji";

// セッション設定
const SESSION_MAX_AGE = 12 * 60 * 60 * 1000; // 12時間
const SESSION_REFRESH_THRESHOLD = 15 * 60 * 1000; // 15分

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

// 条件付きバリデーションスキーマ
const loginSchema = z.object({
  username: z.string().optional(),
  password: z.string(),
  isAdminLogin: z.boolean()
}).refine((data) => {
  // 管理者ログインの場合のみusernameを必須に
  if (data.isAdminLogin && !data.username) {
    return false;
  }
  return true;
}, {
  message: "管理者ログインの場合はユーザー名が必要です",
  path: ["username"]
});

export function setupAuth(app: Express) {
  const MemoryStore = createMemoryStore(session);
  
  const sessionSettings: session.SessionOptions = {
    secret: process.env.REPL_ID || "swimtrack-session-secret",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    store: new MemoryStore({
      checkPeriod: 43200000, // 12時間ごとに期限切れセッションを削除
      stale: false,
    }),
    cookie: {
      maxAge: SESSION_MAX_AGE,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      domain: undefined
    },
    name: 'swimtrack.sid'
  };

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy({
      usernameField: 'username',
      passwordField: 'password',
      passReqToCallback: true
    }, async (req, username, password, done) => {
      try {
        console.log('[Auth] Processing authentication request');
        const isAdminLogin = req.body.isAdminLogin === true;
        let user;

        if (isAdminLogin) {
          // 管理者ログイン
          if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
            console.log('[Auth] Admin login failed: Invalid credentials');
            return done(null, false, {
              message: username !== ADMIN_USERNAME 
                ? "管理者ユーザー名が正しくありません。"
                : "管理者パスワードが正しくありません。"
            });
          }

          [user] = await db
            .select()
            .from(users)
            .where(and(
              eq(users.username, ADMIN_USERNAME),
              eq(users.role, 'coach')
            ))
            .limit(1);

          if (!user) {
            console.log('[Auth] Creating new admin user');
            [user] = await db
              .insert(users)
              .values({
                username: ADMIN_USERNAME,
                password: ADMIN_PASSWORD,
                role: 'coach',
                isActive: true
              })
              .returning();
          }
        } else {
          // 一般ユーザーログイン
          if (password !== GENERAL_PASSWORD) {
            console.log('[Auth] General user login failed: Invalid password');
            return done(null, false, {
              message: "パスワードが正しくありません。"
            });
          }

          // ランダムな一般ユーザーを取得または作成
          [user] = await db
            .select()
            .from(users)
            .where(and(
              eq(users.role, 'student'),
              eq(users.isActive, true)
            ))
            .orderBy(sql`RANDOM()`)
            .limit(1);

          if (!user) {
            const timestamp = Date.now();
            const randomSuffix = Math.random().toString(36).substring(2, 8);
            const generalUsername = `user_${timestamp}_${randomSuffix}`;
            
            console.log('[Auth] Creating new general user');
            [user] = await db
              .insert(users)
              .values({
                username: generalUsername,
                password: GENERAL_PASSWORD,
                role: 'student',
                isActive: true
              })
              .returning();
          }
        }

        console.log('[Auth] Login successful');
        return done(null, user);
      } catch (err) {
        console.error('[Auth] Authentication error:', err);
        return done(err);
      }
    })
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      
      if (!user) {
        return done(new Error("ユーザーが見つかりません"));
      }

      done(null, user);
    } catch (err) {
      console.error('[Auth] Deserialization error:', err);
      done(err);
    }
  });

  app.post("/login", (req, res, next) => {
    console.log('[Auth] Processing login request');
    const result = loginSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ 
        message: "入力が無効です", 
        errors: result.error.flatten().fieldErrors 
      });
    }

    passport.authenticate("local", (err: any, user: Express.User, info: IVerifyOptions) => {
      if (err) {
        console.error("[Auth] Login error:", err);
        return next(err);
      }

      if (!user) {
        console.log('[Auth] Login failed:', info.message);
        return res.status(401).json({
          message: info.message ?? "ログインに失敗しました",
          field: "credentials"
        });
      }

      req.logIn(user, (err) => {
        if (err) {
          console.error("[Auth] Session error:", err);
          return next(err);
        }

        // セッションの有効期限を設定
        if (req.session) {
          req.session.cookie.maxAge = SESSION_MAX_AGE;
        }

        console.log('[Auth] Login successful, session established');
        return res.json({
          message: "ログインしました",
          user: { 
            id: user.id, 
            username: user.username, 
            role: user.role 
          },
        });
      });
    })(req, res, next);
  });

  app.post("/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        console.error('[Auth] Logout error:', err);
        return res.status(500).json({ message: "ログアウトに失敗しました" });
      }

      req.session.destroy((err) => {
        if (err) {
          console.error('[Auth] Session destruction error:', err);
          return res.status(500).json({ message: "セッションの削除に失敗しました" });
        }
        res.clearCookie('swimtrack.sid');
        console.log('[Auth] Logout successful');
        res.json({ message: "ログアウトしました" });
      });
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.session) {
      return res.status(401).json({ 
        message: "セッションが見つかりません",
        code: "NO_SESSION"
      });
    }

    if (!req.isAuthenticated()) {
      return res.status(401).json({ 
        message: "認証が必要です",
        code: "NOT_AUTHENTICATED"
      });
    }

    res.json(req.user);
  });

  app.post("/api/refresh", async (req, res) => {
    console.log('[Auth] Processing refresh request');

    if (!req.session || !req.sessionID) {
      console.log('[Auth] No session to refresh');
      return res.status(401).json({ 
        message: "セッションが見つかりません",
        code: "SESSION_NOT_FOUND"
      });
    }

    const sessionExpiryTime = new Date(req.session.cookie.expires || 0).getTime();
    const currentTime = Date.now();
    const timeUntilExpiry = sessionExpiryTime - currentTime;

    if (req.isAuthenticated() && timeUntilExpiry > SESSION_REFRESH_THRESHOLD) {
      console.log('[Auth] Session still valid, no refresh needed');
      return res.json(req.user);
    }

    try {
      const userId = req.session.passport?.user;
      
      if (!userId) {
        console.log('[Auth] No user ID in session');
        return res.status(401).json({ 
          message: "セッション情報が不完全です",
          code: "INVALID_SESSION"
        });
      }

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        console.log('[Auth] User not found for session refresh');
        req.session.destroy((err) => {
          if (err) console.error('[Auth] Error destroying invalid session:', err);
        });
        return res.status(401).json({ 
          message: "ユーザーが見つかりません",
          code: "USER_NOT_FOUND"
        });
      }

      if (!user.isActive) {
        console.log('[Auth] Inactive user attempted refresh');
        req.session.destroy((err) => {
          if (err) console.error('[Auth] Error destroying session for inactive user:', err);
        });
        return res.status(401).json({ 
          message: "アカウントが無効化されています",
          code: "ACCOUNT_INACTIVE"
        });
      }

      await new Promise<void>((resolve, reject) => {
        req.login(user, (err) => {
          if (err) {
            console.error('[Auth] Session refresh failed:', err);
            reject(err);
            return;
          }
          
          if (req.session) {
            req.session.cookie.maxAge = SESSION_MAX_AGE;
            req.session.touch();
          }
          
          resolve();
        });
      });

      console.log('[Auth] Session refreshed successfully');
      res.json(user);
    } catch (error) {
      console.error('[Auth] Session refresh error:', error);
      
      req.session.destroy((err) => {
        if (err) console.error('[Auth] Error destroying session after refresh failure:', err);
      });
      
      res.status(500).json({ 
        message: "セッションの更新に失敗しました",
        code: "REFRESH_FAILED"
      });
    }
  });
}
