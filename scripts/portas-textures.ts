import type { PixelTexture } from "../src/engine/studio-model";
/** Gerador determinístico de pixel art (16×16) para o hotel. */
function rng(semente: number) {
  let s = semente >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
type Pixel = (x: number, y: number, r: () => number) => string;
function pinta(id: string, nome: string, base: string, fn: Pixel): PixelTexture {
  const size = 16,
    r = rng(
      [...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) >>> 0,
    ),
    pixels: string[] = [];
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) pixels.push(fn(x, y, r));
  return { id, name: nome, size, pixels };
}
/** escurece/clareia uma cor hexadecimal por um fator (-1 a 1) */
function tom(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16),
    partes = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) =>
      Math.max(0, Math.min(255, Math.round(v * (1 + f)))),
    );
  return (
    "#" +
    partes.map((v) => v.toString(16).padStart(2, "0")).join("")
  );
}
export const PORTAS_TEXTURAS: { id: string; nome: string }[] = [
  { id: "tex.parede.quarto", nome: "Papel de parede · quarto" },
  { id: "tex.parede.corredor", nome: "Concreto · corredor" },
  { id: "tex.parede.sala", nome: "Parede · sala de estar" },
  { id: "tex.parede.deposito", nome: "Concreto sujo · depósito" },
  { id: "tex.parede.biblioteca", nome: "Estante de parede · biblioteca" },
  { id: "tex.carpete.quarto", nome: "Carpete · quarto" },
  { id: "tex.carpete.corredor", nome: "Carpete · corredor" },
  { id: "tex.carpete.sala", nome: "Tapete · sala de estar" },
  { id: "tex.carpete.deposito", nome: "Piso de concreto · depósito" },
  { id: "tex.teto", nome: "Teto de gesso" },
  { id: "tex.porta", nome: "Madeira · porta" },
  { id: "tex.madeira", nome: "Madeira clara" },
  { id: "tex.madeira.escura", nome: "Madeira escura" },
  { id: "tex.estante", nome: "Estante com livros" },
  { id: "tex.caixote", nome: "Caixote de madeira" },
  { id: "tex.tecido", nome: "Tecido · colchão" },
  { id: "tex.metal", nome: "Metal · elevador" },
  { id: "tex.quadro", nome: "Moldura de quadro" },
  { id: "tex.tapete", nome: "Tapete vermelho" },
  { id: "tex.azulejo", nome: "Azulejo antigo" },
];
/** Desenho em grade: cada linha é uma string de 16 caracteres, cada caractere
    um pixel da paleta. Serve para criar as caras (imagens) das criaturas. */
function desenho(
  id: string,
  nome: string,
  paleta: Record<string, string>,
  linhas: string[],
): PixelTexture {
  if (linhas.length !== 16 || linhas.some((l) => l.length !== 16))
    throw new Error("Desenho 16x16 inválido: " + id);
  const pixels: string[] = [];
  for (const linha of linhas)
    for (const c of linha)
      pixels.push(paleta[c] ?? paleta["."] ?? "#000000");
  return { id, name: nome, size: 16, pixels };
}
/** Paletas das faces: escuro, osso, buraco, sangue, brilho. */
const P = {
  noite: "#08080c",
  osso: "#ece5d8",
  ossoSombra: "#b3ada2",
  buraco: "#090a0d",
  sangue: "#7d1a12",
  carne: "#a8322a",
  brilho: "#ffe9b0",
  vermelho: "#c33327",
  metal: "#8d99a6",
  madeira: "#6b5127",
  pele: "#c9a07a",
  peleClara: "#e3c19c",
  roxo: "#5a3b70",
  verde: "#7fae6a",
  olho: "#f2f0e4",
  pupila: "#141018",
  dente: "#f6f2e4",
};
export function portasTextures(): PixelTexture[] {
  const lista: PixelTexture[] = [];
  const por = (id: string) => PORTAS_TEXTURAS.find((t) => t.id === id)!.nome;
  // ---------------------------------------------------------------- paredes
  for (const [id, cor, listra] of [
    ["tex.parede.quarto", "#4a3d31", "#5b4a3a"],
    ["tex.parede.corredor", "#3c3a37", "#454440"],
    ["tex.parede.sala", "#463b32", "#544538"],
    ["tex.parede.deposito", "#3a3530", "#443e37"],
  ] as const)
    lista.push(
      pinta(id, por(id), cor, (x, y, r) => {
        const s = tom(cor, (y % 4 === 0 ? -0.14 : 0) + (r() - 0.5) * 0.06);
        if (x % 4 === 0) return tom(listra, (r() - 0.5) * 0.05);
        if (id === "tex.parede.quarto" && y % 8 === 5 && x % 4 === 2)
          return tom(cor, 0.22);
        return s;
      }),
    );
  lista.push(
    pinta("tex.parede.biblioteca", por("tex.parede.biblioteca"), "#3f3226", (x, y, r) => {
      const prateleira = y % 8 === 0;
      if (prateleira) return tom("#2e241b", (r() - 0.5) * 0.05);
      const livro = Math.floor(x / 2) + Math.floor(y / 8) * 4,
        cores = ["#7d3b34", "#39556b", "#6c6335", "#5a3b63", "#7a5a33"];
      if (x % 2 === 1) return tom(cores[livro % cores.length], -0.22);
      return tom(cores[livro % cores.length], (r() - 0.5) * 0.12);
    }),
  );
  // ---------------------------------------------------------------- carpetes
  lista.push(
    pinta("tex.carpete.quarto", por("tex.carpete.quarto"), "#4d3327", (x, y, r) =>
      tom("#4d3327", (r() - 0.55) * 0.22 + ((x + y) % 3 === 0 ? 0.05 : 0)),
    ),
  );
  lista.push(
    pinta("tex.carpete.corredor", por("tex.carpete.corredor"), "#33322f", (x, y, r) => {
      const losango = Math.abs((x % 8) - 4) + Math.abs((y % 8) - 4) === 4;
      return tom(losango ? "#403e38" : "#2f2e2b", (r() - 0.5) * 0.1);
    }),
  );
  lista.push(
    pinta("tex.carpete.sala", por("tex.carpete.sala"), "#5a4633", (x, y, r) => {
      const borda = x === 0 || y === 0 || x === 15 || y === 15,
        motivo = x % 8 === 3 && y % 8 === 3;
      return tom(motivo ? "#6d563f" : borda ? "#41332a" : "#57422f", (r() - 0.5) * 0.08);
    }),
  );
  lista.push(
    pinta("tex.carpete.deposito", por("tex.carpete.deposito"), "#3b3733", (x, y, r) => {
      const rachadura = (x * 7 + y * 3) % 23 === 0;
      return tom(rachadura ? "#2b2825" : "#3b3733", (r() - 0.5) * 0.12);
    }),
  );
  lista.push(
    pinta("tex.teto", por("tex.teto"), "#2a2622", (x, y, r) =>
      tom(x % 8 === 0 || y % 8 === 0 ? "#211d1a" : "#2b2723", (r() - 0.5) * 0.08),
    ),
  );
  // ---------------------------------------------------------------- madeiras
  lista.push(
    pinta("tex.madeira", por("tex.madeira"), "#6a5238", (x, y, r) => {
      const tábua = y % 4 === 0 ? "#4b3a28" : "#6a5238";
      return tom(tábua, (r() - 0.5) * 0.1 + (Math.sin(x * 1.7 + y) > 0.7 ? 0.06 : 0));
    }),
  );
  lista.push(
    pinta("tex.madeira.escura", por("tex.madeira.escura"), "#4a3626", (x, y, r) => {
      const tábua = y % 5 === 0 ? "#332419" : "#4a3626";
      return tom(tábua, (r() - 0.5) * 0.1);
    }),
  );
  lista.push(
    pinta("tex.porta", por("tex.porta"), "#5b4326", (x, y, r) => {
      const moldura = x === 0 || x === 15 || y === 0 || y === 15,
        painel = (x === 3 && y > 2 && y < 13) || (x === 12 && y > 2 && y < 13);
      return tom(moldura ? "#3a2a17" : painel ? "#42301a" : "#5b4326", (r() - 0.5) * 0.08);
    }),
  );
  lista.push(
    pinta("tex.estante", por("tex.estante"), "#43362a", (x, y, r) => {
      if (y % 5 === 0) return tom("#2c231a", 0);
      const livro = Math.floor(x / 3),
        cores = ["#7d3b34", "#39556b", "#6c6335", "#5a3b63"];
      return tom(cores[(livro + y) % cores.length], (r() - 0.5) * 0.14);
    }),
  );
  lista.push(
    pinta("tex.caixote", por("tex.caixote"), "#7a6244", (x, y, r) => {
      const diagonal = Math.abs((x + y) % 16 - 8) < 1 || Math.abs((x - y + 16) % 16 - 8) < 1;
      const borda = x % 7 === 0 || y % 7 === 0;
      return tom(diagonal || borda ? "#5d4a33" : "#7a6244", (r() - 0.5) * 0.1);
    }),
  );
  lista.push(
    pinta("tex.tecido", por("tex.tecido"), "#8a7c6a", (x, y, r) =>
      tom((x + y) % 2 === 0 ? "#8a7c6a" : "#827463", (r() - 0.5) * 0.06 + (y % 4 === 0 ? -0.1 : 0)),
    ),
  );
  lista.push(
    pinta("tex.metal", por("tex.metal"), "#3d4249", (x, y, r) => {
      const painel = x === 7 || x === 8,
        rebite = (x === 2 || x === 13) && (y === 2 || y === 13);
      const brilho = Math.sin(y * 0.9) * 0.05;
      return tom(painel ? "#2b2f34" : rebite ? "#5b636d" : "#3d4249", brilho + (r() - 0.5) * 0.05);
    }),
  );
  lista.push(
    pinta("tex.quadro", por("tex.quadro"), "#3a2f27", (x, y, r) => {
      const moldura = x < 2 || x > 13 || y < 2 || y > 13;
      if (moldura) return tom("#6b5127", (r() - 0.5) * 0.12);
      return tom((x + y) % 7 === 0 ? "#2b2420" : "#241f1c", (r() - 0.5) * 0.05);
    }),
  );
  lista.push(
    pinta("tex.tapete", por("tex.tapete"), "#6d2320", (x, y, r) => {
      const borda = x < 1 || y < 1 || x > 14 || y > 14,
        motivo = (x % 6 === 3 && y % 6 === 3) || (x + y) % 12 === 0;
      return tom(borda ? "#8a3a30" : motivo ? "#7d2a26" : "#6d2320", (r() - 0.5) * 0.08);
    }),
  );
  lista.push(
    pinta("tex.azulejo", por("tex.azulejo"), "#6d7a76", (x, y, r) => {
      const junta = x % 8 === 0 || y % 8 === 0;
      return tom(junta ? "#4f5a57" : "#6d7a76", (r() - 0.5) * 0.08 + (x === 1 && y === 1 ? 0.08 : 0));
    }),
  );
  // ------------------------------------------------------- caras das criaturas
  lista.push(
    desenho("tex.face.rush", "Face · Rush", P, [
      "................",
      ".....oosssso....",
      "...oosssssssso..",
      "..oossssssssssoo",
      "..osssbbsbbssoo.",
      ".ossbbbbbbbbssso",
      ".ossbbbbsbbbbsso",
      ".ossssssssssssss",
      ".osssoobssoobsss",
      ".osrrroosorrrsss",
      "..srrrrrrrrrros.",
      "..ssbbrrrbbssss.",
      "...sssbbbsssso..",
      "....ssbbbbsso...",
      "......oooo......",
      "................",
    ]),
  );
  lista.push(
    desenho("tex.face.ambush", "Face · Ambush", P, [
      "................",
      "..ossssoosssss..",
      ".osssssssssssso.",
      ".osbbssoossbbss.",
      ".osbbbssobbbbso.",
      ".osssssssssssso.",
      ".osrrrrrrrrrrsso",
      ".osrtttttttrrsso",
      ".osrrtttttrrssoo",
      "..osrrrrrrrsso..",
      "...osssssssso...",
      "....oossssoo....",
      "......oooo......",
      "................",
      "................",
      "................",
    ]),
  );
  lista.push(
    desenho("tex.face.screech", "Face · Screech", P, [
      "................",
      "....oooooooo....",
      "..oossssssssoo..",
      ".osssssssssssso.",
      ".ossbbbosssbbso.",
      "ossbbooossbbooso",
      "ossboooossboooso",
      "ossbbooossbbooso",
      ".ossbbbosssbbso.",
      ".osssssssssssso.",
      ".osrttttttrrsso.",
      ".osrrttttrrsoso.",
      "..osrrrrrrsoso..",
      "...oossssooo....",
      ".....oooo.......",
      "................",
    ]),
  );
  lista.push(
    desenho("tex.face.jack", "Face · Jack", P, [
      "................",
      "....pppppppp....",
      "..pplrppppprpp..",
      ".ppllppppppplpp.",
      ".plrrooooooorrp.",
      ".plloobbbooollp.",
      ".plllooooooollp.",
      ".plllrrrrrrrllp.",
      ".plrttttttttrp..",
      ".plrtrtrtrtrrp..",
      "..plrrrrrrrrlp..",
      "...plrrrrrrlp...",
      "....plrrrrlp....",
      ".....plllp......",
      "......ppp.......",
      "................",
    ]),
  );
  lista.push(
    desenho("tex.face.timothy", "Face · Timothy", { ...P, b: "#1d1620", m: "#3a2a44", v: "#7fd0b0" }, [
      "................",
      "..b...b...b..b..",
      "..bb..bb.bb.bb..",
      "...bb.bbbbb.bb..",
      "..bbbbrbbbrbbbb.",
      ".bbvvvbvvvbvvbb.",
      "..bbvvvbbbvvvb..",
      "..bbbrrbrrbbbb..",
      ".bbbrrrrrrrbbbb.",
      "..bbbbrrrrbbbb..",
      "...bbbrrrrbbb...",
      "..bbb..bb..bbb..",
      "..bb...bb...bb..",
      ".b.....b.....b..",
      "................",
      "................",
    ]),
  );
  lista.push(
    desenho("tex.face.shadow", "Face · Shadow", P, [
      "................",
      "................",
      "...oooooooooo...",
      "..oooooooooooo..",
      "..oooooooooooo..",
      "..oobooooooboo..",
      "..obboooooobbo..",
      "..obboooooobbo..",
      "..oobooooooboo..",
      "..oooooooooooo..",
      "...oooooooooo...",
      "....oooooooo....",
      ".....oooooo.....",
      "......oooo......",
      "................",
      "................",
    ]),
  );
  lista.push(
    desenho("tex.face.seek", "Face · Seek", P, [
      "................",
      "....oooooooo....",
      "..oovvvvvvvvoo..",
      ".ovvvvvvvvvvvvo.",
      ".ovvoooovvooovo.",
      "ovvobbbovobbbovo",
      "ovvobbbovobbbovo",
      "ovvoooovvoooovvo",
      ".ovvvvvvvvvvvvo.",
      ".ovrrrrrrrrrrvo.",
      ".ovrttttttttrvo.",
      ".ovrtrtrtrtrtvo.",
      "..ovrrrrrrrrvo..",
      "...oovvvvvvoo...",
      ".....oooooo.....",
      "................",
    ]),
  );
  lista.push(
    desenho("tex.face.figure", "Face · Figure", P, [
      "................",
      "...mmmmmmmmmm...",
      "..mmmmmmmmmmmm..",
      ".mmwmmmmmmwmmmm.",
      ".mmwoommoowmmmm.",
      ".mmwoommooowmmm.",
      ".mmmwmmmmwmmmmm.",
      ".mmmmmmmmmmmmmm.",
      ".mmddddddddddmm.",
      ".mddddddddddddm.",
      ".mmddddddddddmm.",
      "..mddddddddddm..",
      "...mddddddddm...",
      "....mddddddm....",
      ".....mmmmmm.....",
      "................",
    ]),
  );
  lista.push(
    desenho("tex.face.dupe", "Face · Dupe", P, [
      "................",
      "....ssssssss....",
      "..ssllssssllss..",
      ".ssllppssppllss.",
      ".ssllpbbbbpllss.",
      ".ssllppppppllss.",
      ".sssllllllllsss.",
      ".ssrrrrrrrrrrss.",
      ".sstrrrrrrrrtss.",
      ".sstrrtrrtrrtss.",
      "..srrrrrrrrrrs..",
      "...srrrrrrrrs...",
      "....ssrrrrss....",
      ".....ssssss.....",
      "......ssss......",
      "................",
    ]),
  );
  lista.push(
    desenho("tex.face.hide", "Face · Hide", P, [
      "................",
      "................",
      "....oooooooo....",
      "...oooooooooo...",
      "...oo.oooo.oo...",
      "..oooobboooo....",
      "..oooobbooo.....",
      "...ooobboo......",
      "...ooobboo......",
      "..ooo.oo.ooo....",
      ".ooo..oo..ooo...",
      ".oo........oo...",
      "................",
      "................",
      "................",
      "................",
    ]),
  );
  lista.push(
    desenho("tex.face.olhos", "Olhos brilhando no escuro", P, [
      "................",
      "................",
      "................",
      "...oooooooooo...",
      "..ooobboooobbo..",
      "..oobbbboobbbbo.",
      "..ooobboooobbo..",
      "...oooooooooo...",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
    ]),
  );
  // ------------------------------------------------------- materiais novos
  lista.push(
    pinta("tex.papel", "Papel de parede floral", "#6d5a4a", (x, y, r) => {
      const flor = (x % 8 === 3 && y % 8 === 3) || (x % 8 === 5 && y % 8 === 6);
      const listra = x % 8 === 0;
      return tom(flor ? "#8a7460" : listra ? "#5f4e40" : "#6d5a4a", (r() - 0.5) * 0.07);
    }),
  );
  lista.push(
    pinta("tex.pedra", "Pedra", "#575553", (x, y, r) => {
      const junta = (x + y) % 6 === 0 || (x - y) % 7 === 0;
      return tom(junta ? "#43413f" : "#575553", (r() - 0.5) * 0.16);
    }),
  );
  lista.push(
    pinta("tex.concreto", "Concreto sujo", "#4a4744", (x, y, r) => {
      const mancha = r() > 0.93;
      return tom(mancha ? "#3a3835" : "#4a4744", (r() - 0.5) * 0.12 + (y % 8 === 0 ? -0.08 : 0));
    }),
  );
  lista.push(
    pinta("tex.roupa", "Roupas dobradas", "#8e8f96", (x, y, r) => {
      const dobra = y % 4 === 0;
      const cor = ["#8e8f96", "#6d5c4d", "#7b4046", "#4f6070"][((x / 5) | 0) % 4];
      return tom(dobra ? "#5a5b60" : cor, (r() - 0.5) * 0.1);
    }),
  );
  lista.push(
    pinta("tex.cortina", "Cortina", "#6a2c33", (x, y, r) => {
      const vinco = x % 3 === 0;
      return tom(vinco ? "#4f2027" : "#6a2c33", (r() - 0.5) * 0.08 + (y % 8 === 0 ? 0.06 : 0));
    }),
  );
  lista.push(
    pinta("tex.vidro", "Vidro sujo", "#5d6f72", (x, y, r) => {
      const trinca = x === 9 || (y === 6 && x > 5) || (x === 3 && y < 5);
      return tom(trinca ? "#8fa5a8" : "#5d6f72", (r() - 0.5) * 0.1 + (x + y) % 8 === 0 ? 0.05 : 0);
    }),
  );
  lista.push(
    pinta("tex.lousa", "Placa de porta", "#3b3a37", (x, y, r) => {
      const borda = x < 1 || y < 1 || x > 14 || y > 14;
      const risco = y === 5 || y === 9;
      return tom(borda ? "#8d7a3f" : risco ? "#2b2a28" : "#3b3a37", (r() - 0.5) * 0.08);
    }),
  );
  lista.push(
    pinta("tex.lampada", "Lâmpada acesa", "#ffe6a8", (x, y, r) => {
      const filamento = x === 8 || y === 8;
      return tom(filamento ? "#fff6d8" : "#ffe6a8", (r() - 0.5) * 0.08);
    }),
  );
  lista.push(
    pinta("tex.sangue", "Mancha de sangue", "#5f2a24", (x, y, r) => {
      const gota = (x - 8) * (x - 8) + (y - 8) * (y - 8) < 26;
      return tom(gota ? "#5f2a24" : "#40382f", (r() - 0.5) * 0.1);
    }),
  );
  lista.push(
    pinta("tex.madeira.clara", "Madeira clara", "#8a6a44", (x, y, r) => {
      const veio = y % 3 === 0;
      return tom(veio ? "#74562f" : "#8a6a44", (r() - 0.5) * 0.08);
    }),
  );
  lista.push(
    pinta("tex.elevador", "Metal do elevador", "#2f353b", (x, y, r) => {
      const porta = x === 7 || x === 8;
      const brilho = x === 3 && y < 8;
      return tom(porta ? "#1f2429" : brilho ? "#3f474f" : "#2f353b", (r() - 0.5) * 0.06);
    }),
  );
  return lista;
}
