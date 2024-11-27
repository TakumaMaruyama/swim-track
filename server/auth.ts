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
  const sessionSettings: session.SessionOptions = {
    secret: process.env.REPL_ID || "porygon-supremacy",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    store: new MemoryStore({
      checkPeriod: 86400000, // 24時間
      ttl: 24 * 60 * 60 * 1000, // 24時間
      stale: false,
    }),
    name: 'swimtrack.sid',
    proxy: true,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24時間
      httpOnly: true,
      secure: 'auto',
      sameSite: 'lax',
      path: '/',
    }
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

  // Enhanced cache for deserialized users with background refresh
  const userCache = new Map<number, { 
    user: Express.User; 
    timestamp: number;
    refreshing?: boolean;
  }>();
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  const REFRESH_THRESHOLD = 4 * 60 * 1000; // 4 minutes - refresh before expiry

  const refreshUserData = async (id: number): Promise<Express.User | null> => {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    
    return user || null;
  };

  passport.deserializeUser(async (id: number, done) => {
    try {
      const now = Date.now();
      const cached = userCache.get(id);
      
      // Return cached user if still valid
      if (cached?.user) {
        // Schedule background refresh if approaching TTL
        if (!cached.refreshing && (now - cached.timestamp) > REFRESH_THRESHOLD) {
          cached.refreshing = true;
          refreshUserData(id).then(user => {
            if (user) {
              userCache.set(id, { user, timestamp: Date.now() });
            } else {
              userCache.delete(id);
            }
          }).catch(err => {
            console.error('[Auth] Background refresh error:', err);
          });
        }
        
        if ((now - cached.timestamp) < CACHE_TTL) {
          return done(null, cached.user);
        }
      }

      // Fetch fresh data if cache miss or expired
      const user = await refreshUserData(id);
      
      if (!user) {
        userCache.delete(id);
        return done(new Error("セッションが無効になりました。再度ログインしてください。"));
      }

      if (!user.isActive) {
        userCache.delete(id);
        return done(new Error("アカウントが無効化されています。"));
      }

      // Update cache
      userCache.set(id, { user, timestamp: now });
      console.log('[Auth] User cache updated for:', user.username);
      done(null, user);
    } catch (err) {
      console.error('[Auth] Deserialization error:', err);
      // Try to use cached data as fallback if available
      const cached = userCache.get(id);
      if (cached?.user && (now - cached.timestamp) < CACHE_TTL * 2) {
        console.log('[Auth] Using cached data as fallback for:', cached.user.username);
        return done(null, cached.user);
      }
      done(new Error("認証エラーが発生しました。再度ログインしてください。"));
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
    const userId = req.user?.id;
    
    req.logout((err) => {
      if (err) {
        console.error('[Auth] Logout error:', err);
        return res.status(500).json({ message: "ログアウトに失敗しました" });
      }
      
      // Clear user data
      if (username) {
        loginAttempts.delete(username.toLowerCase());
      }
      if (userId) {
        userCache.delete(userId);
      }
      
      req.session.destroy((err) => {
        if (err) {
          console.error('[Auth] Session destruction error:', err);
          return res.status(500).json({ message: "セッションの削除に失敗しました" });
        }
        res.clearCookie('swimtrack.sid', {
          httpOnly: true,
          secure: 'auto',
          sameSite: 'lax',
          path: '/',
        });
        console.log('[Auth] Logout successful');
        res.json({ message: "ログアウトしました" });
      });
    });
  });

  app.get("/api/user", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        console.log('[Auth] No valid session found');
        return res.status(401).json({ 
          message: "認証が必要です",
          code: "AUTH_REQUIRED"
        });
      }

      // Verify user still exists and is active
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, req.user.id))
        .limit(1);

      if (!user) {
        console.log('[Auth] User no longer exists:', req.user.id);
        req.logout((err) => {
          if (err) console.error('[Auth] Logout error:', err);
        });
        return res.status(401).json({ 
          message: "ユーザーが見つかりません",
          code: "USER_NOT_FOUND"
        });
      }

      if (!user.isActive) {
        console.log('[Auth] Inactive user attempted access:', req.user.id);
        req.logout((err) => {
          if (err) console.error('[Auth] Logout error:', err);
        });
        return res.status(401).json({ 
          message: "アカウントが無効化されています",
          code: "ACCOUNT_DISABLED"
        });
      }

      // Update cache with fresh data
      userCache.set(user.id, { user, timestamp: Date.now() });
      console.log('[Auth] User session validated for:', user.username);
      return res.json(user);
    } catch (err) {
      console.error('[Auth] User validation error:', err);
      res.status(500).json({ 
        message: "ユーザー情報の取得中にエラーが発生しました",
        code: "SERVER_ERROR"
      });
    }
  });
}
