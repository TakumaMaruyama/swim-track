import express, { type NextFunction, type Request, type Response } from "express";
import type session from "express-session";
import { configureAuth } from "./auth";
import configuration from "./config";
import { registerRoutes } from "./routes";

function expectedRequestOrigin(req: Request) {
  const forwardedProtocol = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProtocol || req.protocol;
  const host = req.get("host");
  return host ? `${protocol}://${host}` : null;
}

export function sameOriginOnly(req: Request, res: Response, next: NextFunction) {
  if (["GET", "HEAD"].includes(req.method)) return next();
  const fetchSite = req.get("sec-fetch-site");
  if (fetchSite === "cross-site") {
    return res.status(403).json({ message: "許可されていない送信元です" });
  }

  const source = req.get("origin") || req.get("referer");
  if (!source) {
    if (configuration.nodeEnv === "production") {
      return res.status(403).json({ message: "許可されていない送信元です" });
    }
    return next();
  }
  try {
    const expected = configuration.nodeEnv === "production"
      ? configuration.publicOrigin
      : expectedRequestOrigin(req);
    if (!expected || new URL(source).origin !== expected) {
      return res.status(403).json({ message: "許可されていない送信元です" });
    }
  } catch {
    return res.status(403).json({ message: "許可されていない送信元です" });
  }
  next();
}

function responsePolicy(req: Request, res: Response, next: NextFunction) {
  if (req.method === "GET") {
    if (req.url.startsWith("/api/") || req.url === "/" || req.url.endsWith(".html")) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    } else {
      res.setHeader("Cache-Control", "public, max-age=60");
      res.setHeader("Vary", "Accept-Encoding");
    }
  } else {
    res.setHeader("Cache-Control", "no-store");
  }
  next();
}

export function createApp(options?: {
  sessionStore?: session.Store;
  includeRoutes?: boolean;
  requestLog?: boolean;
}) {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false, limit: "1mb" }));
  app.use(sameOriginOnly);
  app.use(responsePolicy);
  if (options?.requestLog) {
    app.use((req, res, next) => {
      const startedAt = Date.now();
      res.on("finish", () => {
        console.log(`${req.method} ${req.url} - ${res.statusCode} - ${Date.now() - startedAt}ms`);
      });
      next();
    });
  }
  configureAuth(app, { store: options?.sessionStore });
  if (options?.includeRoutes !== false) registerRoutes(app);
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Server error:", error);
    const status = typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status: unknown }).status) || 500
      : 500;
    res.status(status).json({ message: status === 500 ? "Internal Server Error" : "Request failed" });
  });
  return app;
}
