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
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
        ws: true,
        rewrite: (path) => path
      }
    },
    hmr: {
      clientPort: 443,
      host: 'webview.YOUR-REPL-NAME.repl.co'
    },
    watch: {
      usePolling: true
    }
  },
  build: {
    outDir: "../dist/public",
    emptyOutDir: true
  }
});
