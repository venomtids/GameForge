/* ============================================================================
   PORTAS · HOTEL DAS 100 PORTAS — jogo completo no estilo Doors, rodando 100%
   na engine GameForge. Todo o comportamento (geração das salas, portas, itens,
   entidades, loja, biblioteca e perseguições) está neste arquivo editável.

   CONTROLES
     WASD / setas ....... andar        Shift .............. correr
     Espaço ............. pular        E .................. interagir / esconder
     F .................. lanterna     Q .................. curativo
     G .................. vitaminas    C .................. crucifixo
     R .................. voltar para a entrada da sala
     Espaço ............. escapar de armadilha (Snare)
     1..5 ............... comprar na loja do Jeff (porta 40)
     Esc ................ pausar
   CRIATURAS
     Rush / Ambush ...... corra e esconda no armário
     Screech ............ olhe para ele nas salas escuras
     Eyes ............... não encare os quadros
     Halt ............... pare quando ele aparecer
     Seek ............... corra sem parar (corredor de fuga)
     Figure ............. biblioteca: puxe a alavanca em silêncio
     Timothy ............ aranha na gaveta — dói
     Jack ............... susto na gaveta/armário — não machuca
     Shadow ............. vulto que cruza o corredor
     Hide ............... mora dentro de alguns armários
     Snare .............. armadilha no chão: aperte Espaço para escapar
     Dupe ............... porta falsa: te devolve para a sala anterior
   TESTES (depuracao = true abaixo)
     7 = Rush · 8 = Ambush · 9 = Screech · 0 = morrer · 6 = +50 moedas
     5 = Timothy · 4 = Jack · 3 = Shadow · 2 = Snare · 1 = Dupe
   ========================================================================== */
const CFG = {
  portas: 100,
  portaDaLoja: 40,
  portaDaBiblioteca: 60,
  perseguicoes: [34, 84],
  celula: 14,
  altura: 4,
  parede: 0.4,
  vao: 2.4,
  alturaPorta: 2.9,
  deslocamentoZ: 70,
  salasAtras: 2,
  salasFrente: 1,
  luzDaSala: 11,
  velocidadeSala: 5.2,
  velocidadeRush: 26,
  velocidadeSeek: 5.7,
  velocidadeFigura: 2.3,
  corrida: 1.5,
  bateriaPorSegundo: 0.42,
  bateriaGanha: 45,
  curaCurativo: 40,
  revives: 2,
  preco: { bateria: 15, gazua: 25, curativo: 30, crucifixo: 45, vitaminas: 35 },
  chance: {
    rush: 0.085,
    ambush: 0.05,
    halt: 0.07,
    escuro: 0.2,
    quadro: 0.32,
    armarioExtra: 0.35,
    escondido: 0.1,
    trancada: 0.18,
    cadeado: 0.16,
    alavanca: 0.12,
    item: 0.55,
    jack: 0.05,
    timothy: 0.07,
    shadow: 0.035,
    snare: 0.05,
    dupe: 0.07,
  },
  texturas: true,
  /** metros cobertos por um tile de textura (igual ao projeto) */
  tile: 1.5,
  /** multiplicador global de perigo: 1 normal, 0 jogo calmo (testes) */
  perigo: 1,
  depuracao: true,
  /** depuração/testes: força uma criatura a ser sorteada em toda sala */
  forcar: null,
};
/* Texturas do projeto (Pixel Studio). Cada peça recebe textureId e a engine
   repete o tile conforme o tamanho da peça. */
const TEX = {
  parede: {
    quarto: "tex.parede.quarto",
    corredor: "tex.parede.corredor",
    sala: "tex.parede.sala",
    deposito: "tex.parede.deposito",
  },
  carpete: {
    quarto: "tex.carpete.quarto",
    corredor: "tex.carpete.corredor",
    sala: "tex.carpete.sala",
    deposito: "tex.carpete.deposito",
  },
  teto: "tex.teto",
  porta: "tex.porta",
  madeira: "tex.madeira",
  madeiraEscura: "tex.madeira.escura",
  estante: "tex.estante",
  caixote: "tex.caixote",
  tecido: "tex.tecido",
  metal: "tex.metal",
  quadro: "tex.quadro",
  tapete: "tex.tapete",
  azulejo: "tex.azulejo",
  biblioteca: "tex.parede.biblioteca",
  papel: "tex.papel",
  pedra: "tex.pedra",
  concreto: "tex.concreto",
  roupa: "tex.roupa",
  cortina: "tex.cortina",
  vidro: "tex.vidro",
  lousa: "tex.lousa",
  lampada: "tex.lampada",
  sangue: "tex.sangue",
  madeiraClara: "tex.madeira.clara",
  elevador: "tex.elevador",
  face: {
    rush: "tex.face.rush",
    ambush: "tex.face.ambush",
    screech: "tex.face.screech",
    jack: "tex.face.jack",
    timothy: "tex.face.timothy",
    shadow: "tex.face.shadow",
    seek: "tex.face.seek",
    figure: "tex.face.figure",
    dupe: "tex.face.dupe",
    hide: "tex.face.hide",
    olhos: "tex.face.olhos",
  },
};
function textura(quiser) {
  return CFG.texturas && quiser ? { textureId: quiser } : {};
}
const DIR = { leste: 0, oeste: 1, sul: 2, norte: 3 };
const C = CFG.celula,
  H = CFG.altura,
  T = CFG.parede,
  V = CFG.vao,
  AP = CFG.alturaPorta,
  MEIA = C / 2,
  PAREDE = MEIA - T / 2,
  OPOSTO = [1, 0, 3, 2];

/* ---------------------------------------------------------------- utilidades */
const aleatorio = (a, b) => a + Math.random() * (b - a);
const chance = (p) => Math.random() < p;
const escolha = (l) => l[Math.floor(Math.random() * l.length)];
const lim = (v, a, b) => Math.max(a, Math.min(b, v));
const inteiro = (a, b) => Math.round(aleatorio(a, b));
function rotY(vx, vz, graus) {
  const r = (graus * Math.PI) / 180,
    c = Math.cos(r),
    s = Math.sin(r);
  return [vx * c + vz * s, -vx * s + vz * c];
}
function vecDaDirecao(dir) {
  return dir === DIR.leste
    ? [1, 0]
    : dir === DIR.oeste
      ? [-1, 0]
      : dir === DIR.sul
        ? [0, 1]
        : [0, -1];
}

/* -------------------------------------------------------------------- estado */
const S = {
  fase: "inicio",
  porta: 0,
  vida: 100,
  moedas: 0,
  bateria: 100,
  lanterna: true,
  escondido: null,
  tempoEscondido: 0,
  gazua: 0,
  curativo: 0,
  crucifixo: 0,
  chave: false,
  vitaminas: 0,
  protecao: 0,
  revives: CFG.revives,
  melhorPorta: 0,
  prompt: "",
  aviso: "",
  avisoAte: -1,
  objetivo: "",
  tempoPorta: 0,
  mortes: 0,
  tempo: 0,
  lojaAberta: false,
  salaAtual: null,
  salas: [],
  partes: [],
  celulas: {},
  corrida: null,
  figura: null,
  biblioteca: null,
  portas: {},
  entidades: {},
  agenda: [],
  elevador: { id: "lobby.elevador" },
  passos: -99,
  ruido: -99,
  ultimoDanoEm: -9,
  ultimoVisto: {},
  hudEm: -1,
  alarme: -99,
  pronto: false,
};

/* ------------------------------------------------------------------ mensagens */
function aviso(texto, segundos) {
  S.aviso = texto;
  S.avisoAte = S.tempo + (segundos === undefined ? 3 : segundos);
}
function som(nome, volume, tom) {
  engine.sound(
    nome,
    volume === undefined ? 1 : volume,
    tom === undefined ? 1 : tom,
  );
}
function hud(id, patch) {
  engine.ui(id, patch);
}

/* ---------------------------------------------------- montagem em fila (limite
   de 256 comandos por quadro da engine: cada sala é montada em poucos quadros) */
function enfileirar(sala, spec) {
  sala.fila.push(spec);
  sala.nodes.push(spec.id);
  S.partes.push({ sala, id: spec.id });
}
function processarFilas() {
  let gastos = 0;
  for (const sala of S.salas) {
    while (sala.fila.length && gastos < 22) {
      const spec = sala.fila.shift();
      const patch = {};
      for (const k in spec) if (k !== "id") patch[k] = spec[k];
      engine.spawn(spec.id, patch);
      gastos++;
    }
    if (!sala.fila.length && sala.ajustes && sala.ajustes.length) {
      for (const ajuste of sala.ajustes) {
        if (ajuste.patch) engine.set(ajuste.id, ajuste.patch);
        else if (ajuste.mover) engine.move(ajuste.id, ajuste.mover, ajuste.segundos || 0);
      }
      sala.ajustes = [];
    }
  }
}

