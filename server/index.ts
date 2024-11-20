// External libraries
import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import cors from 'cors';

// Internal modules
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { LogLevel } from "../client/src/types/auth";

// Types
interface ServerError extends Error {
  status?: number;
  statusCode?: number;
  code?: string;
}

/**
 * Structured logging function with filtered output
 * Only logs critical events and errors
 */
function logServer(level: LogLevel, operation: string, message: string, context?: Record<string, unknown>): void {
  // Only log errors and critical events
  const shouldLog = 
    level === LogLevel.ERROR || 
    context?.critical === true;

  if (shouldLog) {
    console.log({
      timestamp: new Date().toISOString(),
      system: 'Server',
      level,
      operation,
      message,
      ...context
    });
  }
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
        message: err.message || "Internal server error",
        code: err.code || 'INTERNAL_ERROR'
      };
      
      // Only log critical errors (500+)
      if (status >= 500) {
        logServer(LogLevel.ERROR, 'error', 'Critical server error', {
          status,
          code: errorResponse.code,
          message: errorResponse.message,
          stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
          critical: true
        });
      }

      if (!res.headersSent) {
        res.status(status).json(errorResponse);
      }
    });

    // Setup Vite or static serving based on environment
    if (process.env.NODE_ENV === 'development') {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    const PORT = Number(process.env.PORT || 5000);
    server.listen(PORT, "0.0.0.0", () => {
      logServer(LogLevel.INFO, 'startup', 'Server started', { 
        port: PORT,
        environment: process.env.NODE_ENV,
        critical: true 
      });
    });
  } catch (error) {
    logServer(LogLevel.ERROR, 'fatal', 'Server startup failed', {
      error: error instanceof Error ? error.message : String(error),
      critical: true
    });
    process.exit(1);
  }
})();
