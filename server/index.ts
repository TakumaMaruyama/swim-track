import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { createServer } from "http";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 5000;

// CORS設定を先に適用
app.use(cors({
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Cookie", "Set-Cookie"],
  exposedHeaders: ["Set-Cookie"]
}));

// ボディパーサーを設定
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ルートを登録する前にセッション設定を適用
registerRoutes(app);

const server = createServer(app);

// Setup Vite or serve static files
if (app.get("env") === "development") {
  await setupVite(app, server);
} else {
  serveStatic(app);
}

// エラーハンドリングミドルウェアを最後に追加
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ message: "Internal Server Error" });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on port ${PORT} (http://0.0.0.0:${PORT})`);
});
