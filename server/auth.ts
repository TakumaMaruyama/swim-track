import passport from "passport";
import { IVerifyOptions, Strategy as LocalStrategy } from "passport-local";
import { type Express } from "express";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { users, insertUserSchema, type User as SelectUser } from "db/schema";
import { db } from "db";
import { eq } from "drizzle-orm";

const scryptAsync = promisify(scrypt);

const SALT_LENGTH = 32;
const HASH_LENGTH = 64;
const SESSION_MAX_AGE = 24 * 60 * 60 * 1000; // 24時間

const crypto = {
  hash: async (password: string) => {
    try {
      const salt = randomBytes(SALT_LENGTH);
      const hash = (await scryptAsync(password, salt, HASH_LENGTH)) as Buffer;
      const hashedPassword = Buffer.concat([hash, salt]);
      return hashedPassword.toString('hex');
    } catch (error) {
      console.error('Password hashing error:', error);
      throw new Error('パスワードのハッシュ化に失敗しました');
    }
  },
  compare: async (suppliedPassword: string, storedPassword: string) => {
    try {
      const buffer = Buffer.from(storedPassword, 'hex');
      const hash = buffer.subarray(0, HASH_LENGTH);
      const salt = buffer.subarray(HASH_LENGTH);
      const suppliedHash = (await scryptAsync(suppliedPassword, salt, HASH_LENGTH)) as Buffer;
      return timingSafeEqual(hash, suppliedHash);
    } catch (error) {
      console.error('Password comparison error:', error);
      return false;
    }
  },
};

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

