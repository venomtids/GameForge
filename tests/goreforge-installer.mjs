import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";
import assert from "node:assert/strict";
import path from "node:path";

/**
 * Verifica o INSTALADOR DO GORE FORGE (entregas/GORE-FORGE-Instalador-Windows.zip).
 *
 * Sem navegador e sem Windows: confere o que dá para conferir de verdade aqui —
 * os arquivos do pacote, os textos de segurança do .cmd/.ps1, as somas SHA256 e
 * o conteúdo do ZIP (cada entrada é descomprimida e comparada byte a byte com o
 * arquivo em disco, para garantir que o que o usuário baixa é o que foi montado).
 *
 *   npm run test:installer:goreforge
 */

const root = process.cwd();
const pastaPacote = path.join(root, "entregas/GORE-FORGE-Instalador");
const caminhoZip = path.join(
  root,
  "entregas/GORE-FORGE-Instalador-Windows.zip",
);
const versao = JSON.parse(
  await readFile(path.join(root, "package.json"), "utf8"),
).version;
const arquivosEsperados = [
  "Instalar GORE FORGE.cmd",
  "Instalador.ps1",
  "LEIA-ME.txt",
  "SHA256SUMS.txt",
  "gameforge.ico",
  "goreforge.html",
];

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");

// 0) se o pacote ainda não foi montado, monta agora (o jogo precisa existir)
const faltaPacote = !(await stat(pastaPacote).catch(() => null));
if (faltaPacote) {
  assert.ok(
    await stat(path.join(root, "entregas/goreforge.html")).catch(() => null),
    "entregas/goreforge.html não existe: rode `npm run build:goreforge` antes",
  );
  execFileSync(process.execPath, ["scripts/build-goreforge-installer.mjs"], {
    stdio: "ignore",
  });
  console.log(
    "PASS instalador: pacote ausente, montado agora pelo script de build",
  );
}

// 1) arquivos do pacote
for (const arquivo of arquivosEsperados)
  assert.ok(
    await stat(path.join(pastaPacote, arquivo)).catch(() => null),
    `faltou ${arquivo} no pacote`,
  );
console.log(`PASS instalador: ${arquivosEsperados.length} arquivos no pacote`);

// 2) o jogo dentro do pacote é EXATAMENTE o arquivo único entregue
const bytesJogo = await readFile(path.join(pastaPacote, "goreforge.html"));
const bytesOficial = await readFile(path.join(root, "entregas/goreforge.html"));
assert.equal(
  sha256(bytesJogo),
  sha256(bytesOficial),
  "o goreforge.html do instalador difere do arquivo único gerado por build:goreforge",
);
assert.ok(
  bytesJogo.length > 300_000,
  `jogo pequeno demais: ${bytesJogo.length} bytes`,
);
assert.ok(
  !bytesJogo.includes(Buffer.from('src="/src/')),
  "o instalador está levando um build que aponta para o servidor de dev",
);
console.log(
  `PASS instalador: jogo idêntico ao arquivo único (${(bytesJogo.length / 1024 / 1024).toFixed(2)} MB, sha256 ${sha256(bytesJogo).slice(0, 12)}…)`,
);

// 3) lançador .cmd: ASCII puro, sem BOM (senão o cmd.exe quebra) e com os passos certos
const bytesCmd = await readFile(
  path.join(pastaPacote, "Instalar GORE FORGE.cmd"),
);
assert.notDeepEqual(
  [...bytesCmd.subarray(0, 3)],
  [0xef, 0xbb, 0xbf],
  "Instalar GORE FORGE.cmd tem BOM: o cmd.exe não executa o arquivo direito",
);
const cmd = bytesCmd.toString("latin1");
assert.ok(
  !/[^\x09\x0a\x0d\x20-\x7e]/.test(cmd),
  "Instalar GORE FORGE.cmd tem byte não-ASCII",
);
for (const trecho of [
  "chcp 65001",
  "goreforge.html",
  "Instalador.ps1",
  "Unblock-File",
  "ERRORLEVEL",
  "pause",
])
  assert.ok(
    cmd.includes(trecho),
    `lançador .cmd sem o trecho obrigatório: ${trecho}`,
  );
console.log(
  "PASS instalador: lançador .cmd é ASCII puro, sem BOM, com desbloqueio de arquivo",
);

