import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { createServer } from "http";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

(async () => {
  try {
    registerRoutes(app);
    const server = createServer(app);

    // Enhanced error handling middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      console.error('[Server Error]:', {
        status: err.status || err.statusCode || 500,
        message: err.message || "Internal Server Error",
        stack: app.get("env") === "development" ? err.stack : undefined
      });

      // Only send response if it hasn't been sent already
      if (!res.headersSent) {
        const status = err.status || err.statusCode || 500;
        const message = err.message || "Internal Server Error";
        res.status(status).json({ message });
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
      console.log(`[Server] Running on port ${PORT}`);
    });
  } catch (error) {
    console.error('[Server] Startup error:', error);
    process.exit(1);
  }
})();
