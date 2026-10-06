/**
 * Catálogo de armas e ferramentas do GORE FORGE (dados puros).
 *
 * Cada arma descreve:
 *  - estatísticas de combate (dano, cadência, spread, recuo, munição);
 *  - resposta de gore (sangue, chance de desmembrar, limiar de estilhaço);
 *  - modelo em primeira pessoa (`view.parts`) montado por peças primitivas;
 *  - sons sintetizados pedidos ao AudioEngine da engine (`sfx`).
 *
 * Adicionar uma arma nova = acrescentar um item nesta tabela. Nada mais.
 */
export type WeaponKind = "hitscan" | "projectile" | "melee" | "tool";
export type ToolKind = "physgun" | "dissolve" | "clone" | "anchor" | "spawn" | null;
export type WeaponCategory = "pistola" | "fuzil" | "escopeta" | "pesada" | "corpo-a-corpo" | "ferramenta";

export interface ViewPart {
  shape: "box" | "cyl" | "sphere" | "cone";
  size: [number, number, number];
  pos: [number, number, number];
  rot?: [number, number, number];
  color: string;
  metal?: number;
  rough?: number;
  emissive?: string;
}

export interface WeaponSpec {
  id: string;
  name: string;
  short: string;
  icon: string;
  category: WeaponCategory;
  description: string;
  kind: WeaponKind;
  tool: ToolKind;
  auto: boolean;
  rpm: number;
  magazine: number;
  reserve: number;
  reload: number;
  damage: number;
  pellets: number;
  spread: number;
  moveSpread: number;
  adsSpread: number;
  recoil: { kick: number; pitch: number; yaw: number; recovery: number };
  range: number;
  falloff: number;
  penetration: number;
  impulse: number;
  projectile?: {
    speed: number;
    gravity: number;
    radius: number;
    fuse: number;
    explode?: { radius: number; force: number; damage: number; shake: number };
    jelly?: { size: [number, number, number]; stiffness: number };
    color: string;
    emissive: string;
    trail: number;
  };
  melee?: { reach: number; arc: number; force: number; swing: number };
  gore: { blood: number; gib: number; dismember: number };
  view: {
    scale: number;
    hip: [number, number, number];
    ads: [number, number, number];
    muzzle: [number, number, number];
    eject?: [number, number, number];
    kick: number;
    parts: ViewPart[];
  };
  adsFov: number;
  shake: number;
  tracer: string;
  sfx: { fire: string; reload: string; empty: string; equip: string };
  slot: number;
}

const hand: ViewPart[] = [
  { shape: "box", size: [0.09, 0.1, 0.16], pos: [0, -0.03, 0.05], color: "#d9a678", rough: 0.9 },
  { shape: "box", size: [0.08, 0.08, 0.18], pos: [0, -0.02, 0.2], color: "#d9a678", rough: 0.9 },
];

export const weapons: Record<string, WeaponSpec> = {
  ferrolho: {
    id: "ferrolho",
    name: "Pistola Ferrolho",
    short: "FERROLHO",
    icon: "🔫",
    category: "pistola",
    description: "Semiautomática confiável. Boa para precisão e headshots limpos.",
    kind: "hitscan",
    tool: null,
    auto: false,
    rpm: 280,
    magazine: 12,
    reserve: 96,
    reload: 1.35,
    damage: 27,
    pellets: 1,
    spread: 0.5,
    moveSpread: 1.5,
    adsSpread: 0.12,
    recoil: { kick: 0.05, pitch: 0.021, yaw: 0.008, recovery: 12 },
    range: 120,
    falloff: 0.45,
    penetration: 1,
    impulse: 4,
    gore: { blood: 1, gib: 0.25, dismember: 0.12 },
    view: {
      scale: 1,
      hip: [0, -0.02, 0],
      ads: [0, -0.035, -0.04],
      muzzle: [0, 0.035, -0.24],
      eject: [0.05, 0.05, 0.02],
      kick: 1,
      parts: [
        { shape: "box", size: [0.07, 0.11, 0.22], pos: [0, 0, -0.02], color: "#40464e", metal: 0.65 },
        { shape: "box", size: [0.05, 0.04, 0.26], pos: [0, 0.02, -0.24], color: "#2b3037", metal: 0.7 },
        { shape: "cyl", size: [0.018, 0.018, 0.12], pos: [0, 0.03, -0.34], rot: [Math.PI / 2, 0, 0], color: "#151a1f", metal: 0.8 },
        { shape: "box", size: [0.06, 0.14, 0.09], pos: [0, -0.12, 0.06], rot: [0.25, 0, 0], color: "#2f343b" },
        { shape: "box", size: [0.02, 0.03, 0.03], pos: [0, 0.075, -0.12], color: "#ffb020", emissive: "#ffb020" },
        ...hand,
      ],
    },
    adsFov: 62,
    shake: 0.14,
    tracer: "#ffd39a",
    sfx: { fire: "disparo.pistola", reload: "recarga.leve", empty: "clique", equip: "equipar" },
    slot: 1,
  },
  f90: {
    id: "f90",
    name: "Fuzil F-90",
    short: "F-90",
    icon: "🎯",
    category: "fuzil",
    description: "Automático de assalto. Spray controlável e cadência alta.",
    kind: "hitscan",
    tool: null,
    auto: true,
    rpm: 660,
    magazine: 30,
    reserve: 240,
    reload: 2.1,
    damage: 19,
    pellets: 1,
    spread: 0.85,
    moveSpread: 2.6,
    adsSpread: 0.22,
    recoil: { kick: 0.055, pitch: 0.016, yaw: 0.011, recovery: 13 },
    range: 160,
    falloff: 0.4,
    penetration: 2,
    impulse: 3.5,
    gore: { blood: 1, gib: 0.3, dismember: 0.16 },
    view: {
      scale: 1,
      hip: [0, -0.02, 0.02],
      ads: [0, -0.045, -0.03],
      muzzle: [0, 0.045, -0.52],
      eject: [0.07, 0.03, 0.1],
      kick: 1.1,
      parts: [
        { shape: "box", size: [0.08, 0.11, 0.42], pos: [0, 0, -0.16], color: "#3b4149", metal: 0.55 },
        { shape: "box", size: [0.06, 0.07, 0.5], pos: [0, 0.04, -0.5], color: "#22262b", metal: 0.7 },
        { shape: "cyl", size: [0.02, 0.02, 0.2], pos: [0, 0.045, -0.84], rot: [Math.PI / 2, 0, 0], color: "#14181c", metal: 0.85 },
        { shape: "box", size: [0.07, 0.2, 0.1], pos: [0, -0.14, 0.02], rot: [0.35, 0, 0], color: "#2b3036" },
        { shape: "box", size: [0.06, 0.18, 0.09], pos: [0, -0.14, -0.2], rot: [0.1, 0, 0], color: "#31363d" },
        { shape: "box", size: [0.04, 0.05, 0.14], pos: [0, 0.085, -0.28], color: "#1c2025", metal: 0.6 },
        { shape: "box", size: [0.02, 0.02, 0.02], pos: [0.045, 0.07, -0.36], color: "#ff5c4d", emissive: "#ff5c4d" },
        ...hand,
      ],
    },
    adsFov: 55,
    shake: 0.2,
    tracer: "#ffcf8a",
    sfx: { fire: "disparo.fuzil", reload: "recarga.pesada", empty: "clique", equip: "equipar" },
    slot: 2,
  },
  vespa: {
    id: "vespa",
    name: "Submetralhadora Vespa",
    short: "VESPA",
    icon: "🐝",
    category: "fuzil",
    description: "Cadência absurda, precisão baixa. Feita para encher de chumbo.",
    kind: "hitscan",
    tool: null,
    auto: true,
    rpm: 1050,
    magazine: 40,
    reserve: 320,
    reload: 1.8,
    damage: 11,
    pellets: 1,
    spread: 1.7,
    moveSpread: 3.4,
    adsSpread: 0.5,
    recoil: { kick: 0.04, pitch: 0.012, yaw: 0.014, recovery: 16 },
    range: 70,
    falloff: 0.7,
    penetration: 1,
    impulse: 2,
    gore: { blood: 1.15, gib: 0.22, dismember: 0.1 },
    view: {
      scale: 0.95,
      hip: [0, -0.03, 0.03],
      ads: [0, -0.05, -0.02],
      muzzle: [0, 0.038, -0.34],
      eject: [0.06, 0.03, 0.06],
      kick: 0.8,
      parts: [
        { shape: "box", size: [0.07, 0.1, 0.3], pos: [0, 0, -0.1], color: "#3a3f47", metal: 0.5 },
        { shape: "cyl", size: [0.017, 0.017, 0.26], pos: [0, 0.035, -0.42], rot: [Math.PI / 2, 0, 0], color: "#181c21", metal: 0.8 },
        { shape: "box", size: [0.05, 0.24, 0.07], pos: [0, -0.16, -0.04], rot: [0.12, 0, 0], color: "#2c3138" },
        { shape: "box", size: [0.05, 0.05, 0.1], pos: [0, 0.07, -0.22], color: "#22262c" },
        ...hand,
      ],
    },
    adsFov: 62,
    shake: 0.13,
    tracer: "#ffe0a3",
    sfx: { fire: "disparo.smg", reload: "recarga.leve", empty: "clique", equip: "equipar" },
    slot: 3,
  },
  quebra: {
    id: "quebra",
    name: "Escopeta Quebra-Pedra",
    short: "QUEBRA",
    icon: "💥",
    category: "escopeta",
    description: "8 balotes por tiro. No ponto certo, arranca o que estiver na frente.",
    kind: "hitscan",
    tool: null,
    auto: false,
    rpm: 70,
    magazine: 6,
    reserve: 48,
    reload: 2.6,
    damage: 12,
    pellets: 8,
    spread: 4.6,
    moveSpread: 6.5,
    adsSpread: 3.2,
    recoil: { kick: 0.16, pitch: 0.06, yaw: 0.02, recovery: 9 },
    range: 40,
    falloff: 1.25,
    penetration: 0,
    impulse: 9,
    gore: { blood: 1.6, gib: 1.4, dismember: 0.75 },
    view: {
      scale: 1.05,
      hip: [0, -0.02, 0.02],
      ads: [0, -0.05, -0.04],
      muzzle: [0, 0.05, -0.62],
      eject: [0.07, 0.05, 0.16],
      kick: 1.8,
      parts: [
        { shape: "box", size: [0.09, 0.12, 0.44], pos: [0, 0, -0.18], color: "#4a3524", rough: 0.85 },
        { shape: "cyl", size: [0.026, 0.026, 0.7], pos: [0, 0.055, -0.62], rot: [Math.PI / 2, 0, 0], color: "#2b2f35", metal: 0.8 },
        { shape: "cyl", size: [0.03, 0.03, 0.5], pos: [0, -0.02, -0.55], rot: [Math.PI / 2, 0, 0], color: "#23272c", metal: 0.75 },
        { shape: "box", size: [0.05, 0.09, 0.2], pos: [0, -0.11, -0.04], rot: [0.2, 0, 0], color: "#5a4229" },
        { shape: "box", size: [0.06, 0.16, 0.1], pos: [0, -0.14, 0.12], rot: [0.45, 0, 0], color: "#3b2a1b" },
        ...hand,
      ],
    },
    adsFov: 68,
    shake: 0.42,
    tracer: "#ffc27a",
    sfx: { fire: "disparo.escopeta", reload: "recarga.escopeta", empty: "clique", equip: "equipar" },
    slot: 4,
  },
  estaca: {
    id: "estaca",
    name: "Estaca de Ferro",
    short: "ESTACA",
    icon: "🪡",
    category: "pesada",
    description: "Ferrolho de precisão: atravessa corpos, paredes finas e fileiras inteiras.",
    kind: "hitscan",
    tool: null,
    auto: false,
    rpm: 42,
    magazine: 5,
    reserve: 25,
    reload: 3.1,
    damage: 86,
    pellets: 1,
    spread: 0.05,
    moveSpread: 3,
    adsSpread: 0,
    recoil: { kick: 0.22, pitch: 0.075, yaw: 0.01, recovery: 7 },
    range: 400,
    falloff: 0.05,
    penetration: 4,
    impulse: 14,
    gore: { blood: 1.4, gib: 2, dismember: 0.9 },
    view: {
      scale: 1.1,
      hip: [0, -0.02, 0.02],
      ads: [0, -0.05, -0.03],
      muzzle: [0, 0.05, -0.8],
      eject: [0.08, 0.04, 0.1],
      kick: 2.1,
      parts: [
        { shape: "box", size: [0.08, 0.11, 0.5], pos: [0, 0, -0.2], color: "#2e333a", metal: 0.6 },
        { shape: "cyl", size: [0.022, 0.022, 1.15], pos: [0, 0.05, -0.85], rot: [Math.PI / 2, 0, 0], color: "#171b20", metal: 0.9 },
        { shape: "box", size: [0.05, 0.09, 0.28], pos: [0, 0.11, -0.3], color: "#1d2227", metal: 0.7 },
        { shape: "cyl", size: [0.035, 0.035, 0.16], pos: [0, 0.12, -0.46], rot: [Math.PI / 2, 0, 0], color: "#31e7ff", emissive: "#31e7ff" },
        { shape: "box", size: [0.06, 0.2, 0.1], pos: [0, -0.15, 0.04], rot: [0.3, 0, 0], color: "#2a2f35" },
        ...hand,
      ],
    },
    adsFov: 30,
    shake: 0.5,
    tracer: "#a9f4ff",
    sfx: { fire: "disparo.estaca", reload: "recarga.pesada", empty: "clique", equip: "equipar" },
    slot: 5,
  },
  goela: {
    id: "goela",
    name: "Lança-Granada Goela",
    short: "GOELA",
    icon: "🧨",
    category: "pesada",
    description: "Granada de impacto com raio de 6 m. Reorganiza o cenário inteiro.",
    kind: "projectile",
    tool: null,
    auto: false,
    rpm: 45,
    magazine: 1,
    reserve: 12,
    reload: 2.8,
    damage: 40,
    pellets: 1,
    spread: 0.6,
    moveSpread: 1.2,
    adsSpread: 0.3,
    recoil: { kick: 0.3, pitch: 0.09, yaw: 0.02, recovery: 6 },
    range: 200,
    falloff: 0,
    penetration: 0,
    impulse: 6,
    projectile: {
      speed: 26,
      gravity: 0.55,
      radius: 0.16,
      fuse: 4.5,
      explode: { radius: 6.5, force: 26, damage: 120, shake: 2.4 },
      color: "#4a5a2f",
      emissive: "#ffb020",
      trail: 0.4,
    },
    gore: { blood: 1, gib: 1.6, dismember: 0.65 },
    view: {
      scale: 1.1,
      hip: [0, -0.02, 0.02],
      ads: [0, -0.045, -0.02],
      muzzle: [0, 0.075, -0.5],
      kick: 2.4,
      parts: [
        { shape: "box", size: [0.1, 0.12, 0.56], pos: [0, 0, -0.24], color: "#454b2c", rough: 0.8 },
        { shape: "cyl", size: [0.055, 0.055, 0.6], pos: [0, 0.09, -0.6], rot: [Math.PI / 2, 0, 0], color: "#2f3421", metal: 0.5 },
        { shape: "cone", size: [0.09, 0.12, 0.09], pos: [0, 0.09, -0.94], rot: [-Math.PI / 2, 0, 0], color: "#262a18" },
        { shape: "box", size: [0.06, 0.16, 0.12], pos: [0, -0.13, 0], rot: [0.35, 0, 0], color: "#3a4026" },
        ...hand,
      ],
    },
    adsFov: 70,
    shake: 0.6,
    tracer: "#ffd166",
    sfx: { fire: "disparo.lancador", reload: "recarga.pesada", empty: "clique", equip: "equipar" },
    slot: 6,
  },
  gelatina: {
    id: "gelatina",
    name: "Canhão de Gelatina",
    short: "GELO",
    icon: "🟢",
    category: "pesada",
    description:
      "Dispara blocos elásticos. A víbora elástica da engine faz o resto: quica, gruda e derruba.",
    kind: "projectile",
    tool: null,
    auto: false,
    rpm: 90,
    magazine: 6,
    reserve: 60,
    reload: 2.2,
    damage: 8,
    pellets: 1,
    spread: 1.1,
    moveSpread: 2,
    adsSpread: 0.5,
    recoil: { kick: 0.14, pitch: 0.03, yaw: 0.01, recovery: 10 },
    range: 90,
    falloff: 0.2,
    penetration: 0,
    impulse: 7,
    projectile: {
      speed: 22,
      gravity: 0.9,
      radius: 0.3,
      fuse: 0,
      jelly: { size: [0.7, 0.7, 0.7], stiffness: 46 },
      color: "#6ff0c0",
      emissive: "#6ff0c0",
      trail: 0.8,
    },
    gore: { blood: 0.4, gib: 0.5, dismember: 0.2 },
    view: {
      scale: 1,
      hip: [0, -0.02, 0.02],
      ads: [0, -0.045, -0.02],
      muzzle: [0, 0.05, -0.42],
      kick: 1.2,
      parts: [
        { shape: "cyl", size: [0.07, 0.07, 0.42], pos: [0, 0, -0.16], rot: [Math.PI / 2, 0, 0], color: "#3bad8c", metal: 0.3, emissive: "#1d8f70" },
        { shape: "cyl", size: [0.09, 0.09, 0.18], pos: [0, 0, -0.42], rot: [Math.PI / 2, 0, 0], color: "#6ff0c0", emissive: "#6ff0c0" },
        { shape: "sphere", size: [0.13, 0.13, 0.13], pos: [0, 0, 0.14], color: "#57d8ae", emissive: "#2fae88" },
        { shape: "box", size: [0.06, 0.14, 0.1], pos: [0, -0.13, -0.02], rot: [0.3, 0, 0], color: "#2f7f68" },
        ...hand,
      ],
    },
    adsFov: 72,
    shake: 0.25,
    tracer: "#8affd8",
    sfx: { fire: "gelatina.tiro", reload: "gelatina.recarga", empty: "clique", equip: "equipar" },
    slot: 7,
  },
  cabra: {
    id: "cabra",
    name: "Pé de Cabra",
    short: "CABRA",
    icon: "🪓",
    category: "corpo-a-corpo",
    description: "Arma branca de demolição. Quebra caixotes e manda corpos longe.",
    kind: "melee",
    tool: null,
    auto: true,
    rpm: 150,
    magazine: 0,
    reserve: 0,
    reload: 0,
    damage: 34,
    pellets: 1,
    spread: 0,
    moveSpread: 0,
    adsSpread: 0,
    recoil: { kick: 0.2, pitch: 0.02, yaw: 0.03, recovery: 14 },
    range: 2.6,
    falloff: 0,
    penetration: 0,
    impulse: 12,
    melee: { reach: 2.6, arc: 0.4, force: 14, swing: 0.28 },
    gore: { blood: 1.5, gib: 0.8, dismember: 0.5 },
    view: {
      scale: 1,
      hip: [0, -0.03, 0.02],
      ads: [0, -0.05, -0.02],
      muzzle: [0, 0, -0.9],
      kick: 1.4,
      parts: [
        { shape: "cyl", size: [0.022, 0.022, 0.62], pos: [0, 0, -0.3], rot: [Math.PI / 2, 0, 0], color: "#8a3f22", rough: 0.9 },
        { shape: "box", size: [0.05, 0.05, 0.34], pos: [0, 0.08, -0.96], rot: [0, 0, 0.45], color: "#a8442a", metal: 0.4 },
        { shape: "box", size: [0.05, 0.06, 0.12], pos: [0.11, 0.1, -1.06], rot: [0, 0.3, 0.6], color: "#b34f30" },
        ...hand,
      ],
    },
    adsFov: 80,
    shake: 0.22,
    tracer: "#ff8a5c",
    sfx: { fire: "cabra.golpe", reload: "clique", empty: "clique", equip: "equipar" },
    slot: 8,
  },
  gravar: {
    id: "gravar",
    name: "Gravador (Física)",
    short: "GRAVADOR",
    icon: "🧲",
    category: "ferramenta",
    description:
      "Agarra qualquer objeto físico no centro da mira. Botão esquerdo prende, direito arremessa.",
    kind: "tool",
    tool: "physgun",
    auto: false,
    rpm: 120,
    magazine: 0,
    reserve: 0,
    reload: 0,
    damage: 4,
    pellets: 1,
    spread: 0,
    moveSpread: 0,
    adsSpread: 0,
    recoil: { kick: 0.05, pitch: 0.01, yaw: 0.005, recovery: 14 },
    range: 16,
    falloff: 0,
    penetration: 0,
    impulse: 22,
    gore: { blood: 0, gib: 0, dismember: 0 },
    view: {
      scale: 0.95,
      hip: [0, -0.03, 0.02],
      ads: [0, -0.05, -0.02],
      muzzle: [0, 0.05, -0.34],
      kick: 0.5,
      parts: [
        { shape: "box", size: [0.09, 0.12, 0.26], pos: [0, 0, -0.06], color: "#2c3f45", metal: 0.7 },
        { shape: "cyl", size: [0.03, 0.03, 0.2], pos: [0, 0.06, -0.3], rot: [Math.PI / 2, 0, 0], color: "#1b262a", metal: 0.8 },
        { shape: "sphere", size: [0.11, 0.11, 0.11], pos: [0, 0.06, -0.42], color: "#31e7ff", emissive: "#31e7ff", metal: 0.1 },
        { shape: "box", size: [0.06, 0.16, 0.1], pos: [0, -0.14, 0.06], rot: [0.3, 0, 0], color: "#243136" },
        ...hand,
      ],
    },
    adsFov: 70,
    shake: 0,
    tracer: "#31e7ff",
    sfx: { fire: "gravador.agarrar", reload: "clique", empty: "clique", equip: "equipar" },
    slot: 9,
  },
  dissolver: {
    id: "dissolver",
    name: "Dissolvedor",
    short: "DISSOLVER",
    icon: "🫧",
    category: "ferramenta",
    description: "Apaga o que a mira tocar e devolve o material em partículas.",
    kind: "tool",
    tool: "dissolve",
    auto: true,
    rpm: 180,
    magazine: 0,
    reserve: 0,
    reload: 0,
    damage: 0,
    pellets: 1,
    spread: 0,
    moveSpread: 0,
    adsSpread: 0,
    recoil: { kick: 0.02, pitch: 0.005, yaw: 0.004, recovery: 14 },
    range: 22,
    falloff: 0,
    penetration: 0,
    impulse: 0,
    gore: { blood: 0, gib: 0, dismember: 0 },
    view: {
      scale: 0.95,
      hip: [0, -0.03, 0.02],
      ads: [0, -0.05, -0.02],
      muzzle: [0, 0.05, -0.3],
      kick: 0.4,
      parts: [
        { shape: "box", size: [0.08, 0.11, 0.24], pos: [0, 0, -0.05], color: "#3a2f45", metal: 0.6 },
        { shape: "cyl", size: [0.026, 0.026, 0.16], pos: [0, 0.055, -0.26], rot: [Math.PI / 2, 0, 0], color: "#241d2e", metal: 0.8 },
        { shape: "sphere", size: [0.09, 0.09, 0.09], pos: [0, 0.055, -0.36], color: "#ff5cff", emissive: "#ff5cff" },
        ...hand,
      ],
    },
    adsFov: 72,
    shake: 0,
    tracer: "#ff8aff",
    sfx: { fire: "dissolver", reload: "clique", empty: "clique", equip: "equipar" },
    slot: 0,
  },
  solda: {
    id: "solda",
    name: "Solda (Ancorar)",
    short: "SOLDA",
    icon: "🛠️",
    category: "ferramenta",
    description:
      "Alterna o objeto mirado entre estático e dinâmico. Serve para empilhar cenário sem cair.",
    kind: "tool",
    tool: "anchor",
    auto: false,
    rpm: 120,
    magazine: 0,
    reserve: 0,
    reload: 0,
    damage: 0,
    pellets: 1,
    spread: 0,
    moveSpread: 0,
    adsSpread: 0,
    recoil: { kick: 0.02, pitch: 0.005, yaw: 0.004, recovery: 14 },
    range: 18,
    falloff: 0,
    penetration: 0,
    impulse: 0,
    gore: { blood: 0, gib: 0, dismember: 0 },
    view: {
      scale: 0.95,
      hip: [0, -0.03, 0.02],
      ads: [0, -0.05, -0.02],
      muzzle: [0, 0.05, -0.28],
      kick: 0.4,
      parts: [
        { shape: "box", size: [0.08, 0.11, 0.22], pos: [0, 0, -0.05], color: "#454032", metal: 0.6 },
        { shape: "cyl", size: [0.024, 0.024, 0.14], pos: [0, 0.05, -0.24], rot: [Math.PI / 2, 0, 0], color: "#2a271d", metal: 0.8 },
        { shape: "cone", size: [0.05, 0.09, 0.05], pos: [0, 0.05, -0.33], rot: [-Math.PI / 2, 0, 0], color: "#ffd166", emissive: "#ffd166" },
        ...hand,
      ],
    },
    adsFov: 72,
    shake: 0,
    tracer: "#ffd166",
    sfx: { fire: "solda", reload: "clique", empty: "clique", equip: "equipar" },
    slot: 0,
  },
  clonar: {
    id: "clonar",
    name: "Duplicador",
    short: "CLONAR",
    icon: "📦",
    category: "ferramenta",
    description: "Copia o objeto mirado do lado da mira. Enche o mapa de dor.",
    kind: "tool",
    tool: "clone",
    auto: true,
    rpm: 200,
    magazine: 0,
    reserve: 0,
    reload: 0,
    damage: 0,
    pellets: 1,
    spread: 0,
    moveSpread: 0,
    adsSpread: 0,
    recoil: { kick: 0.02, pitch: 0.005, yaw: 0.004, recovery: 14 },
    range: 20,
    falloff: 0,
    penetration: 0,
    impulse: 0,
    gore: { blood: 0, gib: 0, dismember: 0 },
    view: {
      scale: 0.95,
      hip: [0, -0.03, 0.02],
      ads: [0, -0.05, -0.02],
      muzzle: [0, 0.05, -0.28],
      kick: 0.4,
      parts: [
        { shape: "box", size: [0.09, 0.12, 0.24], pos: [0, 0, -0.05], color: "#2f3a45", metal: 0.65 },
        { shape: "box", size: [0.05, 0.05, 0.1], pos: [0, 0.07, -0.24], color: "#1e252c", metal: 0.7 },
        { shape: "sphere", size: [0.07, 0.07, 0.07], pos: [0, 0.07, -0.32], color: "#7ee081", emissive: "#7ee081" },
        ...hand,
      ],
    },
    adsFov: 72,
    shake: 0,
    tracer: "#7ee081",
    sfx: { fire: "duplicar", reload: "clique", empty: "clique", equip: "equipar" },
    slot: 0,
  },
};

