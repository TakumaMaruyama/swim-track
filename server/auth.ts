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
const crypto = {
  hash: async (password: string) => {
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString("hex")}.${salt}`;
  },
  compare: async (suppliedPassword: string, storedPassword: string) => {
    try {
      const [hashedPassword, salt] = storedPassword.split(".");
      if (!hashedPassword || !salt) return false;
      
      const hashedPasswordBuf = Buffer.from(hashedPassword, "hex");
      const suppliedPasswordBuf = (await scryptAsync(
        suppliedPassword,
        salt,
        64
      )) as Buffer;
      
      return timingSafeEqual(hashedPasswordBuf, suppliedPasswordBuf);
    } catch (error) {
      console.error("Password comparison error:", error);
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
    resave: true,
    saveUninitialized: true,
    rolling: true,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: 'auto',
      sameSite: 'lax'
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
      done(err);
    }
  });

  app.post("/register", async (req, res, next) => {
    try {
      const result = insertUserSchema.safeParse(req.body);
      if (!result.success) {
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
    if (req.isAuthenticated()) {
      console.log('[Auth] User session validated');
      return res.json(req.user);
    }
    console.log('[Auth] No valid session found');
    res.status(401).json({ message: "認証が必要です" });
  });
}
