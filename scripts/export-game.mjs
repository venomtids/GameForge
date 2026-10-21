// Exporta o projeto atual como jogo standalone (HTML único, offline).
// Uso: node scripts/export-game.mjs <projeto.gameforge.json> [saida.html]
import fs from "node:fs";
import path from "node:path";

const projectPath = process.argv[2] ?? "Procedural-Platformer.gameforge.json";
const outputPath =
  process.argv[3] ?? path.join("entregas", path.basename(projectPath).replace(/\.gameforge\.json$/i, "") + ".html");
const playerPath = "dist/player.html";

const project = JSON.parse(fs.readFileSync(projectPath, "utf8"));
const encoder = new TextEncoder();

/** Espelha src/engine/serialization.ts */
function serializeProject(p, pretty = false) {
  let content = JSON.stringify(p, null, pretty ? 2 : undefined);
  if (pretty && encoder.encode(content).byteLength > 8_000_000)
    content = JSON.stringify(p);
  if (encoder.encode(content).byteLength > 8_000_000)
    throw new Error("O projeto excede 8 MB.");
  return content;
}
function encodeProject(p) {
  const bytes = encoder.encode(serializeProject(p));
  let binary = "";
  for (let i = 0; i < bytes.length; i += 32768)
    binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(binary);
}

if (!fs.existsSync(playerPath)) {
  console.error("Runtime de exportacao ausente. Rode: npm run build:player");
  process.exit(1);
}
const template = fs.readFileSync(playerPath, "utf8");
const marker = "__GAMEFORGE_PROJECT_DATA__";
if (!template.includes(marker)) {
  console.error("Runtime de exportacao invalido.");
  process.exit(1);
}
const html = template.replace(marker, encodeProject(project));
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, html);
console.log(
  `Jogo exportado: ${outputPath} (${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB) — abra com dois cliques.`,
);
