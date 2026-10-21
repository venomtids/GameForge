import { fengariBrowser } from "./fengari-browser";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

/**
 * Build do GORE FORGE como ARQUIVO ÚNICO.
 *
 * Gera `entregas/goreforge.html`: um HTML autossuficiente (engine + jogo + UI
 * embutidos) que abre no navegador por file:// — sem servidor, sem instalar
 * nada. É o mesmo caminho usado pelo player exportado do Studio.
 */
export default defineConfig({
  base: "./",
  worker: { plugins: () => [fengariBrowser()] },
  plugins: [fengariBrowser(), viteSingleFile()],
  publicDir: false,
  build: {
    outDir: "entregas",
    emptyOutDir: false,
    rollupOptions: { input: "goreforge.html" },
  },
});
