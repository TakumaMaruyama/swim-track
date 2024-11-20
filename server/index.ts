// External libraries
import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import cors from 'cors';

// Internal modules
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";

// Types
interface ServerError extends Error {
  status?: number;
  statusCode?: number;
  code?: string;
}

/** Log levels enum */
enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info'
}

/**
 * Structured logging function
 */
function logServer(level: LogLevel, message: string, context?: Record<string, unknown>) {
  console.log('[Server]', {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context
  });
}

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
    app.use((err: ServerError, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const errorResponse = {
        message: err.message || "サーバーエラーが発生しました",
        code: err.code || 'INTERNAL_ERROR'
      };
      
      // Only log critical errors (500+)
      if (status >= 500) {
        logServer(LogLevel.ERROR, 'Critical Error', {
          status,
          code: errorResponse.code,
          message: errorResponse.message,
          stack: app.get("env") === "development" ? err.stack : undefined
        });
      } else {
        logServer(LogLevel.WARN, 'Client Error', {
          status,
          code: errorResponse.code,
          message: errorResponse.message
        });
      }

      if (!res.headersSent) {
        res.status(status).json(errorResponse);
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
      logServer(LogLevel.INFO, 'Server started', { port: PORT });
    });
  } catch (error) {
    logServer(LogLevel.ERROR, 'Fatal Error', {
      message: 'Server startup failed',
      error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  }
})();
