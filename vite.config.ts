import { fengariBrowser, fengariOptimize } from "./fengari-browser";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
export default defineConfig({
  base: "./",

  optimizeDeps: {
    include: [
      "fengari/src/lua.js",
      "fengari/src/lauxlib.js",
      "fengari/src/fengaricore.js",
      "fengari/src/lbaselib.js",
      "fengari/src/lmathlib.js",
      "fengari/src/lstrlib.js",
      "fengari/src/ltablib.js",
      "fengari/src/lutf8lib.js",
    ],
    esbuildOptions: { plugins: [fengariOptimize] },
  },
  worker: { plugins: () => [fengariBrowser()] },
  plugins: [fengariBrowser(), react(), tailwind()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    allowedHosts: [".e2b.app", "localhost"],
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      /* Studio + o jogo de demonstração GORE FORGE. */
      input: { studio: "index.html", goreforge: "goreforge.html" },
    },
  },
});
