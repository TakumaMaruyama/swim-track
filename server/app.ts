import express from "express";
import type session from "express-session";
import { configureAuth } from "./auth";
import { registerRoutes } from "./routes";

/**
 * Creates the API application without binding a port. Tests can module-mock
 * the database/session boundary before importing this factory.
 */
export function createApp(options?: { sessionStore?: session.Store; includeRoutes?: boolean }) {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  configureAuth(app, { store: options?.sessionStore });
  if (options?.includeRoutes !== false) registerRoutes(app);
  return app;
}