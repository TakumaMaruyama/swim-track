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
  // Session settings with enhanced security and management
  const SESSION_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
  const SESSION_REFRESH_THRESHOLD = 30 * 60 * 1000; // 30 minutes

  const sessionSettings: session.SessionOptions = {
    secret: process.env.REPL_ID || "porygon-supremacy",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    store: new MemoryStore({
      checkPeriod: 86400000, // Prune expired entries every 24h
      stale: false, // Don't serve stale sessions
    }),
    cookie: {
      maxAge: SESSION_MAX_AGE,
      httpOnly: true,
      secure: 'auto',
      sameSite: 'lax',
      path: '/'
    },
    name: 'sessionId', // Custom cookie name
  };

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Enhanced rate limiting with more sophisticated tracking
  const loginAttempts = new Map<string, { 
    count: number; 
    lastAttempt: number;
    lastSuccess?: number;
    lockoutUntil?: number;
  }>();
  
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes
  const ATTEMPT_RESET_TIME = 30 * 60 * 1000; // 30 minutes

  const checkLoginAttempts = (username: string): { allowed: boolean; message?: string } => {
    const now = Date.now();
    const key = username.toLowerCase();
    const attempts = loginAttempts.get(key) || { count: 0, lastAttempt: 0 };

    // Reset attempts if enough time has passed since last attempt
    if (now - attempts.lastAttempt > ATTEMPT_RESET_TIME) {
      loginAttempts.delete(key);
      return { allowed: true };
    }

    // Check if user is in lockout period
    if (attempts.lockoutUntil && now < attempts.lockoutUntil) {
      const remainingTime = Math.ceil((attempts.lockoutUntil - now) / 60000);
      return {
        allowed: false,
        message: `アカウントが一時的にロックされています。${remainingTime}分後に再試行してください。`
      };
    }

    return { allowed: true };
  };

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const loginCheck = checkLoginAttempts(username);
        if (!loginCheck.allowed) {
          return done(null, false, { message: loginCheck.message });
        }

        const ipKey = username.toLowerCase();
        const now = Date.now();
        const attempts = loginAttempts.get(ipKey) || { count: 0, lastAttempt: 0 };

        // Add delay to prevent timing attacks
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100));

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.username, username))
          .limit(1);

        if (!user?.password) {
          loginAttempts.set(ipKey, {
            count: attempts.count + 1,
            lastAttempt: now,
            lockoutUntil: attempts.count + 1 >= MAX_ATTEMPTS ? now + LOCKOUT_TIME : undefined
          });
          return done(null, false, { 
            message: "ユーザー名またはパスワードが正しくありません。" 
          });
        }

        const isMatch = await crypto.compare(password, user.password);
        if (!isMatch) {
          loginAttempts.set(ipKey, {
            count: attempts.count + 1,
            lastAttempt: now,
            lockoutUntil: attempts.count + 1 >= MAX_ATTEMPTS ? now + LOCKOUT_TIME : undefined
          });
          return done(null, false, { 
            message: "ユーザー名またはパスワードが正しくありません。"
          });
        }

        // Reset attempts on successful login
        loginAttempts.set(ipKey, {
          count: 0,
          lastAttempt: now,
          lastSuccess: now
        });

        return done(null, user);
      } catch (err) {
        console.error('Authentication error:', err);
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
      console.error('Deserialization error:', err);
      done(err);
    }
  });

  app.post("/register", async (req, res, next) => {
    try {
      console.log('[Auth] Processing registration request');
      const result = insertUserSchema.safeParse(req.body);
      if (!result.success) {
        console.log('[Auth] Registration validation failed:', result.error);
        return res
          .status(400)
          .json({ 
            message: "入力が無効です", 
            errors: result.error.flatten().fieldErrors 
          });
      }

      const { username, password, role } = result.data;

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
          role,
        })
        .returning();

      console.log('[Auth] Registration successful');
      req.login(newUser, (err) => {
        if (err) {
          console.error('[Auth] Login after registration failed:', err);
          return next(err);
        }
        return res.json({
          message: "登録が完了しました",
          user: { id: newUser.id, username: newUser.username, role: newUser.role },
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
      return res
        .status(400)
        .json({ 
          message: "入力が無効です", 
          errors: result.error.flatten().fieldErrors 
        });
    }

    const cb = (err: any, user: Express.User, info: IVerifyOptions) => {
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
        console.log('[Auth] Login successful, session established');
        return res.json({
          message: "ログインしました",
          user: { id: user.id, username: user.username, role: user.role },
        });
      });
    };
    
    passport.authenticate("local", cb)(req, res, next);
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
      req.session.destroy((err) => {
        if (err) {
          console.error('[Auth] Session destruction error:', err);
          return res.status(500).json({ message: "セッションの削除に失敗しました" });
        }
        res.clearCookie('connect.sid');
        console.log('[Auth] Logout successful');
        res.json({ message: "ログアウトしました" });
      });
    });
  });

  app.get("/api/user", (req, res) => {
    if (req.isAuthenticated()) {
      console.log('[Auth] User session validated');
      return res.json(req.user);
    }
    console.log('[Auth] No valid session found');
    res.status(401).json({ message: "認証が必要です" });
  });

  // Session refresh endpoint
  app.post("/api/refresh", async (req, res) => {
    console.log('[Auth] Processing refresh request');

    if (!req.session || !req.sessionID) {
      console.log('[Auth] No session to refresh');
      return res.status(401).json({ 
        message: "セッションが見つかりません",
        code: "SESSION_NOT_FOUND"
      });
    }

    // Check if session is close to expiry
    const sessionExpiryTime = new Date(req.session.cookie.expires || 0).getTime();
    const currentTime = Date.now();
    const timeUntilExpiry = sessionExpiryTime - currentTime;

    if (req.isAuthenticated() && timeUntilExpiry > SESSION_REFRESH_THRESHOLD) {
      console.log('[Auth] Session still valid, no refresh needed');
      return res.json(req.user);
    }

    // Try to revalidate the session
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

      // Re-establish the session with error handling
      await new Promise<void>((resolve, reject) => {
        req.login(user, (err) => {
          if (err) {
            console.error('[Auth] Session refresh failed:', err);
            reject(err);
            return;
          }
          
          // Explicitly set new expiry
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
      
      // Clean up the session on error
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
