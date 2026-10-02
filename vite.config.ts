import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { gzipSync } from "node:zlib";
import { readFile, writeFile } from "node:fs/promises";

export default defineConfig({
  plugins: [react(), {
    name: "precompress-static-assets",
    async writeBundle(options, bundle) {
      if (!options.dir) throw new Error("Static compression requires an output directory");
      // Read the final files: Vite rewrites preload dependencies and CSS after
      // user generateBundle hooks, so compressing an earlier chunk is unsafe.
      for (const fileName of Object.keys(bundle)) {
        if (!/\.(js|css)$/.test(fileName)) continue;
        const output = path.join(options.dir, fileName);
        await writeFile(`${output}.gz`, gzipSync(await readFile(output)));
      }
    },
  }],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      db: path.resolve(__dirname, "db"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
});