// 4) PowerShell: BOM obrigatório (é assim que o Windows PowerShell 5.1 lê os acentos)
const bytesPs = await readFile(path.join(pastaPacote, "Instalador.ps1"));
assert.deepEqual(
  [...bytesPs.subarray(0, 3)],
  [0xef, 0xbb, 0xbf],
  "Instalador.ps1 precisa de BOM UTF-8 para os acentos saírem certos no console",
);
const ps = bytesPs.toString("utf8");
for (const trecho of [
  "param(",
  "$Desinstalar",
  "$env:LOCALAPPDATA",
  "WScript.Shell",
  "Obter-PastaUsuario",
  "[Environment]::GetFolderPath",
  '"GORE FORGE.lnk"',
  "Uninstall\\GORE FORGE",
  "UninstallString",
  "--app=",
  "Desinstalar GORE FORGE.cmd",
  "goreforge-desinstalar.ps1",
  "-Encoding ASCII",
  "exit $codigo",
])
  assert.ok(
    ps.includes(trecho),
    `Instalador.ps1 sem o trecho obrigatório: ${trecho}`,
  );
assert.ok(!ps.includes("@@"), "sobrou marcador @@...@@ no Instalador.ps1");
assert.match(
  ps,
  new RegExp(`\\$Versao\\s+= "${versao.replace(/\./g, "\\.")}"`, "m"),
  `versão ${versao} não injetada`,
);
assert.ok(
  ps.split("\n").length > 120,
  "Instalador.ps1 curto demais para conter a lógica toda",
);
assert.ok(
  ps.endsWith("exit $codigo\n"),
  "Instalador.ps1 deveria terminar com exit $codigo",
);
console.log(
  `PASS instalador: PowerShell com BOM, versão ${versao} e todos os pontos de instalação`,
);

// 5) balanço de chaves/parênteses fora de strings e comentários (pega erro de sintaxe grosseiro)
const balancear = (texto, nome) => {
  const pilha = [];
  let emLinha = false;
  let emBloco = false;
  let aspas = null;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    const proximo = texto[i + 1];
    if (aspas) {
      if (c === "`") {
        i++;
        continue;
      }
      if (c === aspas) aspas = null;
      continue;
    }
    if (emLinha) {
      if (c === "\n") emLinha = false;
      continue;
    }
    if (emBloco) {
      if (c === "#" && proximo === ">") {
        emBloco = false;
        i++;
      }
      continue;
    }
    if (c === "<" && proximo === "#") {
      emBloco = true;
      i++;
      continue;
    }
    if (c === "#") {
      emLinha = true;
      continue;
    }
    if (c === '"' || c === "'") {
      aspas = c;
      continue;
    }
    if (c === "{" || c === "(" || c === "[") pilha.push(c);
    if (c === "}" || c === ")" || c === "]") {
      const abre = { "}": "{", ")": "(", "]": "[" }[c];
      assert.equal(
        pilha.pop(),
        abre,
        `${nome}: fecha "${c}" sem abrir "${abre}"`,
      );
    }
  }
  assert.equal(
    pilha.length,
    0,
    `${nome}: ${pilha.length} delimitador(es) sem fechar`,
  );
};
balancear(ps, "Instalador.ps1");
console.log("PASS instalador: PowerShell com delimitadores balanceados");

// 5b) nenhum helper chamado por engano (pega erro de digitação tipo Escrever-Oks)
const definidos = new Set(
  [...ps.matchAll(/^function\s+([A-Za-z][\w-]*)/gm)].map((m) => m[1]),
);
const chamados = new Set(
  [
    ...ps.matchAll(
      /(?:^|\s)((?:Escrever|Novo|Obter|Converter|Normalizar|Remover|Instalar|Desinstalar)-[A-Za-z]+)/gm,
    ),
  ].map((m) => m[1]),
);
assert.ok(
  definidos.size >= 8,
  `poucas funções definidas: ${[...definidos].join(", ")}`,
);
for (const nome of chamados)
  assert.ok(
    definidos.has(nome),
    `Instalador.ps1 chama "${nome}", que não é definido em lugar nenhum`,
  );
console.log(
  `PASS instalador: ${chamados.size} helpers chamados, todos definidos (${[...definidos].length} funções no arquivo)`,
);