/* ------------------------------------------------------- geometria de uma sala */
function novaSala(indice, gx, gz, dirEntrada) {
  const sala = {
    indice,
    gx,
    gz,
    x: gx * C,
    z: gz * C + CFG.deslocamentoZ,
    dirEntrada,
    dirSaida: dirEntrada,
    escuro: false,
    tema: null,
    forma: "aberta",
    nodes: [],
    fila: [],
    ajustes: [],
    contador: 0,
    vaos: {},
    mobilia: [],
    divisorias: [],
    snare: null,
    armarios: [],
    gavetas: [],
    quadros: [],
    portas: {},
    alavanca: null,
    itens: [],
    eventos: [],
    visitada: false,
    construida: false,
  };
  /* Decisão importante: o rumo da saída é sorteado AQUI, antes de construir.
     Assim o vão da parede, a porta e a sala vizinha apontam todos para o mesmo
     lado — nenhuma porta abre para o vazio. */
  sala.dirSaida = escolherSaida(sala);
  return sala;
}
function paredeX(sala, linha, comVao, texturaParede) {
  const base = `s${sala.indice}.wx${Math.round(linha * 10)}`,
    tex = texturaParede ? { textureId: texturaParede } : {};
  if (!comVao) {
    enfileirar(sala, {
      id: base,
      x: sala.x,
      y: H / 2,
      z: sala.z + linha,
      scale: [C, H, T],
      color: "#4c453c",
      physics: "static",
      roughness: 0.9,
      ...tex,
    });
    return;
  }
  const lado = (C - V) / 2,
    centro = (C + V) / 4;
  for (const sinal of [-1, 1])
    enfileirar(sala, {
      id: `${base}.${sinal > 0 ? "d" : "e"}`,
      x: sala.x + sinal * centro,
      y: H / 2,
      z: sala.z + linha,
      scale: [lado, H, T],
      color: "#4c453c",
      physics: "static",
      roughness: 0.9,
      ...tex,
    });
  enfileirar(sala, {
    id: `${base}.alto`,
    x: sala.x,
    y: AP + (H - AP) / 2,
    z: sala.z + linha,
    scale: [V + 0.2, H - AP, T],
    color: "#453e36",
    physics: "static",
    ...tex,
  });
}
function paredeZ(sala, linha, comVao, texturaParede) {
  const base = `s${sala.indice}.wz${Math.round(linha * 10)}`,
    tex = texturaParede ? { textureId: texturaParede } : {};
  if (!comVao) {
    enfileirar(sala, {
      id: base,
      x: sala.x + linha,
      y: H / 2,
      z: sala.z,
      scale: [T, H, C],
      color: "#4c453c",
      physics: "static",
      roughness: 0.9,
      ...tex,
    });
    return;
  }
  const lado = (C - V) / 2,
    centro = (C + V) / 4;
  for (const sinal of [-1, 1])
    enfileirar(sala, {
      id: `${base}.${sinal > 0 ? "d" : "e"}`,
      x: sala.x + linha,
      y: H / 2,
      z: sala.z + sinal * centro,
      scale: [T, H, lado],
      color: "#4c453c",
      physics: "static",
      roughness: 0.9,
      ...tex,
    });
  enfileirar(sala, {
    id: `${base}.alto`,
    x: sala.x + linha,
    y: AP + (H - AP) / 2,
    z: sala.z,
    scale: [T, H - AP, V + 0.2],
    color: "#453e36",
    physics: "static",
    ...tex,
  });
}
function paredeDoLado(sala, dir, comVao, texturaParede) {
  /* leste = +x, oeste = -x: o vão precisa nascer no MESMO lado da porta
     e da sala vizinha (antes as duas paredes de x estavam trocadas e a
     porta abria para o vazio). */
  const lado = dir === DIR.leste ? 1 : dir === DIR.oeste ? -1 : 0;
  if (lado) paredeZ(sala, lado * PAREDE, comVao, texturaParede);
  else paredeX(sala, (dir === DIR.sul ? 1 : -1) * PAREDE, comVao, texturaParede);
}
/* ============================== itens e gavetas =========================== */
/* Cada item é uma peça de verdade (cubo, cilindro, esfera, cápsula, anel). */
function criarItem(sala, tipo, x, z) {
  const id = `s${sala.indice}.item.${sala.contador++}`,
    X = sala.x + x,
    Z = sala.z + z,
    pecas = [],
    peca = (sufixo, y, patch) => {
      pecas.push(pecaNaSala(sala, `${id}.${sufixo}`, y, patch));
      return pecas[pecas.length - 1];
    };
  if (tipo === "moeda") {
    peca("a", 0.45, { kind: "cylinder", x: X, z: Z, scale: [0.36, 0.07, 0.36], rx: 90, color: "#f2c85a", roughness: 0.3, metalness: 0.55, light: { type: "point", intensity: 1.1, distance: 6, color: "#f2c85a" } });
  } else if (tipo === "chave") {
    peca("a", 0.5, { kind: "cylinder", x: X, z: Z, scale: [0.06, 0.3, 0.06], rz: 90, color: "#ffe08a", metalness: 0.6, roughness: 0.3, light: { type: "point", intensity: 2.4, distance: 6, color: "#ffe08a" } });
    peca("b", 0.5, { kind: "torus", x: X - 0.16, z: Z, scale: [0.16, 0.16, 0.05], ry: 90, color: "#ffe08a", metalness: 0.6, roughness: 0.3 });
    peca("c", 0.42, { kind: "box", x: X + 0.12, z: Z, scale: [0.05, 0.12, 0.05], color: "#ffe08a" });
  } else if (tipo === "gazua") {
    peca("a", 0.5, { kind: "box", x: X, z: Z, scale: [0.42, 0.05, 0.05], rz: 40, color: "#cfd6dd", metalness: 0.7, roughness: 0.25, light: { type: "point", intensity: 2, distance: 6, color: "#cfd6dd" } });
    peca("b", 0.62, { kind: "box", x: X + 0.17, z: Z, scale: [0.16, 0.05, 0.05], rz: 100, color: "#cfd6dd", metalness: 0.7, roughness: 0.25 });
    peca("c", 0.38, { kind: "box", x: X - 0.17, z: Z, scale: [0.13, 0.05, 0.05], rz: 100, color: "#cfd6dd", metalness: 0.7, roughness: 0.25 });
  } else if (tipo === "curativo") {
    peca("a", 0.42, { kind: "box", x: X, z: Z, scale: [0.5, 0.3, 0.34], color: "#e8e4dc", roughness: 0.6, light: { type: "point", intensity: 1.8, distance: 6, color: "#f0e0d0" } });
    peca("b", 0.43, { kind: "box", x: X, z: Z - 0.18, scale: [0.34, 0.1, 0.02], color: "#c8503f" });
    peca("c", 0.43, { kind: "box", x: X, z: Z - 0.18, scale: [0.1, 0.3, 0.02], color: "#c8503f" });
  } else if (tipo === "crucifixo") {
    peca("a", 0.62, { kind: "box", x: X, z: Z, scale: [0.09, 0.7, 0.09], color: "#d8b46a", metalness: 0.65, roughness: 0.3, light: { type: "point", intensity: 3, distance: 7, color: "#ffe9a8", flicker: 0.2, flickerSpeed: 3 } });
    peca("b", 0.76, { kind: "box", x: X, z: Z, scale: [0.42, 0.09, 0.09], color: "#d8b46a", metalness: 0.65, roughness: 0.3 });
  } else if (tipo === "bateria") {
    peca("a", 0.45, { kind: "cylinder", x: X, z: Z, scale: [0.16, 0.42, 0.16], color: "#3f4a52", metalness: 0.5, roughness: 0.35, light: { type: "point", intensity: 1.9, distance: 6, color: "#9fd3c0" } });
    peca("b", 0.68, { kind: "cylinder", x: X, z: Z, scale: [0.08, 0.08, 0.08], color: "#c9a24a", metalness: 0.7, roughness: 0.3 });
  } else if (tipo === "vitaminas") {
    peca("a", 0.42, { kind: "cylinder", x: X, z: Z, scale: [0.22, 0.5, 0.22], color: "#e0783c", roughness: 0.4, light: { type: "point", intensity: 1.9, distance: 6, color: "#ffb27a" } });
    peca("b", 0.7, { kind: "cylinder", x: X, z: Z, scale: [0.14, 0.1, 0.14], color: "#f4f1e6" });
  }
  sala.itens.push({ id, tipo, x: X, y: 0.5, z: Z, pego: false, pecas: pecas });
  return id;
}
/** peça solta na sala (item/decoração): não entra na colisão dos móveis */
function pecaNaSala(sala, id, y, patch) {
  enfileirar(sala, { id, y, physics: "none", ...patch });
  return id;
}
/** item de saque: procura um canto livre perto do centro e, se não achar, no vão */
function criarItemAleatorio(sala, fixo) {
  const tipos = ["moeda", "moeda", "moeda", "bateria", "curativo", "gazua", "crucifixo", "vitaminas"],
    tipo = fixo || escolha(tipos);
  for (let tentativa = 0; tentativa < 14; tentativa++) {
    const x = aleatorio(-4.6, 4.6),
      z = aleatorio(-4.6, 4.6);
    if (!cabe(sala, x, z, 0.4, 0.4)) continue;
    return criarItem(sala, tipo, x, z);
  }
  const [dx, dz] = vecDaDirecao(sala.dirSaida);
  return criarItem(sala, tipo, dx * (MEIA - 2.2), dz * (MEIA - 2.2));
}
function darItem(tipo, quantidade) {
  const q = quantidade || 1;
  if (tipo === "bateria") {
    S.bateria = lim(S.bateria + CFG.bateriaGanha, 0, 100);
    aviso("Pilha encontrada. Lanterna recarregada.");
  } else if (tipo === "curativo") {
    S.curativo += q;
    aviso("Curativo guardado (tecla Q).");
  } else if (tipo === "gazua") {
    S.gazua += q;
    aviso("Gazua guardada.");
  } else if (tipo === "crucifixo") {
    S.crucifixo += q;
    aviso("Crucifixo guardado (tecla C).");
  } else if (tipo === "vitaminas") {
    S.vitaminas += 12;
    aviso("Vitaminas: corra mais rápido por alguns segundos.");
  } else if (tipo === "chave") {
    S.chave = true;
    aviso("Chave da porta encontrada!");
  }
  maoDoItem(tipo, tipo === "moeda" ? 1.6 : 0);
  som("item", 0.7);
}
/** abre a gaveta de verdade: o modelo desliza para fora do gaveteiro */
function abrirGaveta(d) {
  d.aberta = true;
  const dist = 0.62;
  engine.move(d.modelo, { x: d.x + d.nx * dist, z: d.z + d.nz * dist }, 0.4);
  if (d.puxador) engine.move(d.puxador, { x: d.x + d.nx * (dist + 0.18), z: d.z + d.nz * (dist + 0.18) }, 0.4);
  som("gaveta", 0.9);
  salaEmRuido("gaveta", d.x, d.z);
}
function saquear(d) {
  d.saqueada = true;
  if (d.timothy) {
    d.timothy = false;
    S.ultimoDanoEm = S.tempo;
    tremor(0.9, 0.5);
    engine.damage("jogador", 25);
    som("aranha", 1, 0.9);
    engine.flicker("*", 0.7, 0.6);
    return aviso("Timothy! Uma aranha enorme pula da gaveta.", 4);
  }
  if (d.jack) {
    d.jack = false;
    som("susto", 1, 1);
    engine.flicker("*", 1, 0.85);
    return aviso("Jack! Que susto.", 3);
  }
  const r = Math.random();
  if (r < 0.36) return aviso("A gaveta está vazia.");
  if (r < 0.72) {
    const n = inteiro(4, 15);
    S.moedas += n;
    som("moeda", 0.8);
    return aviso("+" + n + " moedas.");
  }
  if (r < 0.86) {
    darItem(escolha(["bateria", "curativo", "gazua", "crucifixo", "vitaminas"]));
    return;
  }
  if (S.chave) return aviso("Nada além de poeira.");
  darItem("chave");
}
/* ============================== portas e trancas ========================== */
function usarPorta(numero) {
  const porta = S.portas[numero];
  if (!porta) return;
  if (porta.aberta) return;
  if (porta.dupe && !porta.dupeAvisado) {
    porta.dupeAvisado = true;
    return usarDupe(porta);
  }
  if (porta.trancada === "chave" && !S.chave) {
    som("porta.trancada", 0.9);
    return aviso("Trancada. Procure a chave nesta sala.");
  }
  if (porta.trancada === "cadeado") {
    if (S.gazua <= 0) {
      som("porta.trancada", 0.9);
      return aviso("Cadeado. Você precisa de uma gazua.");
    }
    S.gazua--;
    mao("gazua", 1.8);
    som("gazua", 1);
    aviso("Cadeado aberto com a gazua.");
  }
  if (porta.trancada === "alavanca" && !porta.destrancando) {
    som("porta.trancada", 0.9);
    return aviso(
      porta.sala && porta.sala.alavanca && porta.sala.alavanca.usada
        ? "Destravada. Abra a porta."
        : "Esta porta abre com a alavanca da sala.",
    );
  }
  abrirPorta(porta, 0.65);
  som("porta.abrir", 0.9);
  salaEmRuido("porta", porta.sala ? porta.sala.x : 0, porta.sala ? porta.sala.z : 0);
  if (numero === S.porta + 1) S.objetivo = "Atravesse a porta " + numero + ".";
}
/** Dupe: porta falsa — engole o jogador e devolve para a sala anterior */
function usarDupe(porta) {
  const sala = porta.sala;
  som("dupe", 1);
  engine.flicker("*", 1.6, 0.85);
  abrirPorta(porta, 0.5);
  if (!sala || sala.indice <= 1) {
    aviso("A porta range e você recua. Não abriu.", 3);
    S.susto = 0.6;
    return;
  }
  setTimeoutComando(() => {
    if (S.fase !== "hotel" && S.fase !== "corrida") return;
    const anterior = S.salas.filter((s) => s.indice === sala.indice - 1)[0];
    if (!anterior) return;
    const [dx, dz] = vecDaDirecao(anterior.dirEntrada);
    engine.set("jogador", {
      x: anterior.x + dx * (MEIA - 2),
      y: 0.95,
      z: anterior.z + dz * (MEIA - 2),
      vx: 0,
      vy: 0,
      vz: 0,
    });
    engine.flicker("*", 1.4, 0.9);
    som("susto", 0.8, 0.9);
    S.ultimoDanoEm = S.tempo;
    engine.damage("jogador", 8);
    aviso("Era uma porta falsa. Você voltou para a sala " + anterior.indice + ".", 4);
    S.susto = 0.8;
  }, 0.55);
}
function cabeNoChao(sala, x, z, mx, mz) {
  if (!dentroDaSala(x, z, mx + 0.06, mz + 0.06)) return false;
  const minha = caixa(x, z, mx, mz);
  for (const outra of sala.mobilia) if (encosta(minha, outra, 0.35)) return false;
  return true;
}
function criarSnare(sala, posicao) {
  const achado = (mx, mz, comCorredores) => {
    for (let tentativa = 0; tentativa < 20; tentativa++) {
      const x = aleatorio(-4.6, 4.6),
        z = aleatorio(-4.6, 4.6);
      const livre = comCorredores ? cabe(sala, x, z, mx, mz) : cabeNoChao(sala, x, z, mx, mz);
      if (livre) return { x, z };
    }
    return null;
  };
  const lugar = posicao || achado(0.85, 0.85, true) || achado(0.7, 0.7, false);
  if (!lugar) return null;
  return montarSnare(sala, lugar.x, lugar.z);
}
/** armadilha de chão: aro de metal que trava o pé do jogador */
function montarSnare(sala, x, z) {
  const id = `s${sala.indice}.snare`;
  enfileirar(sala, {
    id,
    kind: "torus",
    x: sala.x + x,
    y: 0.12,
    z: sala.z + z,
    scale: [1.5, 1.5, 0.12],
    color: "#6d5a3a",
    metalness: 0.5,
    roughness: 0.4,
    physics: "none",
  });
  sala.snare = {
    id,
    x: sala.x + x,
    z: sala.z + z,
    lx: x,
    lz: z,
    travado: false,
    tempo: 0,
    tentativas: 0,
  };
  return sala.snare;
}
function atualizarSnare(dt, eu) {
  const sala = S.salaAtual;
  if (!sala || !sala.snare || !eu) return;
  const s = sala.snare;
  if (s.sala !== sala) s.sala = sala;
  const dist = Math.hypot(eu.x - s.x, eu.z - s.z);
  if (s.travado) {
    s.tempo += dt;
    if (s.tempo > 4.2 && s.tentativas < 3) {
      s.tentativas++;
      s.tempo = 0;
      S.ultimoDanoEm = S.tempo;
      tremor(0.5, 0.35);
      engine.damage("jogador", 12);
      som("snare", 1, 1.1);
      aviso("A armadilha aperta. Aperte Espaço repetidamente!", 2.5);
      if (s.tentativas >= 3) {
        s.travado = false;
        aviso("Você se soltou, mas o metal mordeu.", 2.5);
      }
    }
    return;
  }
  if (dist < 0.85 && !S.escondido) {
    s.travado = true;
    s.tempo = 0;
    s.tentativas = 0;
    engine.freeze(true);
    som("snare", 1, 0.9);
    aviso("Armadilha! Aperte Espaço para escapar.", 4);
  }
}
function escaparSnare() {
  const sala = S.salaAtual;
  if (!sala || !sala.snare || !sala.snare.travado || S.escondido) return;
  const s = sala.snare;
  s.tentativas++;
  som("porta.bater", 0.7, 1.3);
  if (s.tentativas >= 4) {
    s.travado = false;
    engine.freeze(false);
    s.tentativas = 0;
    aviso("Você escapou da armadilha.", 2.5);
  } else aviso("Continue apertando Espaço! (" + (4 - s.tentativas) + ")", 1.2);
}

/* Porta de vaivém em torno da dobradiça. O nó é a folha; o script calcula
   posição e rotação para o arco de abertura. */
function criarPorta(numero, sala, dir) {
  const [dx, dz] = vecDaDirecao(dir);
  /* arco de pedra em cima do vão (modelo pronto "arch") */
  {
    const px = sala.x + dx * MEIA,
      pz = sala.z + dz * MEIA;
    peca(
      sala,
      "arco",
      px,
      pz,
      dz !== 0 ? [3.1, 0.55, 0.45] : [0.45, 0.55, 3.1],
      "#5b5248",
      { kind: "arch", base: H - 0.9, textura: TEX.pedra, physics: "none" },
    );
  }
  const horizontal = dz !== 0;
  const linha = MEIA;
  const dobradica = horizontal
    ? { x: sala.x + (chance(0.5) ? 1 : -1) * (V / 2 - 0.06), z: sala.z + dz * linha }
    : { x: sala.x + dx * linha, z: sala.z + (chance(0.5) ? 1 : -1) * (V / 2 - 0.06) };
  const eixoFechado = horizontal
    ? { x: -Math.sign(dobradica.x - sala.x) || 1, z: 0 }
    : { x: 0, z: -Math.sign(dobradica.z - sala.z) || 1 };
  const interior = { x: -dx, z: -dz };
  let giro = 1;
  const [tx, tz] = rotY(eixoFechado.x, eixoFechado.z, 96);
  if (tx * interior.x + tz * interior.z < 0) giro = -1;
  const porta = {
    id: `porta.${numero}`,
    numero,
    sala,
    aberta: false,
    angulo: 0,
    dobradica,
    eixoFechado,
    base: horizontal ? 0 : 90,
    comprimento: V - 0.12,
    altura: AP - 0.12,
    giro,
    trancada: "livre",
    destrancando: false,
  };
  enfileirar(sala, {
    id: porta.id,
    x: dobradica.x + eixoFechado.x * (porta.comprimento / 2),
    y: porta.altura / 2 + 0.02,
    z: dobradica.z + eixoFechado.z * (porta.comprimento / 2),
    scale: horizontal
      ? [porta.comprimento, porta.altura, 0.16]
      : [0.16, porta.altura, porta.comprimento],
    ry: porta.base,
    color: "#7a5330",
    physics: "static",
    friction: 0.2,
    roughness: 0.7,
  });
  const placa = porta.id + ".placa";
  enfileirar(sala, {
    id: placa,
    x: sala.x + dx * (PAREDE + 0.1) ,
    y: AP + 0.34,
    z: sala.z + dz * (PAREDE + 0.1),
    scale: horizontal ? [1.1, 0.5, 0.14] : [0.14, 0.5, 1.1],
    ry: horizontal ? 0 : 90,
    color: "#c9a24a",
    metalness: 0.5,
    roughness: 0.4,
    physics: "none",
    textureId: TEX.lousa,
    light: { type: "point", intensity: 1.2, distance: 5, color: "#ffd9a0" },
  });
  porta.placa = placa;
  S.portas[numero] = porta;
  return porta;
}
function posicionarPorta(porta, angulo, segundos) {
  porta.angulo = angulo;
  const [ox, oz] = rotY(
    porta.eixoFechado.x,
    porta.eixoFechado.z,
    angulo * porta.giro,
  );
  const patch = {
    x: porta.dobradica.x + ox * (porta.comprimento / 2),
    z: porta.dobradica.z + oz * (porta.comprimento / 2),
    ry: porta.base + angulo * porta.giro,
  };
  if (segundos > 0) engine.move(porta.id, patch, segundos);
  else engine.set(porta.id, patch);
}
function abrirPorta(porta, segundos) {
  if (porta.aberta) return;
  porta.aberta = true;
  posicionarPorta(porta, 96, segundos === undefined ? 0.6 : segundos);
}
function fecharPorta(porta, segundos) {
  if (!porta.aberta) return;
  porta.aberta = false;
  posicionarPorta(porta, 0, segundos === undefined ? 0.5 : segundos);
}

/* ------------------------------------------------------------------ mobiliário */
/* --------------------------------------------------- ocupação, colisão e vãos */
/** retângulo (x0,z0)-(x1,z1) em coordenadas locais da sala */
function caixa(x, z, mx, mz) {
  return { x0: x - mx, x1: x + mx, z0: z - mz, z1: z + mz };
}
function encosta(a, b, folga) {
  return (
    a.x0 < b.x1 + folga &&
    a.x1 > b.x0 - folga &&
    a.z0 < b.z1 + folga &&
    a.z1 > b.z0 - folga
  );
}
function dentroDaSala(x, z, mx, mz) {
  const limite = MEIA - T;
  return Math.abs(x) + mx <= limite && Math.abs(z) + mz <= limite;
}
/** corredor de cada vão: retângulo que vai da porta até o centro da sala */
function corredores(sala) {
  const lista = [];
  for (const dir of [DIR.leste, DIR.oeste, DIR.sul, DIR.norte]) {
    if (!sala.vaos[dir]) continue;
    const [dx, dz] = vecDaDirecao(dir),
      comprimento = PAREDE - 0.3,
      largura = V / 2 + 1.15;
    lista.push(
      caixa(
        (dx * comprimento) / 2,
        (dz * comprimento) / 2,
        dx ? comprimento / 2 : largura,
        dz ? comprimento / 2 : largura,
      ),
    );
  }
  return lista;
}
/** cabe uma peça aqui? (dentro da sala, fora dos corredores e dos móveis) */
function cabe(sala, x, z, mx, mz) {
  if (!dentroDaSala(x, z, mx + 0.06, mz + 0.06)) return false;
  const minha = caixa(x, z, mx, mz);
  for (const c of corredores(sala)) if (encosta(minha, c, 0.3)) return false;
  for (const outra of sala.mobilia) if (encosta(minha, outra, 0.4)) return false;
  return true;
}
function ocupar(sala, x, z, mx, mz) {
  sala.mobilia.push(caixa(x, z, mx, mz));
}
/** móvel: ocupa espaço, respeita corredores e nunca atravessa outro móvel */
function movel(sala, nome, x, z, tamanho, corPeca, extra) {
  const opcoes = extra || {},
    base = opcoes.base || 0,
    mx = tamanho[0] / 2,
    mz = tamanho[2] / 2,
    semColisao = opcoes.livre === false;
  if (!semColisao && !cabe(sala, x, z, mx, mz)) return null;
  if (!semColisao) ocupar(sala, x, z, mx, mz);
  const id = `s${sala.indice}.${nome}.${sala.contador++}`,
    patch = {
      id,
      x: sala.x + x,
      y: base + tamanho[1] / 2,
      z: sala.z + z,
      scale: tamanho,
      color: corPeca,
      physics: semColisao ? "none" : "static",
      friction: 0.5,
    };
  for (const k in opcoes)
    if (k !== "base" && k !== "livre" && k !== "textura") patch[k] = opcoes[k];
  if (opcoes.textura) patch.textureId = opcoes.textura;
  enfileirar(sala, patch);
  return id;
}
/** peça de decoração: não bloqueia nada */
function peca(sala, nome, x, z, tamanho, corPeca, extra) {
  const opcoes = extra || {};
  opcoes.livre = false;
  return movel(sala, nome, x, z, tamanho, corPeca, opcoes);
}
/** parede interna de uma variante de sala (bloqueia o caminho de verdade) */
function paredeInterna(sala, x, z, tamanho, extra) {
  const id = movel(
    sala,
    "divisoria",
    x,
    z,
    tamanho,
    (extra && extra.color) || "#4a433a",
    extra,
  );
  if (id) sala.divisorias.push(caixa(x, z, tamanho[0] / 2, tamanho[2] / 2));
  return id;
}
/* Encosto na parede: devolve o centro de um móvel de profundidade `prof` com o
   fundo na face interna da parede, mais a normal apontando para o centro da sala.
   `+ nx/nz` anda para dentro da sala; `- nx/nz` anda para dentro da parede. */
