import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  copyFile,
  mkdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

/**
 * Monta o INSTALADOR DO GORE FORGE para Windows.
 *
 * O jogo é um arquivo único (`entregas/goreforge.html`), então o instalador é
 * um pacote pequeno e auditável: um lançador `.cmd` + a lógica em PowerShell
 * (`packaging/goreforge-installer/`) + o próprio jogo + o ícone. Tudo é gerado
 * aqui, com a versão do `package.json` injetada nos textos.
 *
 *   npm run installer:goreforge
 *
 * Saída:
 *   entregas/GORE-FORGE-Instalador/            pasta do pacote (para conferir)
 *   entregas/GORE-FORGE-Instalador-Windows.zip  -> é isso que o usuário baixa
 */

const root = process.cwd();
const origem = path.join(root, "packaging/goreforge-installer");
const jogo = path.join(root, "entregas/goreforge.html");
const icone = path.join(root, "packaging/gameforge.ico");
const destino = path.join(root, "entregas/GORE-FORGE-Instalador");
const nomeZip = "GORE-FORGE-Instalador-Windows.zip";
const pastaZip = path.basename(destino);
const BOM = "\uFEFF";

const pacote = JSON.parse(
  await readFile(path.join(root, "package.json"), "utf8"),
);
const versao = pacote.version;

const infoJogo = await stat(jogo).catch(() => null);
if (!infoJogo || infoJogo.size < 300_000)
  throw new Error(
    "entregas/goreforge.html não existe (ou está pequeno demais): rode `npm run build:goreforge` antes.",
  );
const infoIcone = await stat(icone).catch(() => null);
if (!infoIcone) throw new Error(`ícone não encontrado: ${icone}`);

const comVersao = (texto) => texto.replaceAll("@@VERSAO@@", versao);
const semMarcador = (texto, nome) => {
  if (texto.includes("@@"))
    throw new Error(`${nome} ainda tem marcador não substituído (@@...@@)`);
  return texto;
};
const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");
const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

await rm(destino, { recursive: true, force: true });
await mkdir(destino, { recursive: true });

// 1) lançador .cmd — copiado cru (tem de continuar ASCII, sem BOM: é o cmd.exe que lê)
const lancador = comVersao(
  await readFile(path.join(origem, "Instalar GORE FORGE.cmd"), "utf8"),
);
semMarcador(lancador, "Instalar GORE FORGE.cmd");
if (/[^\x09\x0a\x0d\x20-\x7e]/.test(lancador))
  throw new Error(
    "o lançador .cmd precisa ser ASCII puro (cmd.exe não lê acentos com segurança)",
  );
await writeFile(
  path.join(destino, "Instalar GORE FORGE.cmd"),
  lancador,
  "latin1",
);

// 2) PowerShell — UTF-8 COM BOM (Windows PowerShell 5.1 lê assim os acentos)
const instalador = semMarcador(
  comVersao(await readFile(path.join(origem, "Instalador.ps1"), "utf8")),
  "Instalador.ps1",
);
await writeFile(path.join(destino, "Instalador.ps1"), BOM + instalador, "utf8");

// 3) jogo + ícone
await copyFile(jogo, path.join(destino, "goreforge.html"));
await copyFile(icone, path.join(destino, "gameforge.ico"));

// 4) leia-me (UTF-8 com BOM: abre certo no Bloco de Notas)
const leiaMe = semMarcador(
  comVersao(await readFile(path.join(origem, "LEIA-ME.txt"), "utf8")),
  "LEIA-ME.txt",
);
await writeFile(path.join(destino, "LEIA-ME.txt"), BOM + leiaMe, "utf8");

// 5) conferência de integridade dentro do pacote
const arquivos = [
  "Instalar GORE FORGE.cmd",
  "Instalador.ps1",
  "LEIA-ME.txt",
  "gameforge.ico",
  "goreforge.html",
];
const somas = [];
for (const arquivo of arquivos)
  somas.push(
    `${sha256(await readFile(path.join(destino, arquivo)))}  ${arquivo}`,
  );
await writeFile(
  path.join(destino, "SHA256SUMS.txt"),
  somas.join("\n") + "\n",
  "utf8",
);

// 6) zip (com a pasta por dentro, para extrair limpo no Windows)
const caminhoZip = path.join(root, "entregas", nomeZip);
await rm(caminhoZip, { force: true });
execFileSync("zip", ["-q", "-r", "-X", nomeZip, pastaZip], {
  cwd: path.join(root, "entregas"),
});
const infoZip = await stat(caminhoZip);

console.log(`Instalador do GORE FORGE ${versao} montado`);
console.log(`  pasta: ${path.relative(root, destino)}`);
for (const arquivo of [...arquivos, "SHA256SUMS.txt"]) {
  const tamanho = (await stat(path.join(destino, arquivo))).size;
  console.log(`    ${arquivo.padEnd(24)} ${mb(tamanho).padStart(9)}`);
}
console.log(
  `  zip ..: ${path.relative(root, caminhoZip)} (${mb(infoZip.size)})`,
);
console.log(`  sha256: ${sha256(await readFile(caminhoZip))}`);
console.log(
  "Instale no Windows com dois cliques em `Instalar GORE FORGE.cmd`.",
);
