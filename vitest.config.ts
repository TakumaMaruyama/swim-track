import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  resolve: {
    alias: {
      "@": path.resolve(root, "client/src"),
      db: path.resolve(root, "db"),
    },
  },
  test: {
    include: ["client/src/**/*.test.{ts,tsx}", "server/**/*.test.{ts,tsx}"],
    clearMocks: true,
  },
});