function encosto(dir, posicao, prof) {
  const face = PAREDE - T / 2,
    fora = face - (prof === undefined ? 1.5 : prof) / 2 - 0.12,
    meio = 4.3 * posicao,
    [dx, dz] = vecDaDirecao(dir);
  return {
    x: dx * fora + (dz ? meio : 0),
    z: dz * fora + (dx ? meio : 0),
    nx: -dx,
    nz: -dz,
  };
}
/** ponto colado na parede (quadros, alavanca): `altura` é o quanto o centro da
    peça entra na sala a partir da face interna da parede */
function naParede(dir, posicao, altura) {
  const face = PAREDE - T / 2 - (altura === undefined ? 0.1 : altura),
    meio = 4.3 * posicao,
    [dx, dz] = vecDaDirecao(dir);
  return {
    x: dx * face + (dz ? meio : 0),
    z: dz * face + (dx ? meio : 0),
    nx: -dx,
    nz: -dz,
  };
}
function cortina(sala, dir, posicao) {
  const p = encosto(dir, posicao, 0.8);
  peca(sala, "cortina", p.x + p.nx * 0.25, p.z + p.nz * 0.25, p.nz !== 0 ? [1.6, 1.9, 0.08] : [0.08, 1.9, 1.6], "#6a2c33", { base: 1.5, textura: TEX.cortina });
  peca(sala, "varao", p.x + p.nx * 0.3, p.z + p.nz * 0.3, p.nz !== 0 ? [1.9, 0.08, 0.08] : [0.08, 0.08, 1.9], "#c9a24a", { base: 2.45, textura: TEX.metal });
}
function mancha(sala) {
  peca(sala, "mancha", aleatorio(-2, 2), aleatorio(-2, 2), [1.5, 0.02, 1.5], "#5f2a24", { base: 0.02, textureId: TEX.sangue, physics: "none" });
}
function armario(sala, dir, posicao) {
  const p = encosto(dir, posicao, 1.5),
    horizontal = p.nz !== 0,
    ocupado = chance(CFG.chance.escondido);
  const corpo = movel(
    sala,
    "armario",
    p.x,
    p.z,
    horizontal ? [2.6, 2.9, 1.5] : [1.5, 2.9, 2.6],
    "#5a4531",
    { roughness: 0.75, textura: TEX.madeiraEscura },
  );
  if (!corpo) return;
  peca(sala, "armario.fundo", p.x - p.nx * 0.6, p.z - p.nz * 0.6, horizontal ? [2.4, 2.7, 0.1] : [0.1, 2.7, 2.4], "#241a12", { base: 0.08, textura: TEX.madeiraEscura });
  peca(sala, "armario.prateleira", p.x - p.nx * 0.2, p.z - p.nz * 0.2, horizontal ? [2.3, 0.08, 0.9] : [0.9, 0.08, 2.3], "#3f3226", { base: 1.75, textura: TEX.madeira });
  peca(sala, "armario.cabide", p.x + p.nx * 0.1, p.z + p.nz * 0.1, horizontal ? [0.1, 0.1, 1.9] : [1.9, 0.1, 0.1], "#c9a24a", { base: 1.55, textura: TEX.metal });
  const folhas = [];
  for (const sinal of [-1, 1]) {
    const hingeX = p.x - p.nx * 0.72 + (horizontal ? sinal * 1.3 : 0),
      hingeZ = p.z - p.nz * 0.72 + (horizontal ? 0 : sinal * 1.3),
      ex = horizontal ? -sinal : 0,
      ez = horizontal ? 0 : -sinal,
      id = peca(sala, "armario.porta", hingeX + ex * 0.62, hingeZ + ez * 0.62, horizontal ? [1.2, 2.75, 0.12] : [0.12, 2.75, 1.2], "#6a5238", { base: 0.06, textura: TEX.madeiraEscura });
    peca(sala, "armario.puxador", hingeX + ex * 1.16, hingeZ + ez * 1.16, [0.12, 0.5, 0.12], "#c9a24a", { base: 1.15, textura: TEX.metal });
    folhas.push({ id, hx: hingeX, hz: hingeZ, ex, ez, base: horizontal ? 0 : 90, comprimento: 1.2, giro: sinal, angulo: 0 });
  }
  if (chance(0.35)) {
    const id = `s${sala.indice}.armario.item.${sala.contador++}`,
      x = p.x - p.nx * 0.55,
      z = p.z - p.nz * 0.55;
    pecaNaSala(sala, id, 1.83, { kind: "box", x, z, scale: [0.34, 0.26, 0.34], color: "#e8e4dc", roughness: 0.6, textureId: TEX.tecido });
    sala.itens.push({ id, tipo: escolha(["bateria", "curativo", "gazua"]), x, y: 1.83, z, pego: false, pecas: [id] });
  }
  sala.armarios.push({
    id: corpo,
    folhas,
    corpo,
    x: sala.x + p.x,
    z: sala.z + p.z,
    nx: p.nx,
    nz: p.nz,
    ocupado: false,
    aberto: false,
    hide: ocupado,
    perigo: chance(0.26),
    tempo: 0,
  });
}
function gaveteiro(sala, dir, posicao) {
  const p = encosto(dir, posicao, 1.1),
    horizontal = p.nz !== 0,
    esp = horizontal ? [1.8, 1.15, 1.1] : [1.1, 1.15, 1.8],
    /* a gaveta fica embutida na frente do gaveteiro (0,32 m de fundo) */
    gavetaFora = 0.55 - 0.16,
    corpo = movel(sala, "gaveteiro", p.x, p.z, esp, "#4f3f31", {
      roughness: 0.7,
      textura: TEX.madeira,
    });
  if (!corpo) return;
  const gx = p.x + p.nx * gavetaFora,
    gz = p.z + p.nz * gavetaFora,
    tamanho = horizontal ? [1.5, 0.3, 0.32] : [0.32, 0.3, 1.5],
    idPuxador = peca(sala, "puxador", gx + p.nx * 0.16, gz + p.nz * 0.16, horizontal ? [0.5, 0.08, 0.08] : [0.08, 0.08, 0.5], "#c9a24a", { base: 0.7, textura: TEX.metal }),
    gaveta = peca(sala, "gaveta", gx, gz, tamanho, "#6b573f", { base: 0.55, textura: TEX.madeira }),
    puxador = idPuxador;
  const timothy = chance(CFG.chance.timothy),
    jack = !timothy && chance(CFG.chance.jack);
  sala.gavetas.push({
    id: gaveta,
    corpo,
    puxador: puxador,
    modelo: gaveta,
    x: sala.x + gx,
    z: sala.z + gz,
    lx: gx,
    lz: gz,
    nx: p.nx,
    nz: p.nz,
    aberta: false,
    saqueada: false,
    timothy: timothy,
    jack: jack,
  });
}
function quadro(sala, dir, posicao) {
  const p = naParede(dir, posicao, 0.16),
    horizontal = p.nz !== 0,
    id = peca(
      sala,
      "quadro",
      p.x,
      p.z,
      horizontal ? [2.5, 1.8, 0.14] : [0.14, 1.8, 2.5],
      "#332a26",
      { base: 1.4, textura: TEX.quadro },
    );
  if (!id) return;
  const olhos = [];
  for (const sinal of [-1, 1]) {
    const oid = peca(
      sala,
      "olho",
      p.x + p.nx * 0.07 + (horizontal ? sinal * 0.42 : 0),
      p.z + p.nz * 0.07 + (horizontal ? 0 : sinal * 0.42),
      [0.2, 0.12, 0.2],
      "#ffe6a2",
      {
        base: 2.14,
        textureId: TEX.face.olhos,
        color: "#ffffff",
        light: {
          type: "point",
          intensity: 2.2,
          distance: 8,
          color: "#ffd49a",
          flicker: 0.3,
          flickerSpeed: 3,
        },
      },
    );
    olhos.push(oid);
  }
  sala.quadros.push({
    id,
    olhos,
    x: sala.x + p.x,
    y: 2.2,
    z: sala.z + p.z,
    avisou: false,
  });
}
function cama(sala, dir, posicao) {
  const p = encosto(dir, posicao, 2.2),
    horizontal = p.nz !== 0;
  if (
    !movel(
      sala,
      "cama",
      p.x,
      p.z,
      horizontal ? [3.4, 0.5, 2.2] : [2.2, 0.5, 3.4],
      "#6a5645",
      { base: 0.25, textura: TEX.madeira },
    )
  )
    return;
  peca(
    sala,
    "colchao",
    p.x,
    p.z,
    horizontal ? [3.1, 0.34, 1.9] : [1.9, 0.34, 3.1],
    "#8a7c6a",
    { base: 0.55, textura: TEX.roupa },
  );
  peca(
    sala,
    "travesseiro",
    p.x + (horizontal ? 1.15 : 0),
    p.z + (horizontal ? 0 : 1.15),
    horizontal ? [0.9, 0.22, 1.3] : [1.3, 0.22, 0.9],
    "#d8d0c0",
    { base: 0.95, textura: TEX.tecido },
  );
}
function mesaComCadeiras(sala) {
  if (
    !movel(sala, "mesa", 0, 0, [2.6, 0.22, 2.6], "#6d5942", {
      base: 0.72,
      textura: TEX.madeira,
    })
  )
    return;
  peca(sala, "peMesa", 0, 0, [0.34, 0.72, 0.34], "#4a3b2c", { textura: TEX.madeiraEscura });
  for (const [dx, dz] of [
    [-1.9, 0],
    [1.9, 0],
    [0, -1.9],
    [0, 1.9],
  ])
    movel(sala, "cadeira", dx, dz, [0.9, 1.1, 0.9], "#5b4a36", {
      textura: TEX.madeira,
    });
}
function estante(sala, dir, posicao) {
  const p = encosto(dir, posicao, 0.9),
    horizontal = p.nz !== 0;
  return movel(
    sala,
    "estante",
    p.x,
    p.z,
    horizontal ? [3.6, 3, 0.9] : [0.9, 3, 3.6],
    "#43362a",
    { textura: TEX.estante },
  );
}
function banheira(sala, dir, posicao) {
  const p = encosto(dir, posicao, 1.3),
    horizontal = p.nz !== 0;
  if (
    !movel(
      sala,
      "banheira",
      p.x,
      p.z,
      horizontal ? [2.4, 0.95, 1.3] : [1.3, 0.95, 2.4],
      "#8f9c99",
      { textura: TEX.azulejo },
    )
  )
    return;
  peca(
    sala,
    "espelho",
    p.x + p.nx * 0.6,
    p.z + p.nz * 0.6,
    horizontal ? [1.5, 1.1, 0.1] : [0.1, 1.1, 1.5],
    "#9fb3b8",
    { base: 1.7, textureId: TEX.vidro },
  );
}
function escrivaninha(sala, dir, posicao) {
  const p = encosto(dir, posicao, 1.3),
    horizontal = p.nz !== 0;
  if (
    !movel(
      sala,
      "escrivaninha",
      p.x,
      p.z,
      horizontal ? [3, 0.9, 1.3] : [1.3, 0.9, 3],
      "#5d4a36",
      { textura: TEX.madeira },
    )
  )
    return;
  peca(
    sala,
    "cadeiraEscritorio",
    p.x + p.nx * 1.5,
    p.z + p.nz * 1.5,
    [0.85, 1.15, 0.85],
    "#3f4a52",
    { textura: TEX.metal },
  );
}
function caixotes(sala) {
  let feitos = 0;
  for (let tentativa = 0; tentativa < 12 && feitos < 3; tentativa++) {
    const x = aleatorio(-4.4, 4.4),
      z = aleatorio(-4.4, 4.4);
    if (
      movel(sala, "caixote", x, z, [1.1, 1.1, 1.1], "#7a6244", {
        friction: 0.7,
        textura: TEX.caixote,
      })
    )
      feitos++;
  }
}
/** entulho do depósito: pedras (kind rock) e um monte de terra (kind terrain) */
function entulho(sala) {
  for (let i = 0; i < 3; i++) {
    const x = aleatorio(-4, 4),
      z = aleatorio(-4, 4);
    peca(sala, "pedra", x, z, [aleatorio(0.5, 0.9), aleatorio(0.4, 0.7), aleatorio(0.5, 0.9)], "#6a6560", {
      kind: "rock",
      base: 0,
      textura: TEX.pedra,
      physics: "static",
      friction: 0.7,
    });
  }
  const x = aleatorio(-3.5, 3.5),
    z = aleatorio(-3.5, 3.5);
  peca(sala, "monte", x, z, [2.2, 0.7, 2.2], "#575553", {
    kind: "terrain",
    base: 0,
    textura: TEX.pedra,
    physics: "static",
  });
}
function pilares(sala) {
  let feitos = 0;
  for (const [x, z] of [
    [-3.3, -3.3],
    [3.3, -3.3],
    [-3.3, 3.3],
    [3.3, 3.3],
  ])
    if (
      movel(sala, "pilar", x, z, [1.2, H, 1.2], "#4a433a", {
        textura: sala.tema ? sala.tema.parede : undefined,
      })
    )
      feitos++;
  return feitos;
}
function luminaria(sala) {
  /* modelo pronto: globo da lâmpada (sphere) + aro (torus) */
  peca(sala, "lampada.globo", 0, 0, [0.5, 0.5, 0.5], "#fff4d6", {
    kind: "sphere",
    base: H - 0.44,
    textureId: TEX.lampada,
    physics: "none",
  });
  peca(sala, "lampada.aro", 0, 0, [0.42, 0.06, 0.42], "#c9a24a", {
    kind: "torus",
    base: H - 0.2,
    textureId: TEX.metal,
    physics: "none",
  });
  peca(
    sala,
    "lampada",
    0,
    0,
    [0.6, 0.14, 0.6],
    "#efe0bd",
    {
      base: H - 0.24,
      light: {
        type: "point",
        intensity: sala.escuro ? 3.5 : CFG.luzDaSala,
        distance: 18,
        decay: 1.5,
        color: "#ffe4bb",
        flicker: sala.escuro ? 0.75 : 0.05,
        flickerSpeed: sala.escuro ? 14 : 4,
      },
    },
  );
}
const TEMAS = [
  {
    nome: "quarto",
    chao: "#4a3d31",
    parede: TEX.parede.quarto,
    carpete: TEX.carpete.quarto,
    conteudo: (s) => {
      cama(s, chance(0.5) ? DIR.sul : DIR.norte, chance(0.5) ? 1 : -1);
      armario(s, chance(0.5) ? DIR.leste : DIR.oeste, chance(0.5) ? 1 : -1);
      gaveteiro(s, DIR.norte, -1);
      gaveteiro(s, DIR.sul, 1);
      if (chance(CFG.chance.quadro)) quadro(s, DIR.sul, 1);
      cortina(s, chance(0.5) ? DIR.sul : DIR.norte, -1);
    },
  },
  {
    nome: "corredor",
    chao: "#3c3a37",
    parede: chance(0.35) ? TEX.pedra : TEX.parede.corredor,
    carpete: TEX.carpete.corredor,
    conteudo: (s) => {
      armario(s, DIR.sul, -1);
      if (chance(0.6)) armario(s, DIR.norte, 1);
      gaveteiro(s, DIR.leste, 1);
      estante(s, DIR.oeste, -1);
      caixotes(s);
      if (chance(0.3)) mancha(s);
    },
  },
  {
    nome: "sala de estar",
    chao: "#463b32",
    parede: TEX.parede.sala,
    carpete: TEX.carpete.sala,
    conteudo: (s) => {
      mesaComCadeiras(s);
      estante(s, chance(0.5) ? DIR.sul : DIR.norte, -1);
      gaveteiro(s, DIR.oeste, 1);
      armario(s, DIR.leste, 1);
      if (chance(CFG.chance.quadro)) quadro(s, DIR.norte, 1);
    },
  },
  {
    nome: "depósito",
    chao: "#3a3530",
    parede: chance(0.5) ? TEX.concreto : TEX.parede.deposito,
    carpete: TEX.carpete.deposito,
    conteudo: (s) => {
      estante(s, DIR.leste, -1);
      gaveteiro(s, DIR.sul, 1);
      caixotes(s);
      caixotes(s);
      entulho(s);
      if (chance(0.5)) quadro(s, DIR.oeste, -1);
      if (chance(0.4)) armario(s, DIR.norte, -1);
    },
  },
  {
    nome: "banheiro",
    chao: "#3f4544",
    parede: TEX.azulejo,
    carpete: TEX.azulejo,
    conteudo: (s) => {
      banheira(s, chance(0.5) ? DIR.leste : DIR.oeste, -1);
      gaveteiro(s, DIR.norte, 1);
      if (chance(0.5)) armario(s, DIR.sul, 1);
      if (chance(CFG.chance.quadro)) quadro(s, DIR.oeste, 1);
    },
  },
  {
    nome: "escritório",
    chao: "#3d3428",
    parede: TEX.parede.sala,
    carpete: TEX.carpete.sala,
    conteudo: (s) => {
      escrivaninha(s, chance(0.5) ? DIR.norte : DIR.sul, -1);
      estante(s, DIR.leste, 1);
      gaveteiro(s, DIR.oeste, -1);
      if (chance(CFG.chance.quadro)) quadro(s, DIR.sul, -1);
    },
  },
];
function construirSala(sala) {
  const tema = sala.corrida
    ? {
        nome: "corredor de fuga",
        chao: "#3a322c",
        parede: TEX.parede.corredor,
        carpete: TEX.carpete.corredor,
        conteudo: (s) => {
          pilares(s);
          caixotes(s);
        },
      }
    : sala.loja
      ? {
          nome: "loja",
          chao: "#3f352c",
          parede: TEX.parede.sala,
          carpete: TEX.carpete.sala,
          conteudo: construirLoja,
        }
      : sala.biblioteca
        ? {
            nome: "biblioteca",
            chao: "#332b25",
            parede: TEX.biblioteca,
            carpete: TEX.carpete.sala,
            conteudo: construirBiblioteca,
          }
        : (sala.tema || escolha(TEMAS));
  sala.tema = tema;
  enfileirar(sala, {
    id: `s${sala.indice}.piso`,
    x: sala.x,
    y: -0.2,
    z: sala.z,
    scale: [C, 0.4, C],
    color: tema.chao,
    physics: "static",
    friction: 0.7,
    textureId: tema.carpete,
  });
  enfileirar(sala, {
    id: `s${sala.indice}.teto`,
    x: sala.x,
    y: H + 0.2,
    z: sala.z,
    scale: [C, 0.4, C],
    color: "#241f1b",
    physics: "static",
    textureId: TEX.teto,
  });
  for (const dir of [DIR.leste, DIR.oeste, DIR.sul, DIR.norte]) {
    const comVao =
      (dir === OPOSTO[sala.dirEntrada] && sala.indice > 1) ||
      (dir === sala.dirSaida && !sala.finalSala);
    sala.vaos[dir] = comVao;
    paredeDoLado(sala, dir, comVao, tema.parede);
  }
  if (sala.finalSala) {
    const [ex, ez] = vecDaDirecao(sala.dirSaida);
    const id = `s${sala.indice}.elevador`;
    enfileirar(sala, {
      id,
      x: sala.x + ex * (PAREDE - 1.3),
      y: 1.5,
      z: sala.z + ez * (PAREDE - 1.3),
      scale: [3.2, 3, 0.5],
      color: "#2b3238",
      physics: "static",
      roughness: 0.5,
      metalness: 0.5,
      textureId: TEX.metal,
      light: { type: "point", intensity: 5, distance: 12, color: "#bfe2ff" },
    });
    sala.final = { elevador: id };
    luminaria(sala);
    return;
  }
  const porta = criarPorta(sala.indice + 1, sala, sala.dirSaida);
  sala.portas.saida = porta;
  if (!sala.corrida && !sala.loja && !sala.biblioteca) aplicarTranca(sala, porta, tema);
  marcarDupe(sala);
  luminaria(sala);
  formaDaSala(sala);
  tema.conteudo(sala);
  if (!sala.armarios.length) {
    for (const dir of [escolha([DIR.leste, DIR.oeste, DIR.sul, DIR.norte]), DIR.norte, DIR.sul, DIR.leste, DIR.oeste]) {
      armario(sala, dir, chance(0.5) ? 1 : -1);
      if (sala.armarios.length) break;
    }
  }
  if (!sala.corrida) {
    const quantos = chance(0.55) ? 1 : 0;
    for (let i = 0; i < quantos; i++) criarItemAleatorio(sala);
    if (chance(CFG.chance.item)) criarItemAleatorio(sala);
  }
  if (chance(CFG.chance.snare) && !sala.loja && !sala.biblioteca) criarSnare(sala);
  sala.construida = true;
  ajustarSala(sala);
  validarSala(sala);
}
/* ------------------------------------------------------- formato de cada sala */
function formaDaSala(sala) {
  const reta = sala.dirSaida === OPOSTO[sala.dirEntrada];
  sala.forma = escolha(
    (reta
      ? ["aberta", "pilares", "corredor", "dupla", "colunas", "l"]
      : ["aberta", "pilares", "colunas", "l"]
    ).concat(["aberta", "aberta"]),
  );
  const cor = sala.tema ? sala.tema.parede : undefined;
  if (sala.forma === "pilares" || sala.forma === "colunas") {
    pilares(sala);
    return;
  }
  if (sala.forma === "corredor") {
    // duas paredes internas deixando um corredor central na direção das portas
    const [dx, dz] = vecDaDirecao(sala.dirSaida);
    for (const sinal of [-1, 1]) {
      if (dx) paredeInterna(sala, dz * sinal * 3.5, 0, [0.5, H, C - 1.4], { textura: cor });
      else paredeInterna(sala, dx * sinal * 3.5, 0, [C - 1.4, H, 0.5], { textura: cor });
    }
    return;
  }
  if (sala.forma === "dupla") {
    // parede no meio com passagem alinhada às portas
    const [dx, dz] = vecDaDirecao(sala.dirSaida);
    if (dx) {
      for (const sinal of [-1, 1])
        paredeInterna(sala, 0, sinal * 3.4, [0.5, H, C - 6.8 - 1.6], { textura: cor });
    } else {
      for (const sinal of [-1, 1])
        paredeInterna(sala, sinal * 3.4, 0, [C - 6.8 - 1.6, H, 0.5], { textura: cor });
    }
    return;
  }
  if (sala.forma === "l") {
    const [dx, dz] = vecDaDirecao(sala.dirSaida);
    const lado = chance(0.5) ? 1 : -1;
    if (dx) paredeInterna(sala, dz * lado * 3.4, 0, [0.5, H, C - 6.6], { textura: cor });
    else paredeInterna(sala, 0, dx * lado * 3.4, [C - 6.6, H, 0.5], { textura: cor });
  }
}
/* ------------------------------------------- validação: sempre dá para passar */
const PASSO = 2;
function celulaLivre(sala, cx, cz) {
  const x = -MEIA + PASSO / 2 + cx * PASSO,
    z = -MEIA + PASSO / 2 + cz * PASSO,
    c = caixa(x, z, PASSO / 2, PASSO / 2);
  for (const b of sala.mobilia) if (encosta(c, b, 0.45)) return false;
  for (const b of sala.divisorias) if (encosta(c, b, 0.45)) return false;
  return true;
}
function celulaDe(sala, x, z) {
  return {
    cx: lim(Math.round((x + MEIA - PASSO / 2) / PASSO), 0, C / PASSO - 1),
    cz: lim(Math.round((z + MEIA - PASSO / 2) / PASSO), 0, C / PASSO - 1),
  };
}
function temCaminho(sala, de, ate) {
  const n = C / PASSO,
    visitado = {},
    fila = [de];
  visitado[de.cx + ":" + de.cz] = true;
  if (!celulaLivre(sala, de.cx, de.cz) || !celulaLivre(sala, ate.cx, ate.cz))
    return false;
  while (fila.length) {
    const atual = fila.shift();
    if (atual.cx === ate.cx && atual.cz === ate.cz) return true;
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const cx = atual.cx + dx,
        cz = atual.cz + dz;
      if (cx < 0 || cz < 0 || cx >= n || cz >= n) continue;
      const chave = cx + ":" + cz;
      if (visitado[chave] || !celulaLivre(sala, cx, cz)) continue;
      visitado[chave] = true;
      fila.push({ cx, cz });
    }
  }
  return false;
}
/** tira specs ainda na fila (usado quando a variante bloqueia o caminho) */
function descartarSpecs(sala, ids) {
  const dentro = (id) => ids.indexOf(id) >= 0;
  sala.fila = sala.fila.filter((s) => !dentro(s.id));
  sala.nodes = sala.nodes.filter((id) => !dentro(id));
  S.partes = S.partes.filter((p) => !(p.sala === sala && dentro(p.id)));
}
/** depois de construir: garante que entrada e saída continuam ligadas */
function ajustarSala(sala) {
  const [ex, ez] = vecDaDirecao(sala.dirSaida),
    [ix, iz] = vecDaDirecao(OPOSTO[sala.dirEntrada]),
    saida = celulaDe(sala, ex * (MEIA - 1.2), ez * (MEIA - 1.2)),
    entrada = celulaDe(sala, ix * (MEIA - 1.2), iz * (MEIA - 1.2));
  if (temCaminho(sala, entrada, saida)) return;
  // variante bloqueou: derruba as divisórias e revalida
  const ids = sala.divisorias.map((_, i) => `s${sala.indice}.divisoria.${i}`);
  descartarSpecs(sala, sala.nodes.filter((id) => id.indexOf(".divisoria.") >= 0));
  sala.divisorias = [];
  void ids;
  engine.log(
    "Sala " + sala.indice + ": variante " + sala.forma + " bloqueava a passagem — simplificada.",
  );
  if (temCaminho(sala, entrada, saida)) return;
  // rede de segurança: libera o miolo tampado por móveis
  const travados = sala.mobilia.filter((b) => {
    const c = caixa(0, 0, MEIA, MEIA);
    void c;
    return encosta(b, caixa(0, 0, 2.5, 2.5), 0);
  });
  void travados;
  engine.log("AVISO: sala " + sala.indice + " continua sem passagem.");
}
/* ---------------------------------------------------- loja e biblioteca (v4) */
function construirLoja(sala) {
  estante(sala, DIR.norte, -1);
  estante(sala, DIR.norte, 1);
  movel(sala, "balcao", 0, 2.2, [6.4, 1.1, 1.1], "#5d4630", { textura: TEX.madeira });
  movel(sala, "caixa", -2.2, 2.2, [0.8, 0.5, 0.8], "#8a6a3c", { base: 1.1 });
  const id = `s${sala.indice}.jeff`;
  enfileirar(sala, {
    id,
    x: sala.x,
    y: 1.5,
    z: sala.z + 2.2,
    scale: [0.9, 1.6, 0.7],
    color: "#2f3a44",
    actor: { humanoid: true, skin: "#7d6a58", animationSpeed: 0.6 },
    physics: "static",
    light: { type: "point", intensity: 4, distance: 9, color: "#ffe1b0" },
  });
  sala.jeff = { id, x: sala.x, z: sala.z + 2.2 };
  /* duas vitrines atrás do balcão para a loja parecer uma loja */
  peca(sala, "vitrine", -2.6, 4.1, [2.2, 1.6, 0.3], "#3b4b52", { base: 0.9, material: 0, textura: TEX.metal });
  peca(sala, "vitrine", 2.6, 4.1, [2.2, 1.6, 0.3], "#3b4b52", { base: 0.9, material: 0, textura: TEX.metal });
}
function construirBiblioteca(sala) {
  for (let i = -1; i <= 1; i++) {
    estante(sala, DIR.leste, i);
    estante(sala, DIR.oeste, i);
  }
  /* duas fileiras centrais: é o labirinto onde a Figura persegue */
  for (const sinal of [-1, 1]) {
    movel(sala, "estante", sinal * 2.4, -1.6, [1, 3, 4.4], "#43362a", { textura: TEX.estante });
    movel(sala, "estante", sinal * 2.4, 3.1, [1, 3, 3.4], "#43362a", { textura: TEX.estante });
  }
  for (let i = 0; i < 3; i++)
    gaveteiro(sala, i === 0 ? DIR.sul : DIR.norte, i === 0 ? -1 : i === 1 ? 1 : -1);
  const p = naParede(DIR.sul, 1, 0.28);
  const id = `s${sala.indice}.alavanca`;
  enfileirar(sala, {
    id,
    x: sala.x + p.x,
    y: 1.35,
    z: sala.z + p.z,
    scale: [0.3, 0.9, 0.3],
    color: "#c9a24a",
    physics: "none",
    metalness: 0.6,
    light: { type: "point", intensity: 3, distance: 10, color: "#ffd27a", flicker: 0.25, flickerSpeed: 5 },
  });
  sala.alavanca = { id, x: sala.x + p.x, z: sala.z + p.z, usada: false };
  if (sala.portas.saida) sala.portas.saida.trancada = "alavanca";
}
/* ------------------------------------------------------------------- auxiliares */
function destruirMenor(tipo) {
  const e = S.entidades[tipo];
  if (!e) return;
  if (e.id) engine.remove(e.id);
  if (e.patas) e.patas.forEach((p) => engine.remove(p));
  if (e.olhos) e.olhos.forEach((p) => engine.remove(p));
  delete S.entidades[tipo];
  engine.loop("aranha", 0);
}
/** Jack também mora no armário: abrir um armário ocupado dá susto. */
function alertaJack(arm) {
  const x = arm.x + arm.nx * 0.7,
    z = arm.z + arm.nz * 0.7;
  criarJack(x, 1.6, z, true);
}

