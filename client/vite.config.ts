import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, 'src') },
      { find: /^@\/components\/(.*)$/, replacement: path.resolve(__dirname, 'src/components/$1') },
      { find: /^@\/lib\/(.*)$/, replacement: path.resolve(__dirname, 'src/lib/$1') },
      { find: /^@\/hooks\/(.*)$/, replacement: path.resolve(__dirname, 'src/hooks/$1') },
      { find: /^@\/pages\/(.*)$/, replacement: path.resolve(__dirname, 'src/pages/$1') },
      { find: 'db', replacement: path.resolve(__dirname, '../db') }
    ]
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "../dist/public",
    emptyOutDir: true,
  },
});