// 6) leia-me
const leiaMe = (await readFile(path.join(pastaPacote, "LEIA-ME.txt"))).toString(
  "utf8",
);
assert.ok(
  leiaMe.startsWith("\uFEFF"),
  "LEIA-ME.txt sem BOM (acentos saem errados no Notepad)",
);
for (const trecho of [
  "COMO INSTALAR",
  "DESINSTALAR",
  "CONTROLES",
  "Tab menu de spawn",
  versao,
])
  assert.ok(
    leiaMe.includes(trecho),
    `LEIA-ME.txt sem a seção/informação: ${trecho}`,
  );
assert.ok(!leiaMe.includes("@@"), "sobrou marcador @@...@@ no LEIA-ME.txt");
console.log(
  "PASS instalador: LEIA-ME em PT-BR com instalação, desinstalação e controles",
);

// 7) SHA256SUMS.txt confere com os arquivos
const somas = (await readFile(path.join(pastaPacote, "SHA256SUMS.txt"), "utf8"))
  .trim()
  .split("\n")
  .map((linha) => [linha.slice(0, 64), linha.slice(66).trim()]);
assert.equal(somas.length, 5, "SHA256SUMS.txt deveria listar 5 arquivos");
for (const [hash, nome] of somas) {
  assert.match(hash, /^[0-9a-f]{64}$/, `hash inválido para ${nome}`);
  assert.equal(
    hash,
    sha256(await readFile(path.join(pastaPacote, nome))),
    `SHA256 errado para ${nome}`,
  );
}
console.log("PASS instalador: SHA256SUMS.txt confere com os 5 arquivos");

// 8) o ZIP que o usuário baixa: lê o índice central e descomprime tudo de volta
const zip = await readFile(caminhoZip);
const fim = (() => {
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65557); i--)
    if (zip.readUInt32LE(i) === 0x06054b50) return i;
  return -1;
})();
assert.ok(fim >= 0, "não achei o índice central do ZIP");
const totalEntradas = zip.readUInt16LE(fim + 10);
let ponteiro = zip.readUInt32LE(fim + 16);
const dentro = new Map();
for (let i = 0; i < totalEntradas; i++) {
  assert.equal(
    zip.readUInt32LE(ponteiro),
    0x02014b50,
    "entrada inválida no índice central",
  );
  const metodo = zip.readUInt16LE(ponteiro + 10);
  const comprimido = zip.readUInt32LE(ponteiro + 20);
  const tamanho = zip.readUInt32LE(ponteiro + 24);
  const nomeTamanho = zip.readUInt16LE(ponteiro + 28);
  const extraTamanho = zip.readUInt16LE(ponteiro + 30);
  const comentarioTamanho = zip.readUInt16LE(ponteiro + 32);
  const local = zip.readUInt32LE(ponteiro + 42);
  const nome = zip.toString("utf8", ponteiro + 46, ponteiro + 46 + nomeTamanho);
  assert.ok(
    nome.startsWith("GORE-FORGE-Instalador/"),
    `entrada fora da pasta do pacote: ${nome}`,
  );
  const nomeLocal = zip.readUInt16LE(local + 26);
  const extraLocal = zip.readUInt16LE(local + 28);
  const inicio = local + 30 + nomeLocal + extraLocal;
  const dados = zip.subarray(inicio, inicio + comprimido);
  if (!nome.endsWith("/"))
    dentro.set(nome.split("/").pop(), {
      metodo,
      tamanho,
      conteudo: metodo === 0 ? dados : inflateRawSync(dados),
    });
  ponteiro += 46 + nomeTamanho + extraTamanho + comentarioTamanho;
}
assert.equal(
  dentro.size,
  arquivosEsperados.length,
  `ZIP com ${dentro.size} arquivos (esperado ${arquivosEsperados.length})`,
);
for (const arquivo of arquivosEsperados) {
  const entrada = dentro.get(arquivo);
  assert.ok(entrada, `o ZIP não tem ${arquivo}`);
  const emDisco = await readFile(path.join(pastaPacote, arquivo));
  assert.equal(
    entrada.tamanho,
    emDisco.length,
    `${arquivo} está com tamanho diferente no ZIP`,
  );
  assert.equal(
    sha256(entrada.conteudo),
    sha256(emDisco),
    `${arquivo} dentro do ZIP difere do arquivo montado`,
  );
}
console.log(
  `PASS instalador: ZIP íntegro (${totalEntradas} arquivos conferidos byte a byte, ${(zip.length / 1024 / 1024).toFixed(2)} MB)`,
);

console.log("PASS instalador do GORE FORGE pronto para o Windows");
