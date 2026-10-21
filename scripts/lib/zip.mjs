import { deflateRawSync } from "node:zlib";

/**
 * Escritor de ZIP mínimo e portátil.
 *
 * O instalador leve é montado em qualquer sistema: não dependemos do binário
 * `zip` (que não existe no Windows) nem de bibliotecas externas. O formato é o
 * mínimo que o `Expand-Archive` do PowerShell, o Explorer do Windows e o
 * `unzip` entendem: cabeçalho local + dados + índice central + EOCD.
 */

/** CRC-32 (polinômio 0xEDB88320), tabela calculada uma vez. */
const TABELA_CRC = (() => {
  const tabela = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let valor = i;
    for (let bit = 0; bit < 8; bit++)
      valor = valor & 1 ? 0xedb88320 ^ (valor >>> 1) : valor >>> 1;
    tabela[i] = valor >>> 0;
  }
  return tabela;
})();

export function crc32(buffer) {
  let valor = 0xffffffff;
  for (const byte of buffer)
    valor = TABELA_CRC[(valor ^ byte) & 0xff] ^ (valor >>> 8);
  return (valor ^ 0xffffffff) >>> 0;
}

/** Converte um instante para o par hora/data do DOS (base 1980). */
function dataDos(ms) {
  const quando = new Date(ms);
  const ano = Math.max(1980, quando.getFullYear());
  return {
    hora:
      (quando.getHours() << 11) |
      (quando.getMinutes() << 5) |
      Math.floor(quando.getSeconds() / 2),
    dia:
      ((ano - 1980) << 9) | ((quando.getMonth() + 1) << 5) | quando.getDate(),
  };
}

/**
 * Monta o ZIP a partir de `[{ caminho, dados, data }]`.
 * Cada entrada é comprimida com deflate; se o deflate não ajudar, fica guardada.
 */
export function escreverZip(entradas, { nivel = 9, agora = Date.now() } = {}) {
  const partesLocais = [];
  const partesCentrais = [];
  let deslocamento = 0;

  for (const { caminho, dados, data = agora } of entradas) {
    const nome = Buffer.from(caminho, "utf8");
    const comprimido = deflateRawSync(dados, { level: nivel });
    const metodo = comprimido.length < dados.length ? 8 : 0;
    const conteudo = metodo === 0 ? dados : comprimido;
    const crc = crc32(dados);
    const { hora, dia } = dataDos(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // versão mínima para deflate
    local.writeUInt16LE(0x0800, 6); // nomes em UTF-8
    local.writeUInt16LE(metodo, 8);
    local.writeUInt16LE(hora, 10);
    local.writeUInt16LE(dia, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(conteudo.length, 18);
    local.writeUInt32LE(dados.length, 22);
    local.writeUInt16LE(nome.length, 26);
    local.writeUInt16LE(0, 28); // sem campo extra
    partesLocais.push(local, nome, conteudo);

    const registro = Buffer.alloc(46);
    registro.writeUInt32LE(0x02014b50, 0);
    registro.writeUInt16LE(20, 4); // versão que criou
    registro.writeUInt16LE(20, 6); // versão mínima
    registro.writeUInt16LE(0x0800, 8);
    registro.writeUInt16LE(metodo, 10);
    registro.writeUInt16LE(hora, 12);
    registro.writeUInt16LE(dia, 14);
    registro.writeUInt32LE(crc, 16);
    registro.writeUInt32LE(conteudo.length, 20);
    registro.writeUInt32LE(dados.length, 24);
    registro.writeUInt16LE(nome.length, 28);
    registro.writeUInt16LE(0, 30); // extra
    registro.writeUInt16LE(0, 32); // comentário
    registro.writeUInt16LE(0, 34); // disco
    registro.writeUInt16LE(0, 36); // atributos internos
    registro.writeUInt32LE((0o100644 << 16) >>> 0, 38); // atributos externos (rw-r--r--)
    registro.writeUInt32LE(deslocamento, 42);
    partesCentrais.push(registro, nome);

    deslocamento += 30 + nome.length + conteudo.length;
  }

  const corpo = Buffer.concat(partesLocais);
  const diretorio = Buffer.concat(partesCentrais);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(0, 4); // disco
  fim.writeUInt16LE(0, 6); // disco do índice
  fim.writeUInt16LE(entradas.length, 8);
  fim.writeUInt16LE(entradas.length, 10);
  fim.writeUInt32LE(diretorio.length, 12);
  fim.writeUInt32LE(corpo.length, 16);
  fim.writeUInt16LE(0, 20); // sem comentário

  return Buffer.concat([corpo, diretorio, fim]);
}