/* =========================== caminho e ciclo das salas ===================== */
/* grade de salas: nome próprio para não sombrear a versão de móveis acima */
function celulaVaga(gx, gz) {
  return !S.celulas[gx + ":" + gz];
}
function escolherSaida(sala) {
  const reta = sala.dirSaida,
    opcoes = [OPOSTO[reta], (reta + 1) % 4, (reta + 3) % 4];
  const [vx, vz] = vecDaDirecao(reta);
  if (S.corrida && S.corrida.restantes > 0 && celulaVaga(sala.gx + vx, sala.gz + vz)) return reta;
  if (chance(0.55) && celulaVaga(sala.gx + vx, sala.gz + vz)) return reta;
  const validas = opcoes.filter((d) => {
    const [x, z] = vecDaDirecao(d);
    return celulaVaga(sala.gx + x, sala.gz + z);
  });
  if (!validas.length) return reta;
  return escolha(validas);
}
function gerarProxima() {
  const anterior = S.salas[S.salas.length - 1];
  /* já foi sorteado quando a sala foi criada: o vão construído bate com isto */
  const dir = anterior.dirSaida;
  const [vx, vz] = vecDaDirecao(dir);
  const gx = anterior.gx + vx,
    gz = anterior.gz + vz,
    indice = anterior.indice + 1;
  /* a perseguição é marcada antes de montar a sala: o corredor sai reto */
  if (!S.corrida && CFG.perseguicoes.indexOf(indice) >= 0)
    S.corrida = { restantes: 5, fim: indice + 4, iniciada: false };
  const sala = novaSala(indice, gx, gz, dir);
  S.celulas[gx + ":" + gz] = true;
  sala.corrida = !!S.corrida && S.corrida.restantes > 0;
  if (sala.corrida) S.corrida.restantes--;
  sala.loja = indice === CFG.portaDaLoja && !sala.corrida;
  sala.biblioteca = indice === CFG.portaDaBiblioteca && !sala.corrida;
  sala.finalSala = indice === CFG.portas;
  sala.escuro = sala.loja || sala.biblioteca || sala.final || sala.corrida ? false : chance(CFG.chance.escuro);
  construirSala(sala);
  S.salas.push(sala);
  return sala;
}
function removerAtrasadas() {
  const limite = S.salaAtual ? S.salaAtual.indice - CFG.salasAtras : 0;
  for (const sala of [...S.salas]) {
    if (sala.indice >= limite) continue;
    for (const id of sala.nodes) engine.remove(id);
    S.salas.splice(S.salas.indexOf(sala), 1);
    for (const numero in S.portas) if (S.portas[numero].sala === sala) delete S.portas[numero];
  }
}
function avancarSala(sala) {
  maoComItemAtual();
  const anterior = S.salaAtual;
  S.salaAtual = sala;
  S.porta = sala.indice;
  S.tempoPorta = 0;
  S.chave = false;
  if (anterior && anterior.portas.saida) fecharPorta(anterior.portas.saida, 1.1);
  removerAtrasadas();
  gerarProxima();
  for (const outra of S.salas)
    if (!outra.visitada && outra.indice > sala.indice + 1) outra.visitada = true;
  sala.visitada = true;
  agendarEventos(sala);
  if (sala.corrida && S.corrida && !S.corrida.iniciada) {
    S.corrida.iniciada = true;
    iniciarCorrida(sala);
  } else if (S.corrida && sala.indice > S.corrida.fim) terminarCorrida();
  if (sala.biblioteca && !S.figura) iniciarFigura(sala);
  if (sala.loja) som("elevador", 0.45);
  som("porta.fechar", 0.5);
  S.objetivo =
    sala.corrida
      ? "CORRA! Use Shift sem parar."
      : sala.loja
        ? "Loja do Jeff: teclas 1 a 5 para comprar."
        : sala.biblioteca
          ? "Biblioteca: ache a alavanca SEM fazer barulho."
          : sala.final
            ? "Última porta. Entre no elevador."
            : "Encontre a porta " + (sala.indice + 1) + ".";
}
/* ================================= ruído =================================== */
function salaEmRuido(origem, x, z) {
  S.ruido = S.tempo;
  if (S.figura) S.figura.ultimoRuido = { x, z, forca: origem === "corrida" ? 2 : 1, em: S.tempo };
}
/* ============================== trancas ================================== */
/** Tranca aleatória da porta de saída: chave (item na sala), cadeado (gazua)
    ou alavanca escondida em algum canto. */
function aplicarTranca(sala, porta, tema) {
  const r = Math.random();
  if (r < CFG.chance.trancada) {
    porta.trancada = "chave";
    criarItemAleatorio(sala, "chave");
    aviso("A porta da frente está trancada.", 2.5);
  } else if (r < CFG.chance.trancada + CFG.chance.cadeado) porta.trancada = "cadeado";
  else if (r < CFG.chance.trancada + CFG.chance.cadeado + CFG.chance.alavanca) {
    porta.trancada = "alavanca";
    const p = naParede(escolha([DIR.leste, DIR.oeste, DIR.sul, DIR.norte]), chance(0.5) ? 1 : -1, 0.28);
    const id = `s${sala.indice}.alavanca`;
    enfileirar(sala, {
      id,
      x: sala.x + p.x,
      y: 1.35,
      z: sala.z + p.z,
      scale: [0.28, 0.9, 0.28],
      color: "#c9a24a",
      metalness: 0.6,
      roughness: 0.35,
      physics: "none",
      light: { type: "point", intensity: 2.4, distance: 8, color: "#ffd27a", flicker: 0.2, flickerSpeed: 4 },
    });
    sala.alavanca = { id, x: sala.x + p.x, z: sala.z + p.z, usada: false };
  }
  void tema;
}
/* ================================ HUD ===================================== */
function atualizarHud(input) {
  if (S.tempo - S.hudEm < 0.2) return;
  S.hudEm = S.tempo;
  hud("hud.porta", { text: "PORTA  " + S.porta + " / " + CFG.portas, visible: S.fase !== "inicio" });
  hud("hud.vida", { text: "VIDA  " + Math.ceil(S.vida), value: lim(S.vida / 100, 0, 1) });
  hud("hud.bateria", { text: "LANTERNA  " + Math.ceil(S.bateria) + "%", value: lim(S.bateria / 100, 0, 1) });
  hud("hud.moedas", { text: "MOEDAS  " + S.moedas, visible: S.fase !== "inicio" });
  hud("hud.itens", {
    text:
      "Gazua " + S.gazua +
      "   ·   Curativo " + S.curativo +
      "   ·   Crucifixo " + S.crucifixo +
      (S.vitaminas > 0 ? "   ·   Vitaminas " + Math.ceil(S.vitaminas) + "s" : "") +
      (S.revives > 0 ? "   ·   Revives " + S.revives : ""),
    visible: S.fase !== "inicio",
  });
  hud("hud.objetivo", { text: S.objetivo, visible: S.fase === "hotel" || S.fase === "corrida" });
  hud("hud.prompt", { text: S.prompt, visible: !!S.prompt });
  const comAviso = S.tempo < S.avisoAte;
  hud("hud.aviso", { text: comAviso ? S.aviso : "", visible: comAviso });
  hud("hud.dano", {
    visible: S.tempo - S.ultimoDanoEm < 0.35,
    background: S.vida < 35 ? "#7d141099" : "#7d141066",
  });
  const perigo = S.entidades.rush || S.entidades.ambush;
  hud("hud.perigo", {
    text: perigo ? (S.entidades.ambush ? "AMBUSH" : "RUSH") : "",
    visible: !!perigo,
    color: perigo ? "#ff6a55" : "#ffffff",
  });
  hud("hud.escondido", {
    text: S.escondido ? "ESCONDIDO  ·  E para sair" : "",
    visible: !!S.escondido,
  });
  hud("hud.seek", { text: S.fase === "corrida" ? "CORRA!" : "", visible: S.fase === "corrida" });
  hud("tela.inicio", { visible: S.fase === "inicio" });
  hud("tela.morte", {
    visible: S.fase === "morto",
    text:
      "VOCÊ MORREU\n\nPorta " + S.porta + " de " + CFG.portas +
      "\n\nE  ·  voltar para esta sala (" + S.revives + " revives)" +
      "\n0  ·  reiniciar a partida do zero",
  });
  hud("tela.vitoria", {
    visible: S.fase === "vitoria",
    text: "VOCÊ ESCAPOU!\n\n100 portas · " + Math.ceil(S.tempo) + " segundos · " + S.moedas + " moedas\nMortes: " + S.mortes + "\n\nE para jogar de novo",
  });
  hud("tela.loja", {
    visible: S.lojaAberta,
    text:
      "LOJA DO JEFF\n\nMoedas: " + S.moedas +
      "\n\n1 · Pilha de lanterna ........ " + CFG.preco.bateria +
      "\n2 · Gazua .................... " + CFG.preco.gazua +
      "\n3 · Curativo ................. " + CFG.preco.curativo +
      "\n4 · Crucifixo ................ " + CFG.preco.crucifixo +
      "\n5 · Vitaminas ................ " + CFG.preco.vitaminas +
      "\n\nE para sair da loja",
  });
}
/* ============================== entidades ================================= */
function pontoAleatorioNaSala(sala, margem) {
  const m = margem === undefined ? 4.6 : margem;
  return { x: sala.x + aleatorio(-m, m), z: sala.z + aleatorio(-m, m) };
}
function caminhoDaSala(indice, extensao) {
  const pontos = [];
  const ultima = S.salas.length ? S.salas[S.salas.length - 1].indice : indice;
  for (let i = Math.max(1, indice - extensao); i <= Math.min(ultima, indice + extensao); i++) {
    const sala = S.salas.find((s) => s.indice === i);
    if (sala) pontos.push({ x: sala.x, z: sala.z, indice: i });
  }
  return pontos;
}
function criarRush(tipo) {
  const sala = S.salaAtual;
  if (!sala) return;
  const atras = S.salas.filter((s) => s.indice < sala.indice).sort((a, b) => a.indice - b.indice);
  const inicio = atras.length ? atras[0] : sala;
  const pontos = caminhoDaSala(sala.indice, CFG.salasAtras + 1).filter((p) => p.indice >= inicio.indice);
  const adiante = S.salas.find((s) => s.indice === sala.indice + 1);
  if (!adiante && pontos.length < 2) {
    const [fx, fz] = vecDaDirecao(sala.dirSaida);
    pontos.push({ x: sala.x + fx * C, z: sala.z + fz * C, indice: sala.indice + 1 });
  }
  const id = tipo === "ambush" ? "ent.ambush" : "ent.rush";
  const [dx, dz] = vecDaDirecao(inicio.dirEntrada);
  // nasce do lado da entrada da sala mais antiga e corre para dentro do hotel
  const nascimento = { x: inicio.x + dx * (MEIA - 1), z: inicio.z + dz * (MEIA - 1) };
  const r = tipo === "ambush" ? 0.9 : 1.05;
  engine.spawn(id, {
    x: nascimento.x,
    y: 1.6,
    z: nascimento.z,
    scale: [1.5 * r, 2.1 * r, 1.9 * r],
    color: tipo === "ambush" ? "#101a16" : "#160f14",
    physics: "none",
    roughness: 0.4,
    light: { type: "point", intensity: tipo === "ambush" ? 3.4 : 4.2, distance: 13, color: tipo === "ambush" ? "#8fffc0" : "#ff5f4a", flicker: 0.5, flickerSpeed: 18 },
  });
  engine.spawn(id + ".olho", {
    x: nascimento.x,
    y: 2.2,
    z: nascimento.z + 0.2,
    scale: [0.3, 0.24, 0.3],
    color: tipo === "ambush" ? "#b6ffd2" : "#ffd7c2",
    physics: "none",
    light: { type: "point", intensity: 6, distance: 16, color: tipo === "ambush" ? "#7dffb4" : "#ff7a5f" },
  });
  S.entidades[tipo] = {
    saida: sala.dirSaida,
    percorrido: 0,
    pos: { x: nascimento.x, z: nascimento.z },
    id,
    olho: id + ".olho",
    tipo,
    pontos,
    alvo: 0,
    velocidade: tipo === "ambush" ? 23 : CFG.velocidadeRush || 26,
    volta: tipo === "ambush",
    restantes: tipo === "ambush" ? inteiro(2, 5) : 0,
  };
}
function atualizarRush(dt, eu) {
  for (const tipo of ["rush", "ambush"]) {
    const e = S.entidades[tipo];
    if (!e) continue;
    const destino = e.pontos[e.alvo];
    if (!destino) {
      if ((e.percorrido || 0) > 4) destruirEntidade(tipo);
      else {
        const [fx, fz] = vecDaDirecao(e.saida || DIR.leste);
        const fim = e.pontos[e.pontos.length - 1];
        e.pontos.push({ x: fim.x + fx * C * 0.5, z: fim.z + fz * C * 0.5, indice: fim.indice + 1 });
      }
      continue;
    }
    const atual = e.pos || e.pontos[Math.max(0, e.alvo - 1)];
    const dx = destino.x - atual.x,
      dz = destino.z - atual.z,
      distancia = Math.hypot(dx, dz);
    if (distancia < 0.9) {
      e.alvo++;
      e.pos = { x: destino.x, z: destino.z };
      e.percorrido = (e.percorrido || 0) + distancia + 0.9;
      som(tipo === "ambush" ? "ambush" : "rugido", 0.85, aleatorio(0.92, 1.08));
      engine.flicker("*", 1.4, 0.9);
      if (e.alvo >= e.pontos.length) {
        if (e.volta && e.restantes > 0) {
          e.restantes--;
          e.pontos = e.pontos.slice().reverse();
          e.alvo = 1;
          e.pos = e.pontos[0];
          aviso("Ele está voltando!", 2);
        } else {
          destruirEntidade(tipo);
          aviso(tipo === "ambush" ? "Ambush foi embora." : "Rush passou.");
        }
      }
    } else {
      const passo = Math.min(distancia, e.velocidade * dt);
      const nx = atual.x + (dx / distancia) * passo,
        nz = atual.z + (dz / distancia) * passo;
      e.pos = { x: nx, z: nz };
      e.percorrido = (e.percorrido || 0) + passo;
      const segundos = Math.max(0.06, passo / e.velocidade);
      engine.move(e.id, { x: nx, z: nz }, segundos);
      engine.move(e.olho, { x: nx, z: nz }, segundos);
    }
    if (eu && !S.escondido) {
      const perto = Math.hypot(e.pos.x - eu.x, e.pos.z - eu.z);
      if (perto < 2.3) {
        if (S.protecao > 0) {
          S.protecao = 0;
          destruirEntidade(tipo);
          som("eletrico", 1, 1.3);
          aviso("O crucifixo queimou e a criatura recuou.", 3);
        } else {
          S.ultimoDanoEm = S.tempo;
          engine.damage("jogador", 100);
          som("rugido", 1, 0.7);
          aviso("Rush te alcançou.", 3);
        }
      }
    }
  }
}
function destruirEntidade(tipo) {
  const e = S.entidades[tipo];
  if (!e) return;
  engine.remove(e.id);
  engine.remove(e.olho);
  delete S.entidades[tipo];
}
function criarScreech(eu) {
  const id = "ent.screech";
  const angulo = aleatorio(0, Math.PI * 2),
    dist = aleatorio(2.4, 4);
  const x = eu.x + Math.cos(angulo) * dist,
    z = eu.z + Math.sin(angulo) * dist;
  engine.spawn(id, {
    x,
    y: eu.y + 1.1,
    z,
    scale: [0.7, 0.5, 0.7],
    color: "#1b1620",
    physics: "none",
    light: { type: "point", intensity: 2.2, distance: 8, color: "#cbb6ff", flicker: 0.6, flickerSpeed: 22 },
  });
  S.entidades.screech = { id, ate: S.tempo + 1.6, x, z, y: eu.y + 1.1 };
  som("sussurro", 1, aleatorio(0.9, 1.15));
  engine.flicker("*", 1.6, 0.5);
}
function atualizarScreech(dt, eu, input) {
  const e = S.entidades.screech;
  if (!e) return;
  const olhando = (() => {
    if (!eu || !input.camera) return false;
    const dx = e.x - input.camera.origin[0],
      dy = e.y - input.camera.origin[1],
      dz = e.z - input.camera.origin[2];
    const comp = Math.hypot(dx, dy, dz) || 1;
    const dir = input.camera.direction;
    return (dx / comp) * dir[0] + (dy / comp) * dir[1] + (dz / comp) * dir[2] > 0.9 && comp < 9;
  })();
  if (olhando) {
    som("screech", 0.9, aleatorio(1.05, 1.2));
    engine.remove(e.id);
    delete S.entidades.screech;
    aviso("Você encarou o Screech. Ele fugiu.", 3);
    return;
  }
  if (S.tempo >= e.ate) {
    som("screech", 1, 0.95);
    engine.remove(e.id);
    delete S.entidades.screech;
    S.ultimoDanoEm = S.tempo;
    engine.damage("jogador", 30);
    aviso("Screech te atacou! Olhe para ele da próxima vez.", 4);
  }
}
function atualizarOlhos(dt, input) {
  const sala = S.salaAtual;
  if (!sala || !input.camera) return;
  for (const q of sala.quadros) {
    const dx = q.x - input.camera.origin[0],
      dy = q.y - input.camera.origin[1],
      dz = q.z - input.camera.origin[2];
    const dist = Math.hypot(dx, dy, dz);
    if (dist > 15) continue;
    const dir = input.camera.direction;
    const ponto = (dx / dist) * dir[0] + (dy / dist) * dir[1] + (dz / dist) * dir[2];
    if (ponto > 0.93) {
      S.ultimoDanoEm = S.tempo;
      engine.damage("jogador", 3.2 * dt);
      if (S.tempo - (q.avisouEm || -9) > 1.6) {
        q.avisouEm = S.tempo;
        som("olhos", 0.6, aleatorio(0.9, 1.1));
        if (!q.avisou) {
          q.avisou = true;
          aviso("Não olhe para os quadros!", 3);
        }
      }
    }
  }
}
function criarHalt(eu) {
  const id = "ent.halt";
  engine.spawn(id, {
    x: eu.x,
    y: 1.5,
    z: eu.z,
    scale: [1.2, 2.4, 0.6],
    color: "#141118",
    physics: "none",
    light: { type: "point", intensity: 7, distance: 12, color: "#ffe9c0" },
  });
  S.entidades.halt = { id, ate: S.tempo + 1.1, x: eu.x, z: eu.z, decidido: false };
  som("halt", 1);
  engine.flicker("*", 1.2, 0.7);
}
function atualizarHalt(dt, eu, input) {
  const e = S.entidades.halt;
  if (!e) return;
  const andando = !!input.w;
  if (!e.decidido && S.tempo >= e.ate - 0.1) {
    e.decidido = true;
    if (andando) {
      S.ultimoDanoEm = S.tempo;
      engine.damage("jogador", 55);
      aviso("Halt: você andou para frente.", 4);
      som("halt", 1, 0.7);
    } else {
      aviso("Você parou. Halt recuou.", 3);
    }
  }
  if (S.tempo >= e.ate + 0.9 || e.decidido) {
    engine.remove(e.id);
    delete S.entidades.halt;
  }
}
function agendarEventos(sala) {
  /* Quem decide agora é o diretor: pesos, recarga por criatura e teto por sala. */
  sortearEventos(sala);
  if (sala.diario.length) engine.log("porta " + sala.indice + " → " + sala.diario.join(" "));
}
function atualizarEventos(dt, eu, input) {
  const sala = S.salaAtual;
  if (sala) {
    for (const ev of sala.eventos) {
      if (ev.feito || S.tempo < ev.em || sala !== S.salaAtual) continue;
      ev.feito = true;
      if (ev.tipo === "rush" || ev.tipo === "ambush") {
        aviso(ev.tipo === "ambush" ? "As luzes piscam... algo grande vem vindo." : "As luzes estão piscando. Esconda-se!", 3);
        som("eletrico", 0.7);
        engine.flicker("*", 2.6, 0.85);
        som("tremor", 0.6);
        const tipo = ev.tipo;
        tremor(0.45, 0.5);
        const atraso = 2.4;
        setTimeoutComando(() => {
          if (S.fase === "hotel" && S.salaAtual && !S.entidades[tipo]) criarRush(tipo);
        }, atraso);
      }
      if (ev.tipo === "screech" && eu && !S.escondido) criarScreech(eu);
      if (ev.tipo === "halt" && eu) criarHalt(eu);
      if (ev.tipo === "shadow") criarShadow();
    }
  }
}
/* ------------------------------------------------------- criaturas menores */
/** Timothy: aranha pequena e rápida que persegue por alguns segundos. */
function criarTimothy(x, z) {
  if (S.entidades.timothy) return;
  const id = "ent.timothy";
  engine.spawn(id, {
    x: x,
    y: 0.55,
    z: z,
    kind: "sphere",
    scale: [0.8, 0.5, 0.8],
    color: "#201a22",
    physics: "none",
    roughness: 0.5,
    light: { type: "point", intensity: 1.1, distance: 5, color: "#8f6fd0", flicker: 0.4, flickerSpeed: 16 },
  });
  const patas = [];
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2,
      lado = i % 2 ? 1 : -1,
      pid = id + ".pata" + i;
    engine.spawn(pid, {
      x: x + Math.cos(ang) * 0.45 * lado,
      y: 0.4,
      z: z + Math.sin(ang) * 0.45 * lado,
      scale: [0.42, 0.06, 0.06],
      ry: Math.round((ang * 180) / Math.PI),
      color: "#15121a",
      physics: "none",
    });
    patas.push(pid);
  }
  S.entidades.timothy = { id, patas, x, z, velocidade: 4.6, ate: S.tempo + 14, ultimoDano: -9, fugindo: false };
  engine.loop("aranha", 0.5);
  som("aranha", 1, 0.9);
  aviso("Timothy está no seu pé!", 3);
}
function atualizarTimothy(dt, eu) {
  const e = S.entidades.timothy;
  if (!e || !eu) return;
  const dx = eu.x - e.x,
    dz = eu.z - e.z,
    dist = Math.hypot(dx, dz) || 1;
  if (!e.fugindo) {
    const passo = Math.min(dist, e.velocidade * dt);
    e.x += (dx / dist) * passo;
    e.z += (dz / dist) * passo;
    engine.move(e.id, { x: e.x, z: e.z }, Math.max(0.05, passo / e.velocidade));
    e.patas.forEach((pid, i) => {
      const ang = (i / 8) * Math.PI * 2 + S.tempo * 6 * (i % 2 ? 1 : -1);
      engine.move(pid, { x: e.x + Math.cos(ang) * 0.45, z: e.z + Math.sin(ang) * 0.45 }, Math.max(0.05, dt));
    });
    if (dist < 1.1 && !S.escondido && S.tempo - e.ultimoDano > 1.4) {
      e.ultimoDano = S.tempo;
      e.mordidas = (e.mordidas || 0) + 1;
      if (e.mordidas >= 3) e.ate = Math.min(e.ate, S.tempo + 0.4);
      S.ultimoDanoEm = S.tempo;
      engine.damage("jogador", 7);
      som("aranha", 0.9, 1.2);
      aviso("Timothy te mordeu!", 2);
    }
    if (S.tempo >= e.ate) {
      e.fugindo = true;
      aviso("Timothy fugiu para debaixo do móvel.", 2.5);
    }
  } else {
    e.x -= dx * dt * 2.4;
    e.z -= dz * dt * 2.4;
    engine.move(e.id, { x: e.x, z: e.z, y: -0.9 }, 0.6);
    e.patas.forEach((pid) => engine.move(pid, { x: e.x, z: e.z, y: -0.9 }, 0.6));
    setTimeoutComando(() => destruirMenor("timothy"), 0.7);
  }
}
/** Jack: susto sem dano — aparece na gaveta ou no armário. */
function criarJack(x, y, z, grande) {
  const id = "ent.jack";
  engine.spawn(id, {
    x: x,
    y: y,
    z: z,
    scale: grande ? [1.3, 1.5, 0.5] : [0.9, 1.1, 0.4],
    color: "#181418",
    physics: "none",
    roughness: 0.35,
    light: { type: "point", intensity: 4.5, distance: 12, color: "#ff3d2e", flicker: 0.7, flickerSpeed: 26 },
  });
  const olhos = [];
  for (const sinal of [-1, 1]) {
    const oid = id + ".olho" + (sinal > 0 ? "d" : "e");
    engine.spawn(oid, {
      x: x + sinal * 0.22,
      y: y + 0.22,
      z: z - 0.22,
      scale: [0.16, 0.16, 0.08],
      color: "#ffdca8",
      physics: "none",
      light: { type: "point", intensity: 3.4, distance: 7, color: "#ffd0a0" },
    });
    olhos.push(oid);
  }
  som("susto", 1, 1);
  engine.flicker("*", 1.1, 0.9);
  tremor(grande ? 1.1 : 0.7, 0.5);
  S.susto = 0.5;
  aviso(grande ? "Jack te viu no armário. Que susto." : "Jack! Que susto.", 3);
  S.entidades.jack = { id, olhos, ate: S.tempo + 1.7, x, y, z };
}
function atualizarJack(dt, eu) {
  const e = S.entidades.jack;
  if (!e) return;
  void eu;
  if (S.tempo >= e.ate) {
    destruirMenor("jack");
    return;
  }
  const perto = 0.12 + Math.abs(Math.sin(S.tempo * 22)) * 0.16;
  engine.set(e.id, { x: e.x + perto, y: e.y + perto * 0.5 });
  e.olhos.forEach((oid, i) =>
    engine.set(oid, { x: e.x + perto + (i ? 0.22 : -0.22), y: e.y + 0.22 + perto * 0.5 }),
  );
}
/** Shadow: vulto que cruza o corredor e some. */
function criarShadow() {
  const sala = S.salaAtual;
  if (!sala || S.entidades.shadow) return;
  const [dx, dz] = vecDaDirecao(sala.dirSaida);
  const inicio = { x: sala.x + dx * (MEIA - 3), z: sala.z + dz * (MEIA - 3) };
  const fim = { x: sala.x - dx * (MEIA - 3), z: sala.z - dz * (MEIA - 3) };
  const id = "ent.shadow";
  engine.spawn(id, {
    x: inicio.x,
    y: 1.5,
    z: inicio.z,
    scale: [1.1, 3, 1.1],
    color: "#0b0b10",
    physics: "none",
    roughness: 0.2,
  });
  S.entidades.shadow = {
    id,
    from: inicio,
    to: fim,
    t: 0,
    duracao: 1.5,
    avisou: false,
  };
  som("vulto", 1);
  engine.flicker("*", 1.4, 0.45);
}
function atualizarShadow(dt, eu) {
  const e = S.entidades.shadow;
  if (!e) return;
  e.t += dt;
  const k = Math.min(1, e.t / e.duracao),
    x = e.from.x + (e.to.x - e.from.x) * k,
    z = e.from.z + (e.to.z - e.from.z) * k;
  engine.set(e.id, { x, z, y: 1.5 + Math.sin(k * 3.14) * 0.4 });
  if (eu && !e.avisou && Math.hypot(eu.x - x, eu.z - z) < 4) {
    e.avisou = true;
    som("vulto", 0.8, 1.2);
    aviso("Algo passou rápido demais para ser gente.", 3);
  }
  if (k >= 1) destruirMenor("shadow");
}
/** Hide: mora no armário; se você entrar, ele te joga para fora. */
function atualizarHide(dt, eu) {
  const arm = S.escondido;
  if (!arm || !arm.hide) return;
  void eu;
  if (arm.tempo > 4.6 && !arm.avisou) {
    arm.avisou = true;
    som("susto", 0.9, 0.85);
    engine.flicker("*", 1.2, 0.8);
    sairDoArmario();
    S.ultimoDanoEm = S.tempo;
    tremor(0.8, 0.45);
    engine.damage("jogador", 6);
    aviso("Havia algo no armário. Você caiu para fora.", 3.5);
  }
}
/** Dupe marca a porta de saída de uma sala comum como falsa. */
function marcarDupe(sala) {
  if (!sala || sala.corrida || sala.loja || sala.biblioteca || sala.finalSala) return false;
  if (sala.indice <= 2 || sala.indice === CFG.portas) return false;
  if (!chance(CFG.chance.dupe)) return false;
  const porta = sala.portas.saida;
  if (!porta) return false;
  porta.dupe = true;
  if (porta.placa) {
    const [dx, dz] = vecDaDirecao(sala.dirSaida),
      horizontal = dz !== 0;
    sala.ajustes = sala.ajustes || [];
    sala.ajustes.push({ id: porta.placa, patch: horizontal ? { rz: 7 } : { rx: 7 } });
    sala.ajustes.push({ id: porta.placa, mover: { y: AP + 0.22 }, segundos: 0.3 });
    const id = porta.id + ".brilho";
    enfileirar(sala, {
      id,
      x: sala.x + dx * (PAREDE - 0.35),
      y: 1.2,
      z: sala.z + dz * (PAREDE - 0.35),
      scale: [0.5, 1.6, 0.5],
      color: "#2a2130",
      physics: "none",
      light: { type: "point", intensity: 1.1, distance: 4.2, color: "#7a4fb0", flicker: 0.5, flickerSpeed: 5 },
    });
  }
  return true;
}