export function setupAuth(app: Express) {
  const PostgresStore = ConnectPgSimple(session);
  
  const sessionSettings: session.SessionOptions = {
    secret: process.env.REPL_ID || "porygon-supremacy",
    name: 'sid',
    resave: false,
    saveUninitialized: false,
    rolling: false,
    store: new PostgresStore({
      conObject: {
        connectionString: process.env.DATABASE_URL,
        ssl: false
      },
      createTableIfMissing: true,
      pruneSessionInterval: 60 * 15,
      touchAfter: 24 * 60 * 60 // 24時間
    }),
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24時間
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    }
  };

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        console.log('[Auth] Authenticating user:', username);
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.username, username))
          .limit(1);

        if (!user?.password) {
          console.log('[Auth] User not found or no password:', username);
          return done(null, false, { message: "ユーザー名またはパスワードが正しくありません" });
        }

        const isMatch = await crypto.compare(password, user.password);
        if (!isMatch) {
          console.log('[Auth] Password mismatch for user:', username);
          return done(null, false, { message: "ユーザー名またはパスワードが正しくありません" });
        }

        if (!user.isActive) {
          console.log('[Auth] Inactive user attempted login:', username);
          return done(null, false, { message: "アカウントが無効化されています" });
        }

        console.log('[Auth] Authentication successful:', username);
        return done(null, user);
      } catch (err) {
        console.error('[Auth] Authentication error:', err);
        return done(err);
      }
    })
  );

  passport.serializeUser((user, done) => {
    if (!user?.id) {
      return done(new Error('無効なユーザーデータです'));
    }
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      if (!user || !user.isActive) {
        return done(null, false);
      }

      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  app.post("/login", async (req, res, next) => {
    try {
      if (!req.session) {
        console.error('[Auth] No session available for login');
        return res.status(500).json({
          message: "セッションが利用できません",
          code: "NO_SESSION"
        });
      }

      const result = insertUserSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          message: "入力が無効です", 
          errors: result.error.flatten().fieldErrors 
        });
      }

      const authenticate = () => new Promise<{ user: Express.User | false, info: IVerifyOptions }>((resolve, reject) => {
        passport.authenticate("local", (err: any, user: Express.User | false, info: IVerifyOptions) => {
          if (err) return reject(err);
          resolve({ user, info });
        })(req, res, next);
      });

      // 認証を実行
      const { user, info } = await authenticate();
      if (!user) {
        return res.status(401).json({
          message: info.message ?? "ログインに失敗しました",
          field: "credentials"
        });
      }

      // セッションを再生成
      await new Promise<void>((resolve, reject) => {
        req.session.regenerate((err) => {
          if (err) {
            console.error('[Auth] Session regeneration error:', err);
            reject(err);
            return;
          }
          resolve();
        });
      });

      // ユーザーをログイン
      await new Promise<void>((resolve, reject) => {
        req.login(user, (err) => {
          if (err) {
            console.error('[Auth] Login error:', err);
            reject(err);
            return;
          }
          resolve();
        });
      });

      // セッションを保存
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) {
            console.error('[Auth] Session save error:', err);
            reject(err);
            return;
          }
          resolve();
        });
      });

      console.log('[Auth] Login successful:', user.username);
      res.json({
        message: "ログインしました",
        user: { id: user.id, username: user.username, role: user.role }
      });
    } catch (error) {
      console.error('[Auth] Authentication error:', error);
      res.status(500).json({
        message: "認証中にエラーが発生しました",
        code: "AUTH_ERROR"
      });
    }
  });

  app.post("/logout", (req, res) => {
    if (!req.session) {
      return res.status(500).json({ message: "セッションが利用できません" });
    }

    const sessionId = req.sessionID;
    console.log('[Auth] Starting logout process for session:', sessionId);

    req.logout((err) => {
      if (err) {
        console.error('[Auth] Logout error:', err);
        return res.status(500).json({ message: "ログアウトに失敗しました" });
      }

      req.session!.destroy((err) => {
        if (err) {
          console.error('[Auth] Session destruction error:', err);
          return res.status(500).json({ message: "セッションの削除に失敗しました" });
        }

        res.clearCookie('sid');
        console.log('[Auth] Logout successful. Session destroyed:', sessionId);
        res.json({ message: "ログアウトしました" });
      });
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.session) {
      console.log('[Auth] No session found');
      return res.status(401).json({ 
        message: "セッションが見つかりません",
        code: "NO_SESSION"
      });
    }

    if (!req.isAuthenticated() || !req.user) {
      console.log('[Auth] User not authenticated');
      return res.status(401).json({ 
        message: "認証が必要です",
        code: "NOT_AUTHENTICATED"
      });
    }

    console.log('[Auth] User data requested:', req.user.username);
    res.json(req.user);
  });

  app.post("/api/refresh", async (req, res) => {
    if (!req.session || !req.isAuthenticated() || !req.user) {
      console.log('[Auth] Invalid session or user for refresh');
      return res.status(401).json({ 
        message: "認証が必要です",
        code: "NOT_AUTHENTICATED"
      });
    }

    try {
      console.log('[Auth] Refreshing session for user:', req.user.username);
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, req.user.id))
        .limit(1);

      if (!user || !user.isActive) {
        console.log('[Auth] User not found or inactive:', req.user.id);
        req.logout((err) => {
          if (err) console.error('[Auth] Error logging out inactive user:', err);
        });
        return res.status(401).json({
          message: user ? "アカウントが無効化されています" : "ユーザーが見つかりません",
          code: user ? "ACCOUNT_INACTIVE" : "USER_NOT_FOUND"
        });
      }

      // セッションを更新
      await new Promise<void>((resolve, reject) => {
        req.session.regenerate((err) => {
          if (err) {
            console.error('[Auth] Session regeneration error during refresh:', err);
            reject(err);
            return;
          }

          req.login(user, (loginErr) => {
            if (loginErr) {
              console.error('[Auth] Login error during refresh:', loginErr);
              reject(loginErr);
              return;
            }

            req.session.save((saveErr) => {
              if (saveErr) {
                console.error('[Auth] Session save error during refresh:', saveErr);
                reject(saveErr);
                return;
              }
              resolve();
            });
          });
        });
      });

      console.log('[Auth] Session refreshed successfully for:', user.username);
      res.json(user);
    } catch (error) {
      console.error('[Auth] Session refresh error:', error);
      res.status(500).json({ 
        message: "セッションの更新に失敗しました",
        code: "REFRESH_FAILED"
      });
    }
  });
}
