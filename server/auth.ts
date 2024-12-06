import { type Express, Request, Response } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";

export function configureAuth(app: Express) {
  // セッション設定
  const MemoryStore = createMemoryStore(session);
  const sessionSettings: session.SessionOptions = {
    secret: process.env.REPL_ID || "swimtrack-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {},
    store: new MemoryStore({
      checkPeriod: 86400000, // 24時間ごとに期限切れのエントリを削除
    }),
  };

  if (app.get("env") === "production") {
    app.set("trust proxy", 1);
    sessionSettings.cookie = {
      secure: true,
    };
  }

  app.use(session(sessionSettings));

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
        req.session.userId = 0; // 一般ユーザー用の固定ID
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

  // セッション確認エンドポイント
  app.get("/api/auth/session", (req: Request, res: Response) => {
    if (req.session.userId !== undefined) {
      return res.json({
        id: req.session.userId,
        username: "一般ユーザー",
        role: req.session.role,
        isActive: true
      });
    }
    res.status(401).json({ message: "未認証" });
  });

  // ログアウトエンドポイント
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "ログアウトに失敗しました" });
      }
      res.json({ message: "ログアウトしました" });
    });
  });
}
