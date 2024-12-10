import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { createServer } from "http";
import { configureAuth } from "./auth";
import configuration from "./config";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Enable CORS for development
app.use((req, res, next) => {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const origin = req.headers.origin;
  
  // Development環境では、すべてのオリジンを許可
  if (isDevelopment) {
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin);
    }
  } else {
    // Production環境では、特定のオリジンのみを許可
    const replSlug = process.env.REPL_SLUG;
    const allowedOrigins = [
      replSlug ? `https://${replSlug}.repl.co` : null,
      replSlug ? `https://${replSlug}.repl.co:443` : null,
      replSlug ? `https://webview.${replSlug}.repl.co` : null,
      replSlug ? `https://${replSlug}.id.repl.co` : null
    ].filter(Boolean);
    
    if (origin && allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
    }
  }

  // 共通のCORS設定
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  // プリフライトリクエストの処理
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

// エラーハンドリングの強化
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Server error:', err);
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  
  // 開発環境では詳細なエラー情報を返す
  const error = process.env.NODE_ENV === 'development' 
    ? { message, stack: err.stack }
    : { message };
  
  res.status(status).json(error);
});

// Configure authentication
configureAuth(app);

(async () => {
  registerRoutes(app);
  const server = createServer(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error('Server error:', err);
    res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (configuration.nodeEnv === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Serve the app using configuration port
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, "0.0.0.0", () => {
    const formattedTime = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });

    console.log(`${formattedTime} [express] Server is running on http://0.0.0.0:${PORT}`);
    console.log('Server configuration:', {
      port: PORT,
      env: process.env.NODE_ENV,
      cors: true
    });
  });
})();