export const weaponIds = Object.keys(weapons);
/** Ordem do HUD e das teclas 1..9 (a 0 fica com as ferramentas rotativas). */
export const quickSlots = [
  "ferrolho",
  "f90",
  "vespa",
  "quebra",
  "estaca",
  "goela",
  "gelatina",
  "cabra",
  "gravar",
];
/** Ferramentas disponíveis (tecla 0 cicla nesta ordem). */
export const tools = ["gravar", "dissolver", "solda", "clonar"];
export const toolCycle = tools;

export function weaponFor(id: string): WeaponSpec {
  return weapons[id] ?? weapons.ferrolho;
}

export function weaponName(id: string) {
  return weaponFor(id).name;
}

/** Segundos entre disparos (cadência limitada pela engine de áudio também). */
export function fireInterval(spec: WeaponSpec) {
  return 60 / Math.max(1, spec.rpm);
}

/** Spread efetivo em graus quando em movimento/agachado/na mira. */
export function effectiveSpread(
  spec: WeaponSpec,
  options: { moving: number; airborne: boolean; ads: boolean; crouched: boolean },
) {
  const base = options.ads ? spec.adsSpread : spec.spread;
  const move = options.ads ? spec.adsSpread * 0.6 : spec.moveSpread;
  const stance = options.crouched && !options.ads ? 0.6 : 1;
  const air = options.airborne ? 1.6 : 1;
  return (base + move * Math.min(1, options.moving)) * stance * air;
}

/** Dano após queda por distância (0 = sem queda). */
export function damageAtRange(spec: WeaponSpec, distance: number) {
  if (!spec.falloff) return spec.damage;
  const t = Math.min(1, distance / Math.max(1, spec.range));
  return Math.max(spec.damage * 0.22, spec.damage * (1 - spec.falloff * t));
}
