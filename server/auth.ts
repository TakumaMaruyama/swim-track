import { eq } from "drizzle-orm";
import { db } from "db";
import { users } from "db/schema";
import bcrypt from "bcryptjs";
import { Request, Response } from "express";
import session from "express-session";
import MemoryStore from "memorystore";

declare module "express-session" {
  interface SessionData {
    userId: number;
    role: string;
  }
}

export const configureAuth = (app: any) => {
  const MemoryStoreSession = MemoryStore(session);

  // セッション設定
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "your-secret-key",
      resave: false,
      saveUninitialized: false,
      store: new MemoryStoreSession({
        checkPeriod: 86400000 // 24時間でメモリをクリーンアップ
      }),
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24時間
      }
    })
  );

  // ログインエンドポイント
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      console.log(`Login attempt for username: ${username}`);

      if (!username || !password) {
        console.log("Login failed: Missing username or password");
        return res.status(400).json({ message: "ユーザー名とパスワードは必須です" });
      }

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      console.log(`User lookup result: ${user ? 'Found' : 'Not found'}`);
      
      if (!user) {
        console.log(`Login failed: User not found - ${username}`);
        return res.status(401).json({ message: "認証に失敗しました" });
      }

      console.log("Comparing password hashes...");
      const isValidPassword = await bcrypt.compare(password, user.password);
      console.log(`Password validation result: ${isValidPassword ? 'Valid' : 'Invalid'}`);
      
      if (!isValidPassword) {
        console.log(`Login failed: Invalid password for user - ${username}`);
        return res.status(401).json({ message: "認証に失敗しました" });
      }

      if (!user.isActive) {
        console.log(`Login failed: Inactive account - ${username}`);
        return res.status(403).json({ message: "アカウントが無効化されています" });
      }

      // セッションにユーザー情報を保存
      req.session.userId = user.id;
      req.session.role = user.role;

      // セッションを保存
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          resolve();
        });
      });

      // パスワードを除外してユーザー情報を返す
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "ログイン処理中にエラーが発生しました" });
    }
  });

  // ログアウトエンドポイント
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "ログアウト処理中にエラーが発生しました" });
      }
      res.json({ message: "ログアウトしました" });
    });
  });

  // セッション確認エンドポイント
  app.get("/api/auth/session", async (req: Request, res: Response) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "未認証です" });
      }

      // セッションのユーザーIDを使用してユーザー情報を取得
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, req.session.userId))
        .limit(1);

      if (!user) {
        return res.status(401).json({ message: "ユーザーが見つかりません" });
      }

      // パスワードを除外してユーザー情報を返す
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Session check error:", error);
      res.status(500).json({ message: "セッション確認中にエラーが発生しました" });
    }
  });

  // 管理者確認ミドルウェア
  app.use("/api/admin/*", (req: Request, res: Response, next: Function) => {
    if (req.session.role !== "admin") {
      return res.status(403).json({ message: "管理者権限が必要です" });
    }
    next();
  });
};

// パスワードのハッシュ化ユーティリティ
export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};
