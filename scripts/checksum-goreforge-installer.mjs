import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { copyFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Fecha a entrega do instalador do GORE FORGE em `dist/windows-goreforge/`:
 * soma SHA-256 do `.exe` do NSIS, cópia do instalador leve (arquivo único) e do
 * leia-me, e o `SHA256SUMS.txt` que acompanha a release.
 *
 *   node scripts/checksum-goreforge-installer.mjs
 */
const root = process.cwd();
const pasta = path.join(root, "dist/windows-goreforge");
const leve = path.join(root, "entregas/GORE-FORGE-Instalador.cmd");
const leiaMe = path.join(root, "packaging/LEIA-ME-GOREFORGE-WINDOWS.txt");

const instaladores = (await readdir(pasta).catch(() => [])).filter((nome) =>
  nome.endsWith("-Setup.exe"),
);
if (!instaladores.length)
  throw new Error(
    "Nenhum instalador em dist/windows-goreforge. Rode `npm run desktop:goreforge` primeiro (Windows ou wine).",
  );

await copyFile(leve, path.join(pasta, path.basename(leve)));
await copyFile(leiaMe, path.join(pasta, "LEIA-ME-WINDOWS.txt"));

const arquivos = [...instaladores.sort(), path.basename(leve)];
const linhas = [];
for (const nome of arquivos) {
  const hash = createHash("sha256");
  for await (const pedaco of createReadStream(path.join(pasta, nome)))
    hash.update(pedaco);
  linhas.push(`${hash.digest("hex")}  ${nome}`);
}
await writeFile(path.join(pasta, "SHA256SUMS.txt"), linhas.join("\n") + "\n");

console.log("Entrega do GORE FORGE pronta em dist/windows-goreforge/");
for (const linha of linhas) console.log(`  ${linha}`);
console.log("  LEIA-ME-WINDOWS.txt");
