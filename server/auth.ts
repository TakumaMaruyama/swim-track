import passport from "passport";
import { IVerifyOptions, Strategy as LocalStrategy } from "passport-local";
import { type Express } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { users, insertUserSchema, type User as SelectUser } from "db/schema";
import { db } from "db";
import { eq } from "drizzle-orm";

const scryptAsync = promisify(scrypt);

const SALT_LENGTH = 32;
const HASH_LENGTH = 64;
const SESSION_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

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
  const MemoryStore = createMemoryStore(session);
  
  const sessionSettings: session.SessionOptions = {
    secret: process.env.REPL_ID || "porygon-supremacy",
    name: 'sid',
    resave: true, // 変更: セッションを確実に保存
    saveUninitialized: false,
    rolling: true,
    store: new MemoryStore({
      checkPeriod: 15 * 60 * 1000, // 15分ごとにチェック
      ttl: SESSION_MAX_AGE,
      stale: false,
      dispose: (sid) => {
        console.log('[Auth] Session disposed:', sid);
      },
      touch: (sid, session) => {
        if (!session) return;
        console.log('[Auth] Session touched:', sid);
        session.cookie.maxAge = SESSION_MAX_AGE;
      }
    }),
    cookie: {
      maxAge: SESSION_MAX_AGE,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      domain: undefined
    }
  };

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Login attempts tracking
  const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const ipKey = username.toLowerCase();
        const now = Date.now();
        const attempts = loginAttempts.get(ipKey);

        if (attempts && attempts.count >= MAX_ATTEMPTS) {
          const timeSinceLastAttempt = now - attempts.lastAttempt;
          if (timeSinceLastAttempt < LOCKOUT_TIME) {
            const remainingTime = Math.ceil((LOCKOUT_TIME - timeSinceLastAttempt) / 60000);
            return done(null, false, { 
              message: `アカウントが一時的にロックされています。${remainingTime}分後に再試行してください。`
            });
          }
          loginAttempts.delete(ipKey);
        }

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.username, username))
          .limit(1);

        if (!user?.password) {
          loginAttempts.set(ipKey, {
            count: (attempts?.count || 0) + 1,
            lastAttempt: now
          });
          return done(null, false, { message: "ユーザー名またはパスワードが正しくありません" });
        }

        const isMatch = await crypto.compare(password, user.password);
        if (!isMatch) {
          loginAttempts.set(ipKey, {
            count: (attempts?.count || 0) + 1,
            lastAttempt: now
          });
          return done(null, false, { message: "ユーザー名またはパスワードが正しくありません" });
        }

        if (!user.isActive) {
          return done(null, false, { message: "アカウントが無効化されています" });
        }

        loginAttempts.delete(ipKey);
        return done(null, user);
      } catch (err) {
        console.error('Authentication error:', err);
        return done(err);
      }
    })
  );

  passport.serializeUser((user: Express.User, done) => {
    try {
      console.log('[Auth] Serializing user:', user.id);
      done(null, {
        id: user.id,
        username: user.username,
        role: user.role,
        isActive: user.isActive
      });
    } catch (error) {
      console.error('[Auth] Serialization error:', error);
      done(error);
    }
  });

  passport.deserializeUser(async (serialized: any, done) => {
    try {
      console.log('[Auth] Deserializing user:', serialized.id);
      
      // First check if we have complete serialized data
      if (!serialized || !serialized.id) {
        console.log('[Auth] Incomplete serialized data');
        return done(null, false);
      }

      // Verify against database to ensure user still exists and is active
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, serialized.id))
        .limit(1);
      
      if (!user) {
        console.log('[Auth] User not found in database:', serialized.id);
        return done(null, false);
      }

      if (!user.isActive) {
        console.log('[Auth] User account is inactive:', serialized.id);
        return done(null, false);
      }

      // Compare serialized data with database data
      if (
        user.username !== serialized.username ||
        user.role !== serialized.role ||
        user.isActive !== serialized.isActive
      ) {
        console.log('[Auth] User data mismatch, updating session');
      }

      done(null, user);
    } catch (err) {
      console.error('[Auth] Deserialization error:', err);
      done(err);
    }
  });

  app.post("/register", async (req, res, next) => {
    try {
      console.log('[Auth] Processing registration request');
      const result = insertUserSchema.safeParse(req.body);
      if (!result.success) {
        console.log('[Auth] Registration validation failed:', result.error);
        return res.status(400).json({ 
          message: "入力が無効です", 
          errors: result.error.flatten().fieldErrors 
        });
      }

      const { username, password } = result.data;

      // Check if user already exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (existingUser) {
        console.log('[Auth] Registration failed: username already exists');
        return res.status(400).json({ 
          message: "このユーザー名は既に使用されています",
          field: "username"
        });
      }

      const hashedPassword = await crypto.hash(password);

      const [newUser] = await db
        .insert(users)
        .values({
          username,
          password: hashedPassword,
          isActive: true
        })
        .returning();

      console.log('[Auth] Registration successful');
      req.login(newUser, (err) => {
        if (err) {
          console.error('[Auth] Login after registration failed:', err);
          return next(err);
        }

        // Initialize session
        if (!req.session.passport) {
          req.session.passport = { user: newUser.id };
        }

        // Ensure session is saved
        req.session.save((err) => {
          if (err) {
            console.error('[Auth] Session save error:', err);
            return next(err);
          }

          return res.json({
            message: "登録が完了しました",
            user: { id: newUser.id, username: newUser.username }
          });
        });
      });
    } catch (error) {
      console.error('Registration error:', error);
      next(error);
    }
  });

  app.post("/login", (req, res, next) => {
    console.log('[Auth] Processing login request');
    const result = insertUserSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ 
        message: "入力が無効です", 
        errors: result.error.flatten().fieldErrors 
      });
    }

    passport.authenticate("local", (err: any, user: Express.User | false, info: IVerifyOptions) => {
      if (err) {
        console.error('[Auth] Login error:', err);
        return next(err);
      }

      if (!user) {
        console.log('[Auth] Login failed:', info.message);
        return res.status(401).json({
          message: info.message ?? "ログインに失敗しました",
          field: "credentials"
        });
      }

      req.login(user, (err) => {
        if (err) {
          console.error('[Auth] Session error:', err);
          return next(err);
        }

        // Initialize session
        if (!req.session.passport) {
          req.session.passport = { user: user.id };
        }

        // Ensure session is saved
        req.session.save((err) => {
          if (err) {
            console.error('[Auth] Session save error:', err);
            return next(err);
          }

          console.log('[Auth] Login successful');
          return res.json({
            message: "ログインしました",
            user: { id: user.id, username: user.username }
          });
        });
      });
    })(req, res, next);
  });

  app.post("/logout", (req, res) => {
    const username = req.user?.username;
    req.logout((err) => {
      if (err) {
        console.error('[Auth] Logout error:', err);
        return res.status(500).json({ message: "ログアウトに失敗しました" });
      }

      if (username) {
        loginAttempts.delete(username.toLowerCase());
      }

      req.session?.destroy((err) => {
        if (err) {
          console.error('[Auth] Session destruction error:', err);
          return res.status(500).json({ message: "セッションの削除に失敗しました" });
        }

        res.clearCookie('sid');
        console.log('[Auth] Logout successful');
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

    if (!req.user.isActive) {
      console.log('[Auth] User account is inactive');
      req.logout((err) => {
        if (err) console.error('[Auth] Error logging out inactive user:', err);
      });
      return res.status(401).json({
        message: "アカウントが無効化されています",
        code: "ACCOUNT_INACTIVE"
      });
    }

    // Touch session to keep it alive
    req.session.touch();
    res.json(req.user);
  });

  // Session refresh endpoint
  app.post("/api/refresh", async (req, res) => {
    console.log('[Auth] Processing refresh request');

    if (!req.session) {
      console.log('[Auth] No session found');
      return res.status(401).json({ 
        message: "セッションが見つかりません",
        code: "NO_SESSION"
      });
    }

    try {
      // セッションが存在し、認証済みの場合
      if (req.isAuthenticated() && req.user) {
        console.log('[Auth] User authenticated, refreshing session');
        
        // セッションの有効期限を更新
        req.session.cookie.maxAge = SESSION_MAX_AGE;
        req.session.touch();
        
        // セッションを保存
        await new Promise<void>((resolve, reject) => {
          req.session.save((err) => {
            if (err) {
              console.error('[Auth] Session save error:', err);
              reject(err);
            } else {
              resolve();
            }
          });
        });

        return res.json(req.user);
      }

      // パスポートデータがある場合、ユーザーを再検証
      if (req.session.passport?.user) {
        console.log('[Auth] Revalidating user session');
        
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, req.session.passport.user))
          .limit(1);

        if (!user) {
          console.log('[Auth] User not found');
          req.logout((err) => {
            if (err) console.error('[Auth] Logout error:', err);
          });
          return res.status(401).json({ 
            message: "ユーザーが見つかりません",
            code: "USER_NOT_FOUND"
          });
        }

        if (!user.isActive) {
          console.log('[Auth] User account is inactive');
          req.logout((err) => {
            if (err) console.error('[Auth] Logout error:', err);
          });
          return res.status(401).json({ 
            message: "アカウントが無効化されています",
            code: "ACCOUNT_INACTIVE"
          });
        }

        // ユーザーを再認証
        await new Promise<void>((resolve, reject) => {
          req.login(user, (err) => {
            if (err) {
              console.error('[Auth] Login error:', err);
              reject(err);
            } else {
              resolve();
            }
          });
        });

        // セッションを更新して保存
        req.session.cookie.maxAge = SESSION_MAX_AGE;
        req.session.touch();

        await new Promise<void>((resolve, reject) => {
          req.session.save((err) => {
            if (err) {
              console.error('[Auth] Session save error:', err);
              reject(err);
            } else {
              resolve();
            }
          });
        });

        console.log('[Auth] Session refreshed successfully');
        return res.json(user);
      }

      console.log('[Auth] No valid session data');
      return res.status(401).json({ 
        message: "セッション情報が不完全です",
        code: "INVALID_SESSION"
      });
    } catch (error) {
      console.error('[Auth] Session refresh error:', error);
      res.status(500).json({ 
        message: "セッションの更新に失敗しました",
        code: "REFRESH_FAILED"
      });
    }
  });
}