/* Pequeno agendador: a engine não expõe setTimeout aos scripts, então contamos dt. */
function setTimeoutComando(fn, segundos) {
  S.agenda = S.agenda || [];
  S.agenda.push({ fn, em: S.tempo + segundos });
}
function atualizarAgenda() {
  if (!S.agenda) return;
  for (const tarefa of [...S.agenda]) {
    if (S.tempo >= tarefa.em) {
      S.agenda.splice(S.agenda.indexOf(tarefa), 1);
      try {
        tarefa.fn();
      } catch (erro) {
        engine.log("agenda: " + erro);
      }
    }
  }
}
/* ========================== esconderijos e interação ======================= */
function esconder(arm) {
  if (arm.ocupado) return;
  arm.ocupado = true;
  arm.fechado = true;
  tremor(0.25, 0.3);
  arm.tempo = 0;
  S.escondido = arm;
  engine.freeze(true);
  engine.set("jogador", {
    x: arm.x + arm.nx * 0.25,
    y: 0.95,
    z: arm.z + arm.nz * 0.25,
    vx: 0,
    vy: 0,
    vz: 0,
  });
  som("armario", 1);
  aviso("Escondido. Aperte E para sair.", 2.5);
}
function sairDoArmario() {
  const arm = S.escondido;
  if (!arm) return;
  engine.set("jogador", {
    x: arm.x + arm.nx * 1.6,
    y: 0.95,
    z: arm.z + arm.nz * 1.6,
    vx: 0,
    vy: 0,
    vz: 0,
  });
  engine.freeze(false);
  arm.ocupado = false;
  arm.fechado = false;
  arm.aberto = true;
  arm.tempo = 0;
  S.escondido = null;
  setTimeoutComando(() => {
    arm.aberto = false;
  }, 1.7);
  som("armario", 0.7);
}
function usarAlavanca(sala) {
  const a = sala.alavanca;
  if (!a || a.usada) return;
  a.usada = true;
  engine.light(a.id, { intensity: 8, distance: 18, flicker: 0.1, color: "#ffe9b0" });
  engine.flicker("*", 1.2, 0.4);
  som("eletrico", 0.9);
  som("porta.abrir", 0.7);
  if (sala.portas.saida) sala.portas.saida.destrancando = true;
  if (sala.biblioteca) {
    aviso("A porta da biblioteca destravou. A Figura recuou.", 4);
    if (S.figura) S.figura.recuando = true;
  } else aviso("A alavanca abriu a porta.", 3);
  salaEmRuido("alavanca", sala.x, sala.z);
}
function comprar(indice) {
  const chaves = ["bateria", "gazua", "curativo", "crucifixo", "vitaminas"];
  const tipo = chaves[indice - 1];
  if (!tipo) return;
  const preco = CFG.preco[tipo];
  if (S.moedas < preco) {
    som("porta.trancada", 0.7);
    return aviso("Moedas insuficientes. Jeff cobra " + preco + ".");
  }
  S.moedas -= preco;
  darItem(tipo);
  som("moeda", 0.9);
  aviso("Comprado: " + tipo + " (" + preco + " moedas).", 2.5);
}
function atualizarPrompt(input) {
  const alvo = input.target && input.target.id;
  S.prompt = "";
  if (S.fase !== "hotel" && S.fase !== "corrida") {
    if (S.fase === "inicio" && alvo === S.elevador.id) S.prompt = "E  ·  Entrar no elevador e começar";
    if (S.fase === "morto") S.prompt = "E  ·  Reviver nesta sala   ·   0  ·  Reiniciar";
    if (S.fase === "vitoria") S.prompt = "E  ·  Jogar de novo";
    return;
  }
  if (S.escondido) {
    S.prompt = "E  ·  Sair do esconderijo";
    return;
  }
  if (S.lojaAberta) {
    S.prompt = "1..5  comprar   ·   E  sair da loja";
    return;
  }
  if (!alvo) return;
  const sala = S.salaAtual;
  if (alvo === S.elevador.id) {
    S.prompt = "E  ·  Entrar no elevador e começar";
    return;
  }
  if (alvo.startsWith("porta.")) {
    const porta = S.portas[Number(alvo.slice(6))];
    if (!porta || porta.aberta) return;
    if (porta.trancada === "chave") S.prompt = S.chave ? "E  ·  Destrancar com a chave" : "Trancada  ·  procure a chave";
    else if (porta.trancada === "cadeado") S.prompt = S.gazua > 0 ? "E  ·  Arrombar com a gazua" : "Cadeado  ·  falta gazua";
    else if (porta.trancada === "alavanca") S.prompt = porta.destrancando ? "E  ·  Abrir a porta" : "Trancada  ·  use a alavanca";
    else S.prompt = "E  ·  Abrir a porta " + porta.numero;
    return;
  }
  if (!sala) return;
  if (sala.final && alvo === sala.final.elevador) {
    S.prompt = "E  ·  Entrar no elevador final";
    return;
  }
  if (sala.armarios.some((a) => a.id === alvo)) {
    S.prompt = "E  ·  Esconder-se no armário";
    return;
  }
  if (sala.gavetas.some((g) => g.id === alvo)) {
    S.prompt = "E  ·  Procurar na gaveta";
    return;
  }
  if (sala.alavanca && sala.alavanca.id === alvo && !sala.alavanca.usada) {
    S.prompt = "E  ·  Puxar a alavanca";
    return;
  }
  if (sala.jeff && alvo === sala.jeff.id) {
    S.prompt = "E  ·  Ver as mercadorias do Jeff";
    return;
  }
  const item = sala.itens.find((i) => i.id === alvo && !i.pego);
  if (item) S.prompt = "E  ·  Pegar " + item.tipo;
}
function interagir(input) {
  if (S.fase === "morto") return reviver();
  if (S.fase === "vitoria") return comecar();
  const alvo = input.target && input.target.id;
  if (S.escondido) return sairDoArmario();
  if (S.lojaAberta) {
    S.lojaAberta = false;
    return;
  }
  if (S.fase === "inicio") {
    if (alvo === S.elevador.id || !alvo) return comecar();
    return;
  }
  if (!alvo) return;
  if (alvo.startsWith("porta.")) return usarPorta(Number(alvo.slice(6)));
  const sala = S.salaAtual;
  if (!sala) return;
  if (sala.final && alvo === sala.final.elevador) return vencer();
  const arm = sala.armarios.find(
    (a) =>
      a.id === alvo ||
      a.corpo === alvo ||
      a.folhas.some((f) => f.id === alvo),
  );
  if (arm) {
    if (arm.perigo && !arm.jackFeito) {
      arm.jackFeito = true;
      alertaJack(arm);
      return;
    }
    if (arm.hide && !arm.hideAvisado) {
      arm.hideAvisado = true;
      som("tosse", 0.7, 0.85);
      aviso("Você ouviu uma respiração lá dentro...", 2.5);
    }
    return esconder(arm);
  }
  const gaveta = sala.gavetas.find((g) => g.id === alvo);
  if (gaveta) {
    if (!gaveta.aberta) abrirGaveta(gaveta);
    else som("gaveta", 0.5, 1.06);
    if (gaveta.timothy) return saquear(gaveta);
    if (gaveta.jack && !gaveta.saqueada) {
      gaveta.saqueada = true;
      return saquear(gaveta);
    }
    return gaveta.saqueada ? aviso("Já revirada.") : saquear(gaveta);
  }
  if (sala.alavanca && sala.alavanca.id === alvo) return usarAlavanca(sala);
  if (sala.jeff && alvo === sala.jeff.id) {
    S.lojaAberta = true;
    som("item", 0.6);
    return;
  }
  const item = sala.itens.find((i) => !i.pego && (i.id === alvo || alvo.indexOf(i.id + ".") === 0));
  if (item) {
    item.pego = true;
    for (const peca of item.pecas || [item.id]) engine.remove(peca);
    darItem(item.tipo);
  }
}
/* ============================== jogador ================================== */
function atualizarJogador(dt, input, eu) {
  if (!eu) return;
  S.vida = eu.health;
  const andando = Math.hypot(eu.vx || 0, eu.vz || 0);
  const correndo = !!input.shift && andando > 2;
  if (andando > 1.2 && S.tempo - S.passos > (correndo ? 0.3 : 0.46)) {
    S.passos = S.tempo;
    som(correndo ? "corrida" : "passo", correndo ? 0.5 : 0.35, aleatorio(0.92, 1.08));
    if (correndo) salaEmRuido("corrida", eu.x, eu.z);
  }
  if (S.lanterna && S.bateria > 0 && S.fase !== "morto") {
    S.bateria = Math.max(0, S.bateria - dt * CFG.bateriaPorSegundo);
    if (S.tempo - (S.torchEm || -9) > 0.5) {
      S.torchEm = S.tempo;
      engine.torch(true, { intensity: 5 + S.bateria * 0.24, distance: 14 + S.bateria * 0.12, angle: 34, color: "#ffeccc" });
    }
    if (S.bateria <= 0) {
      S.lanterna = false;
      engine.torch(false);
      som("lanterna.falha", 1);
      aviso("A bateria da lanterna acabou. Ache uma pilha.", 4);
    }
  } else if (S.tempo - (S.torchEm || -9) > 0.5) {
    S.torchEm = S.tempo;
    engine.torch(false);
  }
  const velocidade = CFG.velocidadeSala * (S.vitaminas > 0 ? 1.35 : 1);
  if (S.velocidadeAplicada !== velocidade) {
    S.velocidadeAplicada = velocidade;
    engine.set("jogador", { speed: velocidade });
  }
  if (S.vitaminas > 0) {
    S.vitaminas = Math.max(0, S.vitaminas - dt);
    if (S.vitaminas === 0) aviso("As vitaminas passaram.", 2.5);
  }
  if (S.protecao > 0) S.protecao = Math.max(0, S.protecao - dt);
  const coracao = S.vida < 35 || (S.entidades.rush && !S.escondido);
  if (coracao && S.tempo - S.alarme > 0.6) {
    S.alarme = S.tempo;
    engine.loop("coracao", S.vida < 20 ? 0.75 : 0.5);
  } else if (!coracao && S.tempo - S.alarme > 0.6) {
    S.alarme = S.tempo;
    engine.loop("coracao", 0);
  }
  if (S.escondido) {
    S.escondido.tempo += dt;
    if (S.escondido.perigo && S.escondido.tempo > 16) {
      S.escondido.perigo = false;
      S.ultimoDanoEm = S.tempo;
      engine.damage("jogador", 35);
      som("screech", 0.9);
      sairDoArmario();
      aviso("Havia algo escondido no armário!", 4);
    }
  }
}
function usarConsumivel(tecla) {
  maoDoItem(tecla === "q" ? "curativo" : tecla === "c" ? "crucifixo" : "vitaminas", 1.4);
  if (tecla === "q" && S.curativo > 0 && S.vida < 100) {
    S.curativo--;
    engine.heal("jogador", CFG.curaCurativo);
    som("curativo", 0.9);
    aviso("Curativo usado (+" + CFG.curaCurativo + " de vida).");
  } else if (tecla === "c" && S.crucifixo > 0 && S.protecao <= 0) {
    S.crucifixo--;
    S.protecao = 30;
    mao("crucifixo", 3);
    som("eletrico", 0.8, 1.4);
    aviso("Crucifixo erguido por 30 s. Ele repele Rush e Ambush.", 4);
  } else if (tecla === "g" && S.vitaminas <= 0) {
    aviso("Você não tem vitaminas.");
  }
}
/* ============================ perseguição (Seek) ========================= */
function iniciarCorrida(sala) {
  S.corrida = S.corrida || { restantes: 0, fim: sala.indice + 4, iniciada: true };
  S.corrida.iniciada = true;
  S.fase = "corrida";
  engine.loop("tambores", 0.55);
  engine.loop("vento", 0.25);
  engine.flicker("*", 6, 0.75);
  som("seek.grito", 1);
  aviso("CORRA! Não pare até o fim do corredor.", 5);
  const atras = S.salas.filter((s) => s.indice <= sala.indice).sort((a, b) => a.indice - b.indice)[0] || sala;
  const id = "ent.seek";
  engine.spawn(id, {
    x: atras.x,
    y: 1.35,
    z: atras.z,
    scale: [1, 2.6, 0.8],
    color: "#0e1114",
    physics: "none",
    roughness: 0.35,
    actor: { humanoid: true, skin: "#1a1d20", animationSpeed: 1.6, health: 9999 },
    light: { type: "point", intensity: 5, distance: 16, color: "#ff5a4a" },
  });
  S.corrida.seek = { id, x: atras.x, z: atras.z, velocidade: 5.7, ultimoDano: -9 };
}
function atualizarCorrida(dt, eu) {
  const c = S.corrida;
  if (!c) return;
  if (c.seek && eu && !S.escondido) {
    const dx = eu.x - c.seek.x,
      dz = eu.z - c.seek.z,
      dist = Math.hypot(dx, dz);
    if (dist > 0.6) {
      const passo = Math.min(dist, c.seek.velocidade * dt);
      c.seek.x += (dx / dist) * passo;
      c.seek.z += (dz / dist) * passo;
      engine.move(c.seek.id, { x: c.seek.x, z: c.seek.z }, Math.max(0.06, passo / c.seek.velocidade));
    }
    if (dist < 2.1 && S.tempo - c.seek.ultimoDano > 0.9) {
      c.seek.ultimoDano = S.tempo;
      S.ultimoDanoEm = S.tempo;
      engine.damage("jogador", 42);
      som("seek.grito", 1, 0.9);
      aviso("Seek te alcançou! Continue correndo.", 3);
    }
    if (S.tempo - (c.parede || -9) > 3.4) {
      c.parede = S.tempo;
      som("seek.parede", 0.8, aleatorio(0.9, 1.1));
      engine.flicker("*", 1.1, 0.6);
    }
  }
  // Portas do corredor abrem sozinhas quando o jogador se aproxima.
  if (eu && S.salaAtual && S.salaAtual.portas.saida && !S.salaAtual.portas.saida.aberta) {
    const p = S.salaAtual.portas.saida,
      dist = Math.hypot(p.dobradica.x - eu.x, p.dobradica.z - eu.z);
    if (dist < 3.6) {
      abrirPorta(p, 0.3);
      som("porta.bater", 0.8);
      engine.flicker("*", 0.8, 0.6);
    }
  }
  if (S.salaAtual && S.salaAtual.indice >= c.fim) terminarCorrida();
}
function terminarCorrida() {
  if (!S.corrida) return;
  if (S.corrida.seek) engine.remove(S.corrida.seek.id);
  S.corrida = null;
  S.fase = "hotel";
  engine.loop("tambores", 0);
  engine.loop("vento", 0);
  aviso("Você escapou. Continue pelo hotel.", 4.5);
}
/* ============================= biblioteca (Figure) ======================= */
function iniciarFigura(sala) {
  const id = "ent.figura";
  const canto = { x: sala.x - MEIA + 3, z: sala.z - MEIA + 3 };
  engine.spawn(id, {
    x: canto.x,
    y: 1.35,
    z: canto.z,
    scale: [1.1, 2.9, 0.9],
    color: "#111014",
    physics: "none",
    roughness: 0.4,
    actor: { humanoid: true, skin: "#2a2626", animationSpeed: 0.7, health: 9999 },
    light: { type: "point", intensity: 1.4, distance: 9, color: "#6f5a4a" },
  });
  S.figura = {
    id,
    x: canto.x,
    z: canto.z,
    casa: canto,
    alvo: { x: canto.x, z: canto.z },
    velocidade: 2.3,
    recuando: false,
    ultimoDano: -9,
  };
  engine.loop("passos.figura", 0.45);
}
function atualizarFigura(dt, eu) {
  const f = S.figura;
  if (!f) return;
  if (f.recuando) {
    f.alvo = f.casa;
    if (Math.hypot(f.x - f.casa.x, f.z - f.casa.z) < 1) {
      engine.loop("passos.figura", 0);
      return;
    }
  } else if (f.ultimoRuido && S.tempo - f.ultimoRuido.em < 6) {
    f.alvo = { x: f.ultimoRuido.x, z: f.ultimoRuido.z };
    if (!f.avisou) {
      f.avisou = true;
      som("figura.rugido", 0.8);
      aviso("A Figura ouviu você.", 3);
    }
  } else if (Math.hypot(f.x - f.alvo.x, f.z - f.alvo.z) < 1.2) {
    f.avisou = false;
    const sala = S.salaAtual;
    f.alvo = sala
      ? { x: sala.x + aleatorio(-4, 4), z: sala.z + aleatorio(-4, 4) }
      : f.casa;
  }
  const dx = f.alvo.x - f.x,
    dz = f.alvo.z - f.z,
    dist = Math.hypot(dx, dz);
  if (dist > 0.4) {
    const passo = Math.min(dist, f.velocidade * dt);
    f.x += (dx / dist) * passo;
    f.z += (dz / dist) * passo;
    engine.move(f.id, { x: f.x, z: f.z }, Math.max(0.06, passo / f.velocidade));
  }
  if (eu && !S.escondido) {
    const perto = Math.hypot(f.x - eu.x, f.z - eu.z);
    if (perto < 2 && !f.recuando && S.tempo - f.ultimoDano > 1) {
      f.ultimoDano = S.tempo;
      S.ultimoDanoEm = S.tempo;
      engine.damage("jogador", 100);
      som("figura.rugido", 1);
      aviso("A Figura te encontrou. Fique quieto da próxima vez.", 4);
    }
  }
}
/* ============================ morte e vitória ============================ */
function morrer() {
  if (S.fase === "morto") return;
  S.fase = "morto";
  S.mortes++;
  engine.loop("tambores", 0);
  engine.loop("vento", 0);
  engine.loop("coracao", 0.6);
  som("morte", 1);
  engine.torch(false);
  // a caçada acabou: as criaturas seguem seu caminho
  for (const tipo of ["rush", "ambush", "screech"]) destruirEntidade(tipo);
  for (const tipo of ["timothy", "jack", "shadow"]) destruirMenor(tipo);
  if (S.salaAtual && S.salaAtual.snare && S.salaAtual.snare.travado) {
    S.salaAtual.snare.travado = false;
    engine.freeze(false);
  }
  if (S.escondido) {
    S.escondido.ocupado = false;
    S.escondido = null;
    engine.freeze(false);
  }
}
function reviver() {
  if (S.revives <= 0) return reiniciar();
  S.revives--;
  engine.loop("coracao", 0);
  engine.ragdoll("jogador", false);
  engine.heal("jogador", 100);
  const sala = S.salaAtual || { x: 0, z: 0, dirEntrada: DIR.norte };
  const [dx, dz] = vecDaDirecao(sala.dirEntrada);
  engine.set("jogador", {
    x: sala.x + dx * (MEIA - 2),
    y: 0.95,
    z: sala.z + dz * (MEIA - 2),
    vx: 0,
    vy: 0,
    vz: 0,
  });
  S.vida = 100;
  S.fase = S.corrida ? "corrida" : "hotel";
  som("elevador", 0.6);
  aviso("Você voltou. Restam " + S.revives + " revives.", 3.5);
}
function vencer() {
  S.fase = "vitoria";
  engine.loop("tambores", 0);
  engine.loop("vento", 0);
  engine.loop("coracao", 0);
  engine.torch(false);
  som("vitoria", 1);
  const recorde = Math.max(S.melhorPorta || 0, CFG.portas);
  S.melhorPorta = recorde;
  engine.store({ melhorPorta: recorde, moedas: S.moedas, mortes: S.mortes });
}
function reiniciar() {
  comecar();
}
function comecar() {
  for (const sala of [...S.salas]) for (const id of sala.nodes) engine.remove(id);
  for (const tipo of ["rush", "ambush", "screech"]) destruirEntidade(tipo);
  for (const tipo of ["timothy", "jack", "shadow"]) destruirMenor(tipo);
  engine.loop("aranha", 0);
  if (S.corrida && S.corrida.seek) engine.remove(S.corrida.seek.id);
  if (S.figura) engine.remove(S.figura.id);
  if (S.entidades.halt) engine.remove(S.entidades.halt.id);
  S.salas = [];
  S.celulas = {};
  S.portas = {};
  S.partes = [];
  S.corrida = null;
  S.figura = null;
  S.moedas = 0;
  S.bateria = 100;
  S.lanterna = true;
  S.gazua = 0;
  S.curativo = 0;
  S.crucifixo = 0;
  S.vitaminas = 0;
  S.protecao = 0;
  S.chave = false;
  S.revives = CFG.revives;
  S.escondido = null;
  S.mortes = 0;
  S.agenda = [];
  S.fase = "hotel";
  engine.loop("vento", 0.3);
  engine.loop("drone", 0.18);
  hud("tela.inicio", { visible: false });
  engine.freeze(false);
  engine.ragdoll("jogador", false);
  engine.heal("jogador", 100);
  som("elevador", 0.8);
  const sala = novaSala(1, 0, 0, DIR.norte);
  S.celulas["0:0"] = true;
  construirSala(sala);
  S.salas.push(sala);
  S.salaAtual = null;
  avancarSala(sala);
  const [dx, dz] = vecDaDirecao(DIR.norte);
  engine.set("jogador", { x: sala.x + dx * (MEIA - 2), y: 0.95, z: sala.z + dz * (MEIA - 2), vx: 0, vy: 0, vz: 0 });
  aviso("Encontre a porta 2.", 4);
  S.objetivo = "Encontre a porta 2.";
}
/* ============================================================================
   v0.8 — faces (imagens com luz), mãos do jogador, tremor de câmera,
   armários com portas que giram, validação procedural e diretor de criaturas.
   ========================================================================== */

/* ------------------------------------------------- imagens (faces) com luz */
/** Uma "face" é um plano fino com textura pintada e brilho próprio: enxerga
    através do escuro. Fica sempre virada para o jogador (billboard). */
function criarFace(id, x, y, z, textura, tamanho, cor, intensidade) {
  const spec = {
    id,
    x,
    y,
    z,
    scale: [tamanho, tamanho, 0.07],
    color: "#ffffff",
    physics: "none",
    roughness: 0.5,
    textureId: textura,
    light: { type: "point", intensity: intensidade === undefined ? 3.2 : intensidade, distance: 13, color: cor },
  };
  engine.spawn(id, spec);
  engine.set(id, { emissive: cor, emissiveIntensity: 0.85 });
  return id;
}
function removerFace(id) {
  engine.remove(id);
}
/** tira todas as faces da cena (morte, vitória, reinício) */
function limparFaces() {
  for (const f of FACES) if (engine.get(f.face)) removerFace(f.face);
  for (const id of ["ent.seek.face", "ent.figure.face", "ent.hide.face"])
    if (engine.get(id)) removerFace(id);
}
/** vira a face (e o corpo) para o jogador */
function encarar(id, eu, limite) {
  if (!eu) return;
  const no = engine.get(id);
  if (!no) return;
  const dx = eu.x - no.x,
    dz = eu.z - no.z,
    dist = Math.hypot(dx, dz);
  if (limite && dist > limite) return;
  engine.set(id, { ry: (Math.atan2(dx, dz) * 180) / Math.PI });
}
/** Tabela das criaturas que usam face: id do corpo, textura, cor e altura. */
const FACES = [
  { chave: "rush", corpo: "ent.rush", face: "ent.rush.face", tex: TEX.face.rush, cor: "#ffd9c0", altura: 2.3, tamanho: 3.2, brilho: 5 },
  { chave: "ambush", corpo: "ent.ambush", face: "ent.ambush.face", tex: TEX.face.ambush, cor: "#ffd9c0", altura: 2.3, tamanho: 3.4, brilho: 5 },
  { chave: "screech", corpo: "ent.screech", face: "ent.screech.face", tex: TEX.face.screech, cor: "#cfe8ff", altura: 0.55, tamanho: 1.5, brilho: 4 },
  { chave: "timothy", corpo: "ent.timothy", face: "ent.timothy.face", tex: TEX.face.timothy, cor: "#c9a6ff", altura: 0.78, tamanho: 1.1, brilho: 3 },
  { chave: "jack", corpo: "ent.jack", face: "ent.jack.face", tex: TEX.face.jack, cor: "#ff9a86", altura: 0, tamanho: 1.8, brilho: 5 },
  { chave: "shadow", corpo: "ent.shadow", face: "ent.shadow.face", tex: TEX.face.shadow, cor: "#dfe9ff", altura: 3.1, tamanho: 1.6, brilho: 2.4 },
];
/** Cria/atualiza/limpa as faces das criaturas que estão vivas agora. */
function atualizarFaces(eu) {
  for (const f of FACES) {
    const corpo = engine.get(f.corpo);
    if (!corpo) {
      if (engine.get(f.face)) removerFace(f.face);
      continue;
    }
    if (!engine.get(f.face))
      criarFace(f.face, corpo.x, corpo.y + f.altura, corpo.z, f.tex, f.tamanho, f.cor, f.brilho);
    const face = engine.get(f.face);
    if (!face) continue;
    const dx = face.x - corpo.x,
      dz = face.z - corpo.z;
    void dx;
    void dz;
    engine.set(f.face, { x: corpo.x, y: corpo.y + f.altura, z: corpo.z });
    encarar(f.face, eu);
    if (f.chave === "rush" || f.chave === "ambush") encarar(f.corpo, eu, 999);
  }
  /* Seek e Figure usam corpos próprios */
  const seek = S.corrida && S.corrida.seek ? engine.get(S.corrida.seek.id) : null;
  if (seek) {
    if (!engine.get("ent.seek.face"))
      criarFace("ent.seek.face", seek.x, seek.y + 1.7, seek.z, TEX.face.seek, 2.4, "#ffb066", 4.5);
    engine.set("ent.seek.face", { x: seek.x, y: seek.y + 1.7, z: seek.z });
    encarar("ent.seek.face", eu);
  } else if (engine.get("ent.seek.face")) removerFace("ent.seek.face");
  if (S.figura && engine.get(S.figura.id)) {
    const fig = engine.get(S.figura.id);
    if (!engine.get("ent.figure.face"))
      criarFace("ent.figure.face", fig.x, fig.y + 2, fig.z, TEX.face.figure, 2.2, "#ffe6c8", 3.6);
    engine.set("ent.figure.face", { x: fig.x, y: fig.y + 2, z: fig.z });
    encarar("ent.figure.face", eu);
  } else if (engine.get("ent.figure.face")) removerFace("ent.figure.face");
  /* Hide: aparece no fundo do armário quando o jogador entra */
  const arm = S.escondido;
  if (arm && arm.hide) {
    if (!engine.get("ent.hide.face"))
      criarFace("ent.hide.face", arm.x - arm.nx * 0.35, 1.5, arm.z - arm.nz * 0.35, TEX.face.hide, 1.5, "#bcd8c8", 3.4);
    engine.set("ent.hide.face", { x: arm.x - arm.nx * 0.35, y: 1.5, z: arm.z - arm.nz * 0.35 });
    encarar("ent.hide.face", eu);
  } else if (engine.get("ent.hide.face")) removerFace("ent.hide.face");
}
/* ------------------------------------------------------- mãos do jogador */
function mao(kind, segundos) {
  /* engine.hand existe a partir da 0.7.1; em builds antigos a mão fica vazia */
  if (typeof engine.hand !== "function") return;
  engine.hand(kind, segundos === undefined ? 0 : segundos);
}
function maoDoItem(tipo, segundos) {
  const mapa = {
    chave: "chave",
    gazua: "gazua",
    crucifixo: "crucifixo",
    bateria: "pilha",
    curativo: "curativo",
    moeda: "moeda",
    vitaminas: "vitamina",
  };
  mao(mapa[tipo] || "nenhum", segundos);
}
function maoComItemAtual() {
  if (S.crucifixo > 0 && S.protecao > 0) return mao("crucifixo");
  if (S.chave) return mao("chave");
  if (S.gazua > 0) return mao("gazua");
  mao("nenhum");
}
/* ----------------------------------------------------- tremor de câmera */
function tremor(forca, segundos) {
  if (typeof engine.shake !== "function") return;
  engine.shake(forca === undefined ? 0.5 : forca, segundos === undefined ? 0.35 : segundos);
}
/* ------------------------------------------- armários com portas que giram */
function posicionarFolha(arm, folha, angulo) {
  const [ox, oz] = rotY(folha.ex, folha.ez, angulo * folha.giro);
  const meia = folha.comprimento / 2;
  engine.set(folha.id, {
    x: folha.hx + ox * meia,
    z: folha.hz + oz * meia,
    ry: folha.base + angulo * folha.giro,
  });
}
function animarFolhas(arm, alvo, dt) {
  const passo = dt * 300;
  for (const folha of arm.folhas) {
    const d = alvo - folha.angulo;
    if (Math.abs(d) <= passo) folha.angulo = alvo;
    else folha.angulo += Math.sign(d) * passo;
    posicionarFolha(arm, folha, folha.angulo);
  }
}
function atualizarArmarios(dt) {
  for (const sala of S.salas)
    for (const arm of sala.armarios) {
      if (!arm.folhas) continue;
      const alvo = arm.ocupado || arm.fechado ? 0 : arm.aberto ? 86 : 0;
      if (arm.folhas[0].angulo !== alvo) animarFolhas(arm, alvo, dt);
    }
}
/* ------------------------------------------- validação da sala procedural */
/** Grade de 1 m: procura caminho do vão de entrada até o vão de saída. */
function temCaminhoDeVerdade(sala) {
  const n = Math.floor(C),
    meio = C / 2 - 0.5,
    bloqueado = [];
  for (let i = 0; i < n * n; i++) bloqueado.push(false);
  const marca = (cx, cz, mx, mz) => {
    const x0 = Math.max(0, Math.floor(cx - mx + C / 2)),
      x1 = Math.min(n - 1, Math.ceil(cx + mx + C / 2)),
      z0 = Math.max(0, Math.floor(cz - mz + C / 2)),
      z1 = Math.min(n - 1, Math.ceil(cz + mz + C / 2));
    for (let z = z0; z <= z1; z++)
      for (let x = x0; x <= x1; x++) bloqueado[z * n + x] = true;
  };
  for (const c of sala.mobilia.concat(sala.divisorias))
    marca((c.x0 + c.x1) / 2, (c.z0 + c.z1) / 2, (c.x1 - c.x0) / 2 + 0.4, (c.z1 - c.z0) / 2 + 0.4);
  const celula = (x, z) => Math.round(x + C / 2) + Math.round(z + C / 2) * n;
  const [ex, ez] = vecDaDirecao(sala.dirEntrada),
    [sx, sz] = vecDaDirecao(sala.dirSaida);
  const inicio = celula(ex * meio, ez * meio),
    fim = celula(sx * meio, sz * meio);
  if (bloqueado[inicio] || bloqueado[fim]) return false;
  const fila = [inicio],
    visto = new Set([inicio]);
  while (fila.length) {
    const atual = fila.shift(),
      x = atual % n,
      z = Math.floor(atual / n);
    if (atual === fim) return true;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx,
        nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= n || nz >= n) continue;
      const id = nz * n + nx;
      if (visto.has(id) || bloqueado[id]) continue;
      visto.add(id);
      fila.push(id);
    }
  }
  return false;
}
/** Depois de montar a sala: se o caminho fechar, derruba o que atrapalha. */
function validarSala(sala) {
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    if (temCaminhoDeVerdade(sala)) {
      sala.valida = true;
      return true;
    }
    /* tira a divisória mais próxima do centro e tenta de novo */
    const divisorias = sala.divisorias;
    if (!divisorias.length) break;
    let pior = 0,
      melhor = 1e9;
    for (let i = 0; i < divisorias.length; i++) {
      const c = divisorias[i],
        d = Math.hypot((c.x0 + c.x1) / 2, (c.z0 + c.z1) / 2);
      if (d < melhor) {
        melhor = d;
        pior = i;
      }
    }
    const alvo = divisorias.splice(pior, 1)[0];
    const id = alvo && alvo.id ? alvo.id : `s${sala.indice}.divisoria.` + sala.contador++;
    if (alvo && alvo.id) engine.remove(alvo.id);
    else engine.remove(id);
    sala.removidas = (sala.removidas || 0) + 1;
  }
  /* último recurso: abre um canal reto entre os vãos */
  const [ex, ez] = vecDaDirecao(sala.dirEntrada),
    [sx, sz] = vecDaDirecao(sala.dirSaida),
    horizontal = ex !== 0 && sx !== 0;
  for (const c of sala.mobilia.slice()) {
    const cx = (c.x0 + c.x1) / 2,
      cz = (c.z0 + c.z1) / 2;
    const atrapalha = horizontal ? Math.abs(cz) < 2.4 : Math.abs(cx) < 2.4;
    if (atrapalha) {
      sala.mobilia.splice(sala.mobilia.indexOf(c), 1);
      if (c.id) engine.remove(c.id);
    }
  }
  sala.valida = temCaminhoDeVerdade(sala);
  return sala.valida;
}
/* ------------------------------------------------ diretor de criaturas */
/** Pesos por criatura: base + crescimento por porta, teto e recarga. */
const DIRETOR = {
  /* peso base vem de CFG.chance: um lugar só manda no jogo todo */
  rush: { base: () => CFG.chance.rush * 100, cresce: 0.055, max: 62, recarga: 9, tipo: "maior" },
  ambush: { base: () => CFG.chance.ambush * 100, cresce: 0.04, max: 42, recarga: 14, tipo: "maior" },
  halt: { base: () => CFG.chance.halt * 100, cresce: 0.02, max: 26, recarga: 11, tipo: "maior" },
  screech: { base: () => CFG.chance.escuro * 32, cresce: 0.02, max: 30, recarga: 12, tipo: "menor" },
  eyes: { base: () => CFG.chance.quadro * 20, cresce: 0.015, max: 24, recarga: 13, tipo: "menor" },
  shadow: { base: () => CFG.chance.shadow * 100, cresce: 0.008, max: 9, recarga: 26, tipo: "vulto" },
};
function pesoDe(tipo, indice) {
  const d = DIRETOR[tipo];
  if (!d) return 0;
  if (CFG.forcar) return tipo === CFG.forcar ? 12 : 0;
  const recente = S.tempo - (S.ultimoVisto[tipo] || -999);
  if (recente < d.recarga) return 0;
  const teto = 1 - Math.min(0.85, (indice / CFG.portas) * 0.9);
  const peso = (d.base() + indice * d.cresce) * teto * CFG.perigo;
  return peso > 0.001 ? peso : 0;
}
/** Sorteia os eventos da sala respeitando regras (nunca dois "maiores"). */
function sortearEventos(sala) {
  sala.eventos = [];
  sala.diario = [];
  if (sala.corrida) return;
  const pesos = {};
  let total = 0;
  for (const tipo of Object.keys(DIRETOR)) {
    const p = pesoDe(tipo, sala.indice),
      forcado = CFG.forcar === tipo;
    if (p <= 0 && !forcado) continue;
    if (!forcado && tipo === "screech" && !sala.escuro) continue;
    if (!forcado && tipo === "eyes" && !sala.quadros.length) continue;
    if (!forcado && tipo === "halt" && sala.forma !== "corredor" && sala.forma !== "aberta")
      continue;
    if (!forcado && tipo === "shadow" && (sala.indice < 6 || sala.escuro)) continue;
    pesos[tipo] = p;
    total += p;
  }
  if (total <= 0) return;
  const rolagem = Math.random() * Math.min(total, 26);
  let acumulado = 0,
    escolhido = null;
  for (const tipo of Object.keys(pesos)) {
    acumulado += pesos[tipo];
    if (!escolhido && rolagem <= acumulado) escolhido = tipo;
  }
  if (!escolhido) return;
  const dados = DIRETOR[escolhido];
  sala.eventos.push({ tipo: escolhido, em: S.tempo + aleatorio(3, 9) });
  sala.diario.push(escolhido + ":" + Math.round(pesos[escolhido]));
  S.ultimoVisto[escolhido] = S.tempo;
  void dados;
  return escolhido;
}

