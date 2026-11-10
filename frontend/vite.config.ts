import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development, /api is proxied to the Go server (default http://localhost:8080).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/api": process.env.API_PROXY ?? "http://localhost:8080" },
  },
});
