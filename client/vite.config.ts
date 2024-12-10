import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@/components": path.resolve(__dirname, "src/components"),
      "@/lib": path.resolve(__dirname, "src/lib"),
      "@/hooks": path.resolve(__dirname, "src/hooks"),
      "@/pages": path.resolve(__dirname, "src/pages"),
      "@/types": path.resolve(__dirname, "src/types"),
      "db": path.resolve(__dirname, "../db")
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.REPL_SLUG 
          ? `https://${process.env.REPL_SLUG}.repl.co`
          : 'http://localhost:5000',
        changeOrigin: true,
        secure: true,
        ws: true
      }
    },
    hmr: {
      clientPort: process.env.REPL_SLUG ? 443 : undefined,
      host: process.env.REPL_SLUG ? `${process.env.REPL_SLUG}.repl.co` : undefined,
      protocol: process.env.REPL_SLUG ? 'wss' : 'ws'
    }
  },
  build: {
    outDir: "../dist/public",
    emptyOutDir: true
  }
});
