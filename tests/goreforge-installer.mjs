import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import assert from "node:assert/strict";
import { lerEntradasZip } from "./zip-helper.mjs";
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

async function conferirZip(buffer, rotulo) {
  const { entradas, bytes } = lerEntradasZip(buffer);
  assert.equal(
    entradas.size,
    arquivosEsperados.length,
    `${rotulo}: ${entradas.size} arquivos (esperado ${arquivosEsperados.length})`,
  );
  for (const arquivo of arquivosEsperados) {
    const entrada = entradas.get(arquivo);
    assert.ok(entrada, `${rotulo}: não tem ${arquivo}`);
    assert.ok(
      entrada.caminho.startsWith("GORE-FORGE-Instalador/"),
      `${rotulo}: entrada fora da pasta do pacote: ${entrada.caminho}`,
    );
    const emDisco = await readFile(path.join(pastaPacote, arquivo));
    assert.equal(
      entrada.tamanho,
      emDisco.length,
      `${rotulo}: ${arquivo} está com tamanho diferente`,
    );
    assert.equal(
      sha256(entrada.conteudo),
      sha256(emDisco),
      `${rotulo}: ${arquivo} difere do arquivo montado`,
    );
  }
  return { arquivos: entradas.size, bytes };
}
const conferido = await conferirZip(zip, "ZIP baixado");
console.log(
  `PASS instalador: ZIP íntegro (${conferido.arquivos} arquivos conferidos byte a byte, ${(conferido.bytes / 1024 / 1024).toFixed(2)} MB)`,
);

// 9) INSTALADOR ÚNICO: um só .cmd com o pacote inteiro embutido em base64
const NOME_UNICO = "GORE-FORGE-Instalador.cmd";
const MARCA_INICIO = "---GORE-FORGE:INICIO---";
const MARCA_FIM = "---GORE-FORGE:FIM---";
const caminhoUnico = path.join(root, "entregas", NOME_UNICO);
const infoUnico = await stat(caminhoUnico).catch(() => null);
assert.ok(
  infoUnico,
  `não existe ${NOME_UNICO}: rode npm run installer:goreforge`,
);
assert.ok(
  infoUnico.size > 300_000,
  `${NOME_UNICO} pequeno demais (${infoUnico.size} bytes): o jogo não estaria embutido`,
);

const bytesUnico = await readFile(caminhoUnico);
// ASCII puro, sem Ctrl-Z (0x1A): o cmd.exe lê o arquivo inteiro para executar
assert.ok(
  !bytesUnico.includes(0x1a),
  `${NOME_UNICO} tem byte 0x1A (Ctrl-Z): o cmd.exe pode parar de ler antes do fim`,
);
const unico = bytesUnico.toString("latin1");
assert.ok(
  !/[^\x09\x0a\x0d\x20-\x7e]/.test(unico),
  `${NOME_UNICO} tem byte não-ASCII`,
);
assert.ok(
  unico.startsWith("@echo off\n"),
  `${NOME_UNICO} não começa com @echo off`,
);

// cada marcador uma única vez: se aparecer antes (comentário/comando), o IndexOf
// do PowerShell acharia o lugar errado e a extração pegaria lixo
for (const marca of [MARCA_INICIO, MARCA_FIM])
  assert.equal(
    unico.split(marca).length - 1,
    1,
    `${NOME_UNICO} deveria ter exatamente 1 "${marca}"`,
  );

const a = unico.indexOf(MARCA_INICIO);
const b = unico.indexOf(MARCA_FIM);
assert.ok(
  a < b,
  "no instalador único o marcador de início vem depois do de fim",
);
const cabecalho = unico.slice(0, a);
const carga = unico.slice(a + MARCA_INICIO.length, b);
assert.match(
  carga.replace(/\r?\n/g, ""),
  /^[A-Za-z0-9+/]+={0,2}$/,
  "a carga embutida tem coisa que não é base64",
);
assert.ok(
  /(^|\n)exit \/b 0\r?\n/.test(cabecalho),
  `${NOME_UNICO} precisa sair (exit /b 0) antes da carga embutida`,
);
assert.ok(
  cabecalho.trimEnd().endsWith("exit /b 1"),
  `${NOME_UNICO} precisa terminar o trecho executável em ":falhou ... exit /b 1"`,
);

for (const trecho of [
  "chcp 65001",
  'set "GF_SELF=%~f0"',
  String.raw`set "GF_PASTA=%TEMP%\GORE-FORGE-Instalador"`,
  String.raw`set "GF_PACOTE=%TEMP%\GORE-FORGE-Instalador.zip"`,
  "-ExecutionPolicy Bypass",
  "[IO.File]::ReadAllText",
  "[Convert]::FromBase64String",
  "Expand-Archive",
  "Instalador.ps1",
  "rmdir /s /q",
  "goto :falhou",
  "pause",
])
  assert.ok(
    cabecalho.includes(trecho),
    `${NOME_UNICO} sem o trecho obrigatório: ${trecho}`,
  );

// os comandos PowerShell vão entre aspas duplas para o cmd.exe: nada de aspas
// duplas dentro deles, senão o cmd quebra a linha no meio
const comandos = [...cabecalho.matchAll(/-Command "([^"]*)"/g)].map(
  (m) => m[1],
);
assert.equal(
  comandos.length,
  2,
  `esperava 2 comandos PowerShell, achei ${comandos.length}`,
);
for (const comando of comandos)
  assert.ok(
    !comando.includes('"') && !comando.includes("%"),
    "comando PowerShell com aspas duplas ou % dentro (o cmd.exe não perdoa)",
  );

// toda variável $env: usada precisa ter sido definida com "set" no cabeçalho
const usadas = new Set(
  [...cabecalho.matchAll(/\$env:([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]),
);
assert.ok(
  usadas.size >= 3,
  "o instalador único quase não usa variáveis de ambiente",
);
for (const nome of usadas)
  assert.ok(
    cabecalho.includes(`set "${nome}=`),
    `o instalador único usa $env:${nome} mas nunca faz set "${nome}=..." (a variável chegaria vazia)`,
  );
console.log(
  `PASS instalador único: ${NOME_UNICO} executável, ASCII, ${comandos.length} comandos PowerShell e ${usadas.size} variáveis coerentes`,
);

// a carga embutida, decodificada como o PowerShell faria, tem de dar o ZIP
const embutido = Buffer.from(carga.replace(/[^A-Za-z0-9+/=]/g, ""), "base64");
assert.equal(
  sha256(embutido),
  sha256(zip),
  "o pacote embutido no instalador único não é igual ao ZIP montado",
);
const conferido2 = await conferirZip(embutido, "pacote embutido no .cmd");
assert.equal(
  conferido2.arquivos,
  conferido.arquivos,
  "o pacote embutido tem menos arquivos que o ZIP",
);
console.log(
  `PASS instalador único: pacote embutido idêntico ao ZIP (${(infoUnico.size / 1024 / 1024).toFixed(2)} MB, ${conferido2.arquivos} arquivos conferidos byte a byte)`,
);

console.log("PASS instalador do GORE FORGE pronto para o Windows");
