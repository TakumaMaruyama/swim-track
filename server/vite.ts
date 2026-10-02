import express, { type Express } from "express";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { type Server } from "http";

export async function setupVite(app: Express, server: Server) {
  const vite = await createViteServer({
    server: {
      middlewareMode: true,
      hmr: { server },
    },
    clearScreen: false,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        __dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");

      template = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(template);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express, distPath = path.resolve(__dirname, "public")) {
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use("/assets", (req, res, next) => {
    res.vary("Accept-Encoding");
    // Build-time gzip avoids compressing on every Autoscale request. Restrict
    // filenames to Vite's flat asset directory; sendFile also enforces its root.
    if (["GET", "HEAD"].includes(req.method) &&
        /^\/[\w.-]+\.(js|css)$/.test(req.path) && req.acceptsEncodings("gzip")) {
      const fileName = `${req.path.slice(1)}.gz`;
      const assetRoot = path.join(distPath, "assets");
      if (fs.existsSync(path.join(assetRoot, fileName))) {
        res.type(req.path.endsWith(".css") ? "css" : "js");
        res.setHeader("Content-Encoding", "gzip");
        res.sendFile(fileName, { root: assetRoot }, (error) => { if (error) next(error); });
        return;
      }
    }
    next();
  }, express.static(path.join(distPath, "assets")), (_req, res) => {
    // A retired chunk must be a 404, never index.html cached as JavaScript.
    res.status(404).setHeader("Cache-Control", "no-store");
    res.end();
  });

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