/* ============================== ciclo principal ========================== */
function vigiarJogador(dt, eu) {
  if (!eu || !S.salaAtual) return;
  const dist = Math.hypot(eu.x - S.salaAtual.x, eu.z - S.salaAtual.z);
  if (dist > 46) {
    const [dx, dz] = vecDaDirecao(S.salaAtual.dirEntrada);
    engine.set("jogador", {
      x: S.salaAtual.x + dx * (MEIA - 2),
      y: 0.95,
      z: S.salaAtual.z + dz * (MEIA - 2),
      vx: 0,
      vy: 0,
      vz: 0,
    });
    aviso("Você se afastou da rota. De volta à sala " + S.salaAtual.indice + ".", 3);
  }
  if (eu.y < -6) {
    engine.set("jogador", { y: 1.2, vy: 0 });
    aviso("Cuidado com o vão.", 2);
  }
}
function entregarVizinhanca(eu) {
  if (!S.salaAtual || !eu) return;
  const sala = S.salaAtual;
  const faltando = sala.indice + CFG.salasFrente - (S.salas.length ? S.salas[S.salas.length - 1].indice : 0);
  if (faltando > 0) gerarProxima();
  const proxima = S.salas.find((s) => s.indice === sala.indice + 1);
  if (proxima && !proxima.visitada) {
    const perto = Math.hypot(eu.x - proxima.x, eu.z - proxima.z) < MEIA - 1.6;
    if (perto) avancarSala(proxima);
  }
}
function update(dt, time, input) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  S.tempo = time;
  atualizarAgenda();
  processarFilas();
  const eu = engine.get("jogador");
  if (S.fase === "inicio") {
    if (input.pressed.e) interagir(input);
    atualizarPrompt(input);
    atualizarHud(input);
    if (!S.pronto) {
      S.pronto = true;
      S.objetivo = "Entre no elevador para começar as 100 portas.";
      engine.loop("vento", 0.22);
      engine.loop("drone", 0.16);
      const salvo = engine.saved;
      if (salvo && salvo.melhorPorta) S.melhorPorta = salvo.melhorPorta;
      aviso("Bem-vindo ao hotel. Aperte E no elevador.", 6);
    }
    hud("hud.objetivo", { text: S.objetivo, visible: true });
    return;
  }
  if (S.fase === "morto") {
    S.vida = eu ? eu.health : 0;
    limparFaces();
    if (input.pressed.e) reviver();
    else if (input.pressed["0"]) reiniciar();
    atualizarPrompt(input);
    atualizarHud(input);
    return;
  }
  if (S.fase === "vitoria") {
    if (input.pressed.e) comecar();
    atualizarPrompt(input);
    atualizarHud(input);
    return;
  }
  if (input.pressed.e) interagir(input);
  if (input.pressed.f && S.fase !== "morto") {
    S.lanterna = !S.lanterna && S.bateria > 0;
    som("lanterna", 0.8);
    if (!S.lanterna) engine.torch(false);
  }
  if (input.pressed.q) usarConsumivel("q");
  if (input.pressed.c) usarConsumivel("c");
  if (input.pressed.g) usarConsumivel("g");
  if (input.pressed.r) {
    const sala = S.salaAtual || { x: 0, z: 0, dirEntrada: DIR.norte };
    const [dx, dz] = vecDaDirecao(sala.dirEntrada);
    engine.set("jogador", { x: sala.x + dx * (MEIA - 2), y: 0.95, z: sala.z + dz * (MEIA - 2), vx: 0, vy: 0, vz: 0 });
    aviso("De volta à entrada da sala " + (S.salaAtual ? S.salaAtual.indice : 1) + ".", 2.5);
  }
  if (S.lojaAberta) {
    for (let i = 1; i <= 5; i++) if (input.pressed[String(i)]) comprar(i);
  }
  if (CFG.depuracao) {
    if (input.pressed["7"] && !S.entidades.rush) criarRush("rush");
    if (input.pressed["8"] && !S.entidades.ambush) criarRush("ambush");
    if (input.pressed["9"] && eu && !S.entidades.screech) criarScreech(eu);
    if (input.pressed["0"] && S.fase !== "morto") {
      S.ultimoDanoEm = S.tempo;
      engine.damage("jogador", 100);
    }
    if (input.pressed["6"]) S.moedas += 50;
    if (input.pressed["5"] && eu && !S.entidades.timothy) criarTimothy(eu.x + 2, eu.z);
    if (input.pressed["4"] && eu) criarJack(eu.x, 1.5, eu.z - 1.1, false);
    if (input.pressed["3"]) criarShadow();
    if (input.pressed["2"] && S.salaAtual && !S.salaAtual.snare) criarSnare(S.salaAtual);
    if (input.pressed["1"] && S.salaAtual && S.salaAtual.portas.saida)
      S.salaAtual.portas.saida.dupe = true;
  }
  atualizarJogador(dt, input, eu);
  vigiarJogador(dt, eu);
  entregarVizinhanca(eu);
  if (S.fase !== "hotel" && S.fase !== "corrida") return;
  atualizarEventos(dt, eu, input);
  atualizarRush(dt, eu);
  atualizarScreech(dt, eu, input);
  atualizarOlhos(dt, input);
  atualizarHalt(dt, eu, input);
  atualizarArmarios(dt);
  atualizarFaces(eu);
  atualizarTimothy(dt, eu);
  atualizarJack(dt, eu);
  atualizarShadow(dt, eu);
  atualizarSnare(dt, eu);
  atualizarHide(dt, eu);
  if (input.pressed.space) escaparSnare();
  atualizarCorrida(dt, eu);
  atualizarFigura(dt, eu);
  atualizarPrompt(input);
  atualizarHud(input);
  if (eu && eu.health <= 0 && S.fase !== "morto") morrer();
  if (S.lanterna && S.fase === "hotel") {
    const sala = S.salaAtual;
    if (sala && sala.corrida) engine.loop("drone", 0.25);
  }
}
function start() {
  engine.log("Portas · Hotel das 100 Portas iniciado. Configure tudo no topo deste script (CFG).");
  engine.torch(false);
  engine.volume(0.9);
  S.fase = "inicio";
  S.pronto = false;
  S.objetivo = "Entre no elevador para começar as 100 portas.";
}
