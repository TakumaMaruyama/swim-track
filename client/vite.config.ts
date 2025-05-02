import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    force: true, // Force dependency optimization on startup
    exclude: ['@radix-ui/react-tabs'], // Exclude problematic dependencies
  },
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
    cors: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
        ws: true,
        timeout: 30000, // Increase timeout to 30 seconds
        proxyTimeout: 30000, // Explicitly set proxy timeout
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        }
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
