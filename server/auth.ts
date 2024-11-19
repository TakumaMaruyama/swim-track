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

const scryptAsync = promisify(scrypt);

// Constants
const SALT_LENGTH = 32;
const HASH_LENGTH = 64;
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes
const ATTEMPT_RESET_TIME = 30 * 60 * 1000; // 30 minutes

/** Interface for login attempt tracking */
interface LoginAttempt {
  count: number;
  lastAttempt: number;
  lastSuccess?: number;
  lockoutUntil?: number;
}

/** Interface for login check result */
interface LoginCheck {
  allowed: boolean;
  message: string;
}

/** Crypto utility functions for password hashing and comparison */
const crypto = {
  /**
   * Hashes a password using scrypt
   * @param password Plain text password
   * @returns Hashed password string
   */
  hash: async (password: string): Promise<string> => {
    try {
      const salt = randomBytes(SALT_LENGTH);
      const hash = (await scryptAsync(password, salt, HASH_LENGTH)) as Buffer;
      const hashedPassword = Buffer.concat([hash, salt]);
      return hashedPassword.toString('hex');
    } catch (error) {
      throw new Error('パスワードのハッシュ化に失敗しました');
    }
  },

  /**
   * Compares a supplied password with a stored hash
   * @param suppliedPassword Plain text password to compare
   * @param storedPassword Stored hashed password
   * @returns Boolean indicating if passwords match
   */
  compare: async (suppliedPassword: string, storedPassword: string): Promise<boolean> => {
    try {
      const buffer = Buffer.from(storedPassword, 'hex');
      const hash = buffer.subarray(0, HASH_LENGTH);
      const salt = buffer.subarray(HASH_LENGTH);
      const suppliedHash = (await scryptAsync(suppliedPassword, salt, HASH_LENGTH)) as Buffer;
      return timingSafeEqual(hash, suppliedHash);
    } catch (error) {
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
   * @returns Object containing allowed status and message
   */
  const checkLoginAttempts = (username: string): LoginCheck => {
    const now = Date.now();
    const key = username.toLowerCase();
    const attempts = loginAttempts.get(key) || { count: 0, lastAttempt: 0 };

    if (now - attempts.lastAttempt > ATTEMPT_RESET_TIME) {
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
            lockoutUntil: attempts.count + 1 >= MAX_ATTEMPTS ? now + LOCKOUT_TIME : undefined
          };
          loginAttempts.set(ipKey, newAttempts);
        };

        if (!user?.password) {
          handleFailedAttempt();
          return done(null, false, { message: "ユーザー名またはパスワードが正しくありません" });
        }

        const isMatch = await crypto.compare(password, user.password);
        if (!isMatch) {
          handleFailedAttempt();
          return done(null, false, { message: "ユーザー名またはパスワードが正しくありません" });
        }

        loginAttempts.set(ipKey, {
          count: 0,
          lastAttempt: now,
          lastSuccess: now
        });

        return done(null, user);
      } catch (err) {
        console.error('[Auth] Critical error:', err);
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
      console.error('[Auth] Deserialization error:', err);
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
        return res.status(500).json({ message: "ログアウトに失敗しました" });
      }
      if (username) {
        loginAttempts.delete(username.toLowerCase());
      }
      req.session.destroy((err) => {
        if (err) {
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
