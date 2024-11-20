// External libraries
import passport from "passport";
import { IVerifyOptions, Strategy as LocalStrategy } from "passport-local";
import { type Express } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { eq } from "drizzle-orm";

// Internal modules
import { db } from "db";
import { users, insertUserSchema } from "db/schema";

// Types
import type { User as SelectUser } from "db/schema";

/** Constants for authentication configuration */
const AUTH_CONSTANTS = {
  SALT_LENGTH: 32,
  HASH_LENGTH: 64,
  MAX_ATTEMPTS: 5,
  LOCKOUT_TIME: 15 * 60 * 1000, // 15 minutes
  ATTEMPT_RESET_TIME: 30 * 60 * 1000, // 30 minutes
} as const;

const scryptAsync = promisify(scrypt);

/** Interface for login attempt tracking */
interface LoginAttempt {
  count: number;
  lastAttempt: number;
  lastSuccess?: number;
  lockoutUntil?: number;
}

/** Interface for structured auth logging */
interface AuthLog {
  event: 'login_success' | 'login_failure' | 'logout' | 'register' | 'error';
  username?: string;
  message: string;
  error?: unknown;
}

/** Interface for login check result */
interface LoginCheck {
  allowed: boolean;
  message: string;
}

/** Utility function for structured logging */
function logAuth({ event, username, message, error }: AuthLog): void {
  const log = {
    timestamp: new Date().toISOString(),
    event,
    ...(username && { username }),
    message,
    ...(error && { error: error instanceof Error ? error.message : String(error) })
  };
  console.log(`[Auth] ${JSON.stringify(log)}`);
}

/** Crypto utility functions */
const crypto = {
  async hash(password: string): Promise<string> {
    try {
      const salt = randomBytes(AUTH_CONSTANTS.SALT_LENGTH);
      const hash = (await scryptAsync(password, salt, AUTH_CONSTANTS.HASH_LENGTH)) as Buffer;
      const hashedPassword = Buffer.concat([hash, salt]);
      return hashedPassword.toString('hex');
    } catch (error) {
      logAuth({ 
        event: 'error', 
        message: 'Password hashing failed', 
        error 
      });
      throw new Error('パスワードのハッシュ化に失敗しました');
    }
  },

  async compare(suppliedPassword: string, storedPassword: string): Promise<boolean> {
    try {
      const buffer = Buffer.from(storedPassword, 'hex');
      const hash = buffer.subarray(0, AUTH_CONSTANTS.HASH_LENGTH);
      const salt = buffer.subarray(AUTH_CONSTANTS.HASH_LENGTH);
      const suppliedHash = (await scryptAsync(suppliedPassword, salt, AUTH_CONSTANTS.HASH_LENGTH)) as Buffer;
      return timingSafeEqual(hash, suppliedHash);
    } catch (error) {
      logAuth({ 
        event: 'error', 
        message: 'Password comparison failed', 
        error 
      });
      return false;
    }
  },
};

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

/**
 * Sets up authentication middleware and routes
 * @param app Express application instance
 */
