import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, 'src') },
      { find: '@/components', replacement: path.resolve(__dirname, 'src/components') },
      { find: '@/lib', replacement: path.resolve(__dirname, 'src/lib') },
      { find: '@/hooks', replacement: path.resolve(__dirname, 'src/hooks') },
      { find: '@/pages', replacement: path.resolve(__dirname, 'src/pages') },
      { find: '@/types', replacement: path.resolve(__dirname, 'src/types') },
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
