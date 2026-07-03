import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    // En dev, /api est relayé vers l'API FastAPI (port 8000) : pas de CORS.
    proxy: {
      // API civic (transport/politique) — service distinct en dev (port 8001).
      "/civic-api": {
        target: process.env.VITE_CIVIC_API_TARGET ?? "http://localhost:8001",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/civic-api/, "/api"),
      },
      "/api": {
        target: process.env.VITE_API_TARGET ?? "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
})
