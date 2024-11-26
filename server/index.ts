import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { createServer } from "http";
import cors from "cors";

const app = express();

// CORS設定
app.use(cors({
  origin: process.env.NODE_ENV === "development" ? "http://localhost:5000" : true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

(async () => {
  registerRoutes(app);
  const server = createServer(app);

  // エラーハンドリングミドルウェア
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Error occurred:', err);

    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    const errors = err.errors || undefined;

    // 開発環境の場合、より詳細なエラー情報を返す
    const response = {
      message,
      ...(process.env.NODE_ENV === "development" && {
        stack: err.stack,
        errors,
      }),
      ...(errors && { errors }),
    };

    res.status(status).json(response);
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client
  const PORT = 5000;
  server.listen(PORT, "0.0.0.0", () => {
    const formattedTime = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });

    console.log(`${formattedTime} [express] serving on port ${PORT}`);
  });
})();
