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
    store: new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    }),
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/'
    }
  };

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        console.log('[Auth] Attempting login for user:', username);
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.username, username))
          .limit(1);

        if (!user?.password) {
          console.log('[Auth] User not found or no password');
          return done(null, false, { 
            message: "ユーザー名またはパスワードが正しくありません。" 
          });
        }

        const isMatch = await crypto.compare(password, user.password);
        if (!isMatch) {
          console.log('[Auth] Password mismatch');
          return done(null, false, { 
            message: "ユーザー名またはパスワードが正しくありません。"
          });
        }

        console.log('[Auth] Login successful for user:', username);
        return done(null, user);
      } catch (err) {
        console.error('[Auth] Login error:', err);
        return done(err);
      }
    })
  );

  passport.serializeUser((user, done) => {
    console.log('[Auth] Serializing user:', user.id);
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      console.log('[Auth] Deserializing user:', id);
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      
      if (!user) {
        console.log('[Auth] User not found during deserialization');
        return done(null, false);
      }

      console.log('[Auth] User deserialized successfully');
      done(null, user);
    } catch (err) {
      console.error('[Auth] Deserialization error:', err);
      done(err);
    }
  });

  app.post("/login", (req, res, next) => {
    console.log('[Auth] Processing login request');
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
        console.log('[Auth] Login successful, session established');
        return res.json({
          message: "ログインしました",
          user: { id: user.id, username: user.username, role: user.role },
        });
      });
    })(req, res, next);
  });

  app.post("/logout", (req, res) => {
    const username = req.user?.username;
    console.log('[Auth] Processing logout request for user:', username);
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
        res.clearCookie('connect.sid');
        console.log('[Auth] Logout successful');
        res.json({ message: "ログアウトしました" });
      });
    });
  });

  app.get("/api/user", (req, res) => {
    if (req.isAuthenticated()) {
      console.log('[Auth] User session validated:', req.user.id);
      return res.json(req.user);
    }
    console.log('[Auth] No valid session found');
    res.status(401).json({ message: "認証が必要です" });
  });
}
