// Copia o jogo exportado para a pasta do app Electron antes do empacotamento.
import fs from "node:fs";
import path from "node:path";

const source = path.join("entregas", "procedural-platformer.html");
const target = path.join("game-desktop", "game.html");

if (!fs.existsSync(source)) {
  console.error("Jogo exportado ausente. Rode: npm run export:game");
  process.exit(1);
}
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(source, target);
console.log(`Jogo copiado para ${target}`);
