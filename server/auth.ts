import passport from "passport";
import { IVerifyOptions, Strategy as LocalStrategy } from "passport-local";
import { type Express } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import { users, type User as SelectUser } from "db/schema";
import { db } from "db";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { z } from "zod";

// 認証用の固定値
const ADMIN_USERNAME = "丸山拓真";
const ADMIN_PASSWORD = "dpjm3756";

// セッション設定
const SESSION_MAX_AGE = 12 * 60 * 60 * 1000; // 12時間
const SESSION_REFRESH_THRESHOLD = 15 * 60 * 1000; // 15分

// 一般ログインパスワードを取得する関数
async function getGeneralPassword(): Promise<string> {
  try {
    console.log('[Auth] Fetching general password from settings');
    const [setting] = await db
      .select()
      .from(sql.table('settings'))
      .where(sql.eq('key', 'general_password'))
      .limit(1);

    if (!setting) {
      console.error('[Auth] General password not found in settings');
      throw new Error('一般ユーザー用パスワードが設定されていません');
    }

    console.log('[Auth] General password fetched successfully');
    return setting.value;
  } catch (error) {
    console.error('[Auth] Error fetching general password:', error);
    throw new Error('パスワードの取得に失敗しました。管理者に連絡してください。');
  }
}

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

// 条件付きバリデーションスキーマ
const loginSchema = z.object({
  username: z.string().optional(),
  password: z.string().min(5, "パスワードは5文字以上で入力してください"),
  isAdminLogin: z.boolean()
}).refine((data) => {
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
    resave: true,
    saveUninitialized: false,
    rolling: true,
    store: new MemoryStore({
      checkPeriod: SESSION_MAX_AGE,
      stale: false,
    }),
    cookie: {
      maxAge: SESSION_MAX_AGE,
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
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

        if (isAdminLogin) {
          // 管理者ログイン - 固定値との比較のみ
          if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
            return done(null, false, {
              message: "管理者認証に失敗しました"
            });
          }

          // 管理者ユーザーを取得または作成
          let [user] = await db
            .select({
              id: users.id,
              username: users.username,
              role: users.role,
              isActive: users.isActive
            })
            .from(users)
            .where(and(
              eq(users.username, ADMIN_USERNAME),
              eq(users.role, 'coach')
            ))
            .limit(1);

          if (!user) {
            [user] = await db
              .insert(users)
              .values({
                username: ADMIN_USERNAME,
                role: 'coach',
                isActive: true
              })
              .returning();
          }
          return done(null, user);
        } else {
          // 一般ユーザーログイン - settingsテーブルのパスワードのみを確認
          try {
            const generalPassword = await getGeneralPassword();
            if (password !== generalPassword) {
              return done(null, false, {
                message: "パスワードが正しくありません"
              });
            }

            // ランダムな一般ユーザーを取得または作成
            let [user] = await db
              .select({
                id: users.id,
                username: users.username,
                role: users.role,
                isActive: users.isActive
              })
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
              [user] = await db
                .insert(users)
                .values({
                  username: `user_${timestamp}_${randomSuffix}`,
                  role: 'student',
                  isActive: true
                })
                .returning();
            }
            return done(null, user);
          } catch (error) {
            return done(error);
          }
        }
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
        .select({
          id: users.id,
          username: users.username,
          role: users.role,
          isActive: users.isActive
        })
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

  // ログインエンドポイント
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
        return res.status(500).json({
          message: err.message || "ログイン処理中にエラーが発生しました",
          details: err.code === '42703' ? "システムエラーが発生しました。管理者に連絡してください。" : undefined
        });
      }

      if (!user) {
        console.log('[Auth] Login failed:', info.message);
        return res.status(401).json({
          message: info.message ?? "パスワードが正しくありません",
          code: "INVALID_CREDENTIALS"
        });
      }

      req.logIn(user, (err) => {
        if (err) {
          console.error("[Auth] Session error:", err);
          return next(err);
        }

        if (req.session) {
          req.session.cookie.maxAge = SESSION_MAX_AGE;
        }

        console.log('[Auth] Login successful');
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

  // ログアウトエンドポイント
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

  // ユーザー情報取得エンドポイント
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

  // セッション更新エンドポイント
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
        .select({
          id: users.id,
          username: users.username,
          role: users.role,
          isActive: users.isActive
        })
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

  // 設定管理API
  app.get("/api/settings/general-password", async (req, res) => {
    if (!req.user || req.user.role !== 'coach') {
      return res.status(403).json({ 
        message: "管理者権限が必要です",
        code: "ADMIN_REQUIRED"
      });
    }

    try {
      const password = await getGeneralPassword();
      res.json({ value: password });
    } catch (error) {
      console.error('[Settings] Failed to fetch general password:', error);
      res.status(500).json({ 
        message: "パスワードの取得に失敗しました",
        code: "FETCH_FAILED"
      });
    }
  });

  app.post("/api/settings/general-password", async (req, res) => {
    if (!req.user || req.user.role !== 'coach') {
      return res.status(403).json({ 
        message: "管理者権限が必要です",
        code: "ADMIN_REQUIRED"
      });
    }

    const { password } = req.body;

    // パスワードのバリデーション
    if (!password || typeof password !== 'string' || password.length < 5) {
      return res.status(400).json({
        message: "パスワードは5文字以上で入力してください",
        code: "INVALID_PASSWORD"
      });
    }

    try {
      await db
        .insert(sql.table('settings'))
        .values({
          key: 'general_password',
          value: password,
          updated_at: new Date()
        })
        .onConflictDoUpdate({
          target: ['key'],
          set: {
            value: password,
            updated_at: new Date()
          }
        });

      res.json({ message: "パスワードを更新しました" });
    } catch (error) {
      console.error('[Settings] Failed to update general password:', error);
      res.status(500).json({ 
        message: "パスワードの更新に失敗しました",
        code: "UPDATE_FAILED"
      });
    }
  });
}
