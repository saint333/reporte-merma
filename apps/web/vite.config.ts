import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ["recharts"],
          query: ["@tanstack/react-query"],
          router: ["react-router-dom"],
        },
      },
    },
  },
});
