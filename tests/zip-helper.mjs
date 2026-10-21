import { inflateRawSync } from "node:zlib";
import assert from "node:assert/strict";

/**
 * Leitor mínimo de ZIP (só o que interessa para os testes): anda pelo índice
 * central e devolve cada entrada já descomprimida, com o nome sem a pasta.
 *
 * Usado por `tests/goreforge-installer.mjs` para conferir byte a byte o pacote
 * do instalador e o pacote embutido no instalador único.
 */
export function lerEntradasZip(buffer) {
  const fim = (() => {
    for (
      let i = buffer.length - 22;
      i >= Math.max(0, buffer.length - 65557);
      i--
    )
      if (buffer.readUInt32LE(i) === 0x06054b50) return i;
    return -1;
  })();
  assert.ok(fim >= 0, "não achei o índice central do ZIP");
  const total = buffer.readUInt16LE(fim + 10);
  let ponteiro = buffer.readUInt32LE(fim + 16);
  const entradas = new Map();
  for (let i = 0; i < total; i++) {
    assert.equal(
      buffer.readUInt32LE(ponteiro),
      0x02014b50,
      "entrada inválida no índice central do ZIP",
    );
    const metodo = buffer.readUInt16LE(ponteiro + 10);
    const comprimido = buffer.readUInt32LE(ponteiro + 20);
    const tamanho = buffer.readUInt32LE(ponteiro + 24);
    const nomeTamanho = buffer.readUInt16LE(ponteiro + 28);
    const extraTamanho = buffer.readUInt16LE(ponteiro + 30);
    const comentarioTamanho = buffer.readUInt16LE(ponteiro + 32);
    const local = buffer.readUInt32LE(ponteiro + 42);
    const caminho = buffer.toString(
      "utf8",
      ponteiro + 46,
      ponteiro + 46 + nomeTamanho,
    );
    const nomeLocal = buffer.readUInt16LE(local + 26);
    const extraLocal = buffer.readUInt16LE(local + 28);
    const inicio = local + 30 + nomeLocal + extraLocal;
    const dados = buffer.subarray(inicio, inicio + comprimido);
    if (!caminho.endsWith("/"))
      entradas.set(caminho.split("/").pop(), {
        metodo,
        caminho,
        tamanho,
        conteudo: metodo === 0 ? dados : inflateRawSync(dados),
      });
    ponteiro += 46 + nomeTamanho + extraTamanho + comentarioTamanho;
  }
  return { total, entradas, bytes: buffer.length };
}