export function setupAuth(app: Express): void {
  const MemoryStore = createMemoryStore(session);
  const sessionSettings: session.SessionOptions = {
    secret: process.env.REPL_ID || "secure-session-secret",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    store: new MemoryStore({
      checkPeriod: 86400000 // 24 hours
    }),
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    }
  };

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Rate limiting configuration
  const loginAttempts = new Map<string, LoginAttempt>();

  /**
   * Checks login attempts for rate limiting
   * @param username Username to check
   * @returns LoginCheck result
   */
  const checkLoginAttempts = (username: string): LoginCheck => {
    const now = Date.now();
    const key = username.toLowerCase();
    const attempts = loginAttempts.get(key) || { count: 0, lastAttempt: 0 };

    if (now - attempts.lastAttempt > AUTH_CONSTANTS.ATTEMPT_RESET_TIME) {
      loginAttempts.delete(key);
      return { allowed: true, message: '' };
    }

    if (attempts.lockoutUntil && now < attempts.lockoutUntil) {
      const remainingTime = Math.ceil((attempts.lockoutUntil - now) / 60000);
      return {
        allowed: false,
        message: `アカウントが一時的にロックされています。${remainingTime}分後に再試行してください。`
      };
    }

    return { allowed: true, message: '' };
  };

  // Configure passport local strategy
  passport.use(
    new LocalStrategy(async (username: string, password: string, done) => {
      try {
        const loginCheck = checkLoginAttempts(username);
        if (!loginCheck.allowed) {
          logAuth({ 
            event: 'login_failure', 
            username, 
            message: loginCheck.message 
          });
          return done(null, false, { message: loginCheck.message });
        }

        const ipKey = username.toLowerCase();
        const now = Date.now();
        const attempts = loginAttempts.get(ipKey) || { count: 0, lastAttempt: 0 };

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.username, username))
          .limit(1);

        const handleFailedAttempt = () => {
          const newAttempts = {
            count: attempts.count + 1,
            lastAttempt: now,
            lockoutUntil: attempts.count + 1 >= AUTH_CONSTANTS.MAX_ATTEMPTS ? 
              now + AUTH_CONSTANTS.LOCKOUT_TIME : undefined
          };
          loginAttempts.set(ipKey, newAttempts);
        };

        if (!user?.password) {
          handleFailedAttempt();
          logAuth({ 
            event: 'login_failure', 
            username, 
            message: 'Invalid credentials' 
          });
          return done(null, false, { message: "ユーザー名またはパスワードが正しくありません" });
        }

        const isMatch = await crypto.compare(password, user.password);
        if (!isMatch) {
          handleFailedAttempt();
          logAuth({ 
            event: 'login_failure', 
            username, 
            message: 'Invalid password' 
          });
          return done(null, false, { message: "ユーザー名またはパスワードが正しくありません" });
        }

        loginAttempts.set(ipKey, {
          count: 0,
          lastAttempt: now,
          lastSuccess: now
        });

        logAuth({ 
          event: 'login_success', 
          username, 
          message: 'Login successful' 
        });
        return done(null, user);
      } catch (err) {
        logAuth({ 
          event: 'error', 
          username, 
          message: 'Authentication error', 
          error: err 
        });
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
        return done(null, false);
      }

      done(null, user);
    } catch (err) {
      logAuth({ 
        event: 'error', 
        message: 'User deserialization error', 
        error: err 
      });
      done(err);
    }
  });

  // Authentication routes
  app.post("/register", async (req, res, next) => {
    try {
      const result = insertUserSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          message: "入力が無効です", 
          errors: result.error.flatten().fieldErrors 
        });
      }

      const { username, password, role } = result.data;

      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (existingUser) {
        logAuth({ 
          event: 'register', 
          username, 
          message: 'Username already exists' 
        });
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

      logAuth({ 
        event: 'register', 
        username, 
        message: 'Registration successful' 
      });

      req.login(newUser, (err) => {
        if (err) {
          return next(err);
        }
        return res.json({
          message: "登録が完了しました",
          user: { id: newUser.id, username: newUser.username, role: newUser.role },
        });
      });
    } catch (error) {
      logAuth({ 
        event: 'error', 
        message: 'Registration error', 
        error 
      });
      next(error);
    }
  });

  app.post("/login", (req, res, next) => {
    const result = insertUserSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ 
        message: "入力が無効です", 
        errors: result.error.flatten().fieldErrors 
      });
    }

    passport.authenticate("local", (err: any, user: Express.User | false, info: IVerifyOptions) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(401).json({
          message: info.message ?? "ログインに失敗しました",
          field: "credentials"
        });
      }

      req.logIn(user, (err) => {
        if (err) {
          return next(err);
        }
        return res.json({
          message: "ログインしました",
          user: { id: user.id, username: user.username, role: user.role },
        });
      });
    })(req, res, next);
  });

  app.post("/logout", (req, res) => {
    const username = req.user?.username;
    req.logout((err) => {
      if (err) {
        logAuth({ 
          event: 'error', 
          username, 
          message: 'Logout error', 
          error: err 
        });
        return res.status(500).json({ message: "ログアウトに失敗しました" });
      }
      if (username) {
        loginAttempts.delete(username.toLowerCase());
        logAuth({ 
          event: 'logout', 
          username, 
          message: 'Logout successful' 
        });
      }
      req.session.destroy((err) => {
        if (err) {
          logAuth({ 
            event: 'error', 
            username, 
            message: 'Session destruction error', 
            error: err 
          });
          return res.status(500).json({ message: "セッションの削除に失敗しました" });
        }
        res.clearCookie('connect.sid');
        res.json({ message: "ログアウトしました" });
      });
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "認証が必要です" });
    }
    res.json(req.user);
  });
}
