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
import { LogLevel } from "../client/src/types/auth";

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

/**
 * Structured logging function for authentication server operations
 * Only logs critical events and errors with proper context
 * 
 * @param level - Log level from LogLevel enum (ERROR, WARN, INFO)
 * @param operation - Authentication operation being performed (e.g., 'login', 'register')
 * @param message - Descriptive message about the event
 * @param context - Optional context data for the event (filtered for sensitive data)
 */
function logAuth(level: LogLevel, operation: string, message: string, context?: Record<string, unknown>): void {
  // Determine if this event should be logged based on severity
  const shouldLog = 
    level === LogLevel.ERROR || 
    (level === LogLevel.INFO && context?.critical === true);

  if (!shouldLog) return;

  // Filter sensitive data from context
  const filteredContext = context ? {
    ...context,
    password: undefined,
    credentials: undefined,
    token: undefined,
    sessionData: undefined,
    userCredentials: undefined
  } : undefined;

  // Log with standardized format
  console.log({
    timestamp: new Date().toISOString(),
    system: 'Auth',
    level,
    operation,
    message,
    ...(filteredContext && (level === LogLevel.ERROR || context?.critical) ? { 
      context: filteredContext
    } : {})
  });
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
      logAuth(LogLevel.ERROR, 'hash', 'Password hashing failed', { error });
      throw new Error('Password hashing failed');
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
      logAuth(LogLevel.ERROR, 'compare', 'Password verification failed', { error });
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
  const checkLoginAttempts = (username: string): { allowed: boolean; message: string } => {
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
        message: `Account temporarily locked. Please try again in ${remainingTime} minutes.`
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
          logAuth(LogLevel.WARN, 'login_attempt', loginCheck.message, {
            username,
            reason: 'rate_limit',
            critical: true
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

        const handleFailedAttempt = (reason: string) => {
          const newAttempts = {
            count: attempts.count + 1,
            lastAttempt: now,
            lockoutUntil: attempts.count + 1 >= AUTH_CONSTANTS.MAX_ATTEMPTS ? 
              now + AUTH_CONSTANTS.LOCKOUT_TIME : undefined
          };
          loginAttempts.set(ipKey, newAttempts);
          
          if (newAttempts.count >= AUTH_CONSTANTS.MAX_ATTEMPTS) {
            logAuth(LogLevel.WARN, 'account_locked', 'Account locked due to multiple failed attempts', {
              username,
              reason,
              attempts: newAttempts.count,
              critical: true
            });
          }
        };

        if (!user?.password) {
          handleFailedAttempt('invalid_user');
          return done(null, false, { message: "Invalid username or password" });
        }

        const isMatch = await crypto.compare(password, user.password);
        if (!isMatch) {
          handleFailedAttempt('invalid_password');
          return done(null, false, { message: "Invalid username or password" });
        }

        loginAttempts.set(ipKey, {
          count: 0,
          lastAttempt: now,
          lastSuccess: now
        });

        logAuth(LogLevel.INFO, 'login_success', 'Login successful', {
          username,
          critical: true
        });

        return done(null, user);
      } catch (err) {
        logAuth(LogLevel.ERROR, 'auth_error', 'Authentication error occurred', { 
          username,
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
        logAuth(LogLevel.WARN, 'session_error', 'Session user not found', { userId: id });
        return done(null, false);
      }

      done(null, user);
    } catch (err) {
      logAuth(LogLevel.ERROR, 'session_error', 'Session deserialization failed', { 
        userId: id,
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
          message: "Invalid input", 
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
        logAuth(LogLevel.WARN, 'register_error', 'Username already taken', {
          username,
          critical: true
        });
        return res.status(400).json({ 
          message: "Username already taken",
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

      logAuth(LogLevel.INFO, 'register_success', 'Registration successful', {
        username,
        role,
        critical: true
      });

      req.login(newUser, (err) => {
        if (err) {
          return next(err);
        }
        return res.json({
          message: "Registration successful",
          user: { id: newUser.id, username: newUser.username, role: newUser.role },
        });
      });
    } catch (error) {
      logAuth(LogLevel.ERROR, 'register_error', 'Registration failed', {
        username: req.body?.username,
        error
      });
      next(error);
    }
  });

  app.post("/login", (req, res, next) => {
    const result = insertUserSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ 
        message: "Invalid input", 
        errors: result.error.flatten().fieldErrors 
      });
    }

    passport.authenticate("local", (err: any, user: Express.User | false, info: IVerifyOptions) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(401).json({
          message: info.message ?? "Login failed",
          field: "credentials"
        });
      }

      req.logIn(user, (err) => {
        if (err) {
          return next(err);
        }
        return res.json({
          message: "Login successful",
          user: { id: user.id, username: user.username, role: user.role },
        });
      });
    })(req, res, next);
  });

  app.post("/logout", (req, res) => {
    const username = req.user?.username;
    req.logout((err) => {
      if (err) {
        logAuth(LogLevel.ERROR, 'logout_error', 'Logout failed', {
          username,
          error: err
        });
        return res.status(500).json({ message: "Logout failed" });
      }
      
      req.session.destroy((err) => {
        if (err) {
          logAuth(LogLevel.ERROR, 'session_error', 'Session destruction failed', {
            username,
            error: err
          });
          return res.status(500).json({ message: "Session destruction failed" });
        }

        logAuth(LogLevel.INFO, 'logout_success', 'Logout successful', {
          username,
          critical: true
        });

        res.clearCookie('connect.sid');
        res.json({ message: "Logged out successfully" });
      });
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }
    res.json(req.user);
  });
}
