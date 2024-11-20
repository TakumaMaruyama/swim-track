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
        console.error('[Server]', {
          type: 'error',
          status,
          ...errorResponse,
          stack: app.get("env") === "development" ? err.stack : undefined
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
      console.log('[Server]', { 
        event: 'startup',
        message: `Server running on port ${PORT}` 
      });
    });
  } catch (error) {
    console.error('[Server]', { 
      type: 'fatal_error',
      message: 'Fatal startup error',
      error 
    });
    process.exit(1);
  }
})();
