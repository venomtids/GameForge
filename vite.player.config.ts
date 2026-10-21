import { fengariBrowser } from "./fengari-browser";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
export default defineConfig({
  base: "./",
  worker: { plugins: () => [fengariBrowser()] },
  plugins: [fengariBrowser(), viteSingleFile()],
  publicDir: false,
  build: {
    outDir: "public",
    emptyOutDir: false,
    rollupOptions: { input: "player.html" },
  },
});
