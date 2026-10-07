import { createHash } from "node:crypto";
import { escreverZip } from "./lib/zip.mjs";
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
const MARCA_INICIO = "---GORE-FORGE:INICIO---";
const MARCA_FIM = "---GORE-FORGE:FIM---";
const NOME_UNICO = "GORE-FORGE-Instalador.cmd";

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
const entradasZip = [];
for (const arquivo of [...arquivos, "SHA256SUMS.txt"])
  entradasZip.push({
    caminho: `${pastaZip}/${arquivo}`,
    dados: await readFile(path.join(destino, arquivo)),
    data: infoJogo.mtimeMs,
  });
const dadosZip = escreverZip(entradasZip);
await writeFile(caminhoZip, dadosZip);
const infoZip = await stat(caminhoZip);

// 7) instalador ÚNICO: o mesmo .cmd carrega o ZIP inteiro embutido em base64
const cabecalho = semMarcador(
  comVersao(await readFile(path.join(origem, "Instalador-Unico.cmd"), "utf8")),
  "Instalador-Unico.cmd",
);
if (/[^\x09\x0a\x0d\x20-\x7e]/.test(cabecalho))
  throw new Error(
    "Instalador-Unico.cmd precisa ser ASCII puro (o cmd.exe lê o arquivo por inteiro)",
  );
if (!cabecalho.includes(MARCA_INICIO + "\n"))
  throw new Error(
    `Instalador-Unico.cmd precisa terminar com a linha ${MARCA_INICIO}`,
  );
if (/[^\x09\x0a\x0d\x20-\x7e]/.test(cabecalho.split(MARCA_INICIO)[0]))
  throw new Error("o cabeçalho do instalador único tem byte não-ASCII");
// o marcador de início só pode existir UMA vez no cabeçalho: se aparecer antes
// (comentário, comando do PowerShell...), o IndexOf acha o lugar errado e a
// extração pega lixo. O de fim é acrescentado aqui embaixo.
const vezesInicio = cabecalho.split(MARCA_INICIO).length - 1;
if (vezesInicio !== 1)
  throw new Error(
    `o cabeçalho do instalador único tem ${vezesInicio} ocorrência(s) de ${MARCA_INICIO} (esperado exatamente 1)`,
  );
if (cabecalho.includes(MARCA_FIM))
  throw new Error(
    `o cabeçalho do instalador único não pode conter ${MARCA_FIM}`,
  );
const base64 = (await readFile(caminhoZip)).toString("base64");
const linhas = base64.match(/.{1,100}/g).join("\n");
const unico = `${cabecalho}${linhas}\n${MARCA_FIM}\n`;
await writeFile(path.join(destino, "..", NOME_UNICO), unico, "latin1");
const caminhoUnico = path.join(root, "entregas", NOME_UNICO);
const infoUnico = await stat(caminhoUnico);

// 7b) o próprio builder confere que o que foi escrito volta a ser o ZIP (mesma
// conta que o bootstrap do PowerShell faz: IndexOf + limpeza + FromBase64String)
const relido = await readFile(caminhoUnico, "latin1");
const a = relido.indexOf(MARCA_INICIO);
const b = relido.indexOf(MARCA_FIM);
const volta = Buffer.from(
  relido.slice(a + MARCA_INICIO.length, b).replace(/[^A-Za-z0-9+/=]/g, ""),
  "base64",
);
if (sha256(volta) !== sha256(await readFile(caminhoZip)))
  throw new Error(
    "o pacote embutido no instalador único não volta idêntico ao ZIP",
  );
for (const marca of [MARCA_INICIO, MARCA_FIM]) {
  const vezes = unico.split(marca).length - 1;
  if (vezes !== 1)
    throw new Error(
      `${NOME_UNICO} tem ${vezes} ocorrência(s) de ${marca} (esperado exatamente 1)`,
    );
}

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
  `  único : ${path.relative(root, caminhoUnico)} (${mb(infoUnico.size)}) -> dois cliques e instala`,
);
console.log(`  sha256: ${sha256(await readFile(caminhoUnico))}`);
console.log(
  "Instale no Windows com dois cliques no instalador único (ou no `Instalar GORE FORGE.cmd` do pacote).",
);
