import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { createServer } from "http";
import cors from 'cors';

const app = express();

// Enhanced CORS configuration
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

(async () => {
  try {
    registerRoutes(app);
    const server = createServer(app);

    // Enhanced error handling middleware with standardized format
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const errorResponse = {
        message: err.message || "サーバーエラーが発生しました",
        code: err.code || 'INTERNAL_ERROR'
      };
      
      // Development logging only for critical errors
      if (app.get("env") === "development" && status >= 500) {
        console.error('[Server Error]', {
          status,
          ...errorResponse,
          stack: err.stack
        });
      }

      if (!res.headersSent) {
        res.status(status).json({
          ...errorResponse,
          ...(app.get("env") === "development" && status >= 500 ? { stack: err.stack } : {})
        });
      }
    });

    // Setup Vite or static serving based on environment
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    const PORT = Number(process.env.PORT || 5000);
    server.listen(PORT, "0.0.0.0", () => {
      if (app.get("env") === "development") {
        console.log(`[Server] Development server running on port ${PORT}`);
      }
    });
  } catch (error) {
    console.error('[Server] Startup error:', error);
    process.exit(1);
  }
})();
