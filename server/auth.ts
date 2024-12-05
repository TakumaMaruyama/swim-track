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
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24時間
        sameSite: "lax",
        path: "/"
      },
      proxy: true,
      name: "session-id"
    })
  );

  // ログインエンドポイント
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { password } = req.body;

      if (!password) {
        return res.status(400).json({ message: "パスワードは必須です" });
      }

      // 固定パスワードチェック
      if (password === "seiji") {
        // セッション情報を設定
        req.session.userId = 0; // 固定ID
        req.session.role = "user"; // 一般ユーザーロール
        
        return res.json({
          id: 0,
          username: "一般ユーザー",
          role: "user",
          isActive: true
        });
      }

      return res.status(401).json({ message: "認証に失敗しました" });
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
};
