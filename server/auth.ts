import { eq } from "drizzle-orm";
import { db } from "db";
import { users } from "db/schema";
import bcrypt from "bcryptjs";
import { Request, Response } from "express";
import session from "express-session";

declare module "express-session" {
  interface SessionData {
    userId: number;
    role: string;
  }
}

export const configureAuth = (app: any) => {
  // セッション設定
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "your-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24時間
        sameSite: "lax",
        path: "/"
      },
      proxy: true
    })
  );

  // ログインエンドポイント
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ message: "ユーザー名とパスワードは必須です" });
      }

      // 一般ユーザーの固定パスワードチェック
      if (username === "general_user" && password === "seiji") {
        // 一般ユーザー用のセッション情報を設定
        req.session.userId = 0; // 一般ユーザー用の固定ID
        req.session.role = "user"; // 一般ユーザーロール
        
        return res.json({
          id: 0,
          username: "general_user",
          role: "user",
          isActive: true
        });
      }

      // 管理者ユーザーの認証
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (!user) {
        return res.status(401).json({ message: "認証に失敗しました" });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "認証に失敗しました" });
      }

      // セッションにユーザー情報を保存
      req.session.userId = user.id;
      req.session.role = user.role;

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
  app.get("/api/auth/session", (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "未認証です" });
    }
    res.json({
      userId: req.session.userId,
      role: req.session.role
    });
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
