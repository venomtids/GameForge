/**
 * "PÁTIO DA FORJA" — cenário do GORE FORGE.
 *
 * Este arquivo é DADO PURO (sem THREE, sem DOM) para poder rodar tanto no
 * navegador quanto no Node (`npm run game:goreforge` exporta o mesmo mapa como
 * `.gameforge.json` para abrir no Studio). O mapa usa apenas recursos que a
 * engine já valida: nós, texturas de pixel, superfícies, luzes e céu.
 *
 * Zonas:
 *  - Pátio central: caixotes, barris explosivos e torres para demolição.
 *  - Linha de tiro: alvos, bonecos e um paredão de concreto.
 *  - Tanque de gelatina: cubos/plataformas elásticas para achar o limite.
 *  - Arena de NPCs: caçadores, horda e um lance de arquibancada.
 *  - Torre de queda: 24 m para testar queda, dash e deformação de impacto.
 */
import {
  makeNode,
  type Node3D,
  type Project,
  type SceneData,
  type Vec3,
} from "../engine/model";
import {
  actorDefaults,
  deformDefaults,
  shadowDefaults,
  type ActorSettings,
} from "../engine/features06";
import type { PixelTexture } from "../engine/studio-model";

/* ------------------------------------------------------------- texturas --- */
const hex = (n: number) => n.toString(16).padStart(2, "0");
const clamp255 = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

/** Ruído determinístico (mesmo mapa/textura em qualquer máquina). */
function noise(seed: number, x: number, y: number) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function texture(
  id: string,
  name: string,
  size: 16 | 32 | 64,
  painter: (x: number, y: number, r: number) => string,
): PixelTexture {
  const pixels: string[] = [];
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      pixels.push(painter(x, y, noise(id.length * 7 + size, x, y)));
  return { id, name, size, pixels };
}

const shade = (r: number, g: number, b: number) =>
  `#${hex(clamp255(r))}${hex(clamp255(g))}${hex(clamp255(b))}`;

export const arenaTextures: PixelTexture[] = [
  texture("tex-concreto", "Concreto sujo", 32, (x, y, r) => {
    const grain = (r - 0.5) * 34;
    const crack = noise(3, Math.floor(x / 2), Math.floor(y / 2)) > 0.94 ? -42 : 0;
    const base = 150 + grain + crack;
    return shade(base, base - 3, base - 8);
  }),
  texture("tex-metal", "Aço rebitado", 32, (x, y) => {
    const plate = (x % 16 < 1 || y % 16 < 1) ? -46 : 0;
    const rivet = (x % 16 === 3 || x % 16 === 12) && (y % 16 === 3 || y % 16 === 12) ? 44 : 0;
    const brushed = noise(11, x, Math.floor(y / 3)) * 18 - 9;
    const base = 138 + plate + rivet + brushed;
    return shade(base, base + 4, base + 12);
  }),
  texture("tex-madeira", "Madeira de caixote", 32, (x, y, r) => {
    const plank = y % 8 < 1 ? -52 : 0;
    const grain = Math.sin((x + r * 6) * 0.7) * 10 + (r - 0.5) * 14;
    return shade(176 + plank, 126 + plank + grain, 68 + plank + grain);
  }),
  texture("tex-grade", "Grade industrial", 32, (x, y) => {
    const bar = x % 6 < 2 || y % 6 < 2 ? 96 : 22;
    return shade(bar + 6, bar + 10, bar + 14);
  }),
  texture("tex-sangue", "Piso manchado", 32, (x, y) => {
    const stain = noise(23, Math.floor(x / 3), Math.floor(y / 3));
    const base = stain > 0.62 ? 92 : 132;
    const dark = stain > 0.62 ? 26 : 4;
    return shade(base, base - 26 - dark, base - 34 - dark);
  }),
  texture("tex-aviso", "Faixa de aviso", 32, (x, y) => {
    const stripe = ((x + y) % 16) < 8;
    return stripe ? "#e8c033" : "#26282b";
  }),
];

/* ------------------------------------------------------------------ mapa --- */
export interface ArenaZone {
  id: string;
  name: string;
  center: Vec3;
  radius: number;
  hint: string;
}

export interface BreakProfile {
  /** Vida total antes de fraturar. */
  hp: number;
  material: "madeira" | "metal" | "concreto" | "vidro" | "gelatina" | "tecido" | "explosivo";
  chunks: number;
  explosive?: { radius: number; force: number; damage: number };
}

export interface ArenaMeta {
  name: string;
  playerId: string;
  spawn: Vec3;
  zones: ArenaZone[];
  /** Props que o sistema de destruição acompanha desde o início. */
  breakables: Record<string, BreakProfile>;
  /** NPCs já presentes no mapa. */
  npcs: string[];
  /** Corpos elásticos iniciais (limite da engine: 12 rigs por cena). */
  jellies: string[];
  /** Alvos da linha de tiro (viram alvo de treino). */
  targets: string[];
}

const PLAYER_ID = "gf-player";
export const ARENA_HALF = 34;

function brute(
  id: string,
  name: string,
  position: Vec3,
  scale: Vec3,
  color: string,
  textureId: string | null,
  extra: Partial<Node3D> = {},
) {
  return makeNode("box", {
    id,
    name,
    position,
    scale,
    color,
    textureId,
    physics: "static",
    friction: 0.35,
    ...extra,
  });
}

function prop(
  id: string,
  name: string,
  position: Vec3,
  scale: Vec3,
  color: string,
  textureId: string | null,
  extra: Partial<Node3D> = {},
) {
  return makeNode("box", {
    id,
    name,
    position,
    scale,
    color,
    textureId,
    physics: "dynamic",
    mass: 9,
    restitution: 0.08,
    friction: 0.55,
    ...extra,
  });
}

function jellyNode(
  id: string,
  name: string,
  position: Vec3,
  scale: Vec3,
  color: string,
  kind: Node3D["kind"],
  stiffness: number,
  options: {
    fluidity?: number;
    static?: boolean;
    mass?: number;
    maxStretch?: number;
  } = {},
) {
  return makeNode(kind, {
    id,
    name,
    position,
    scale,
    color,
    physics: options.static ? "static" : "dynamic",
    mass: options.mass ?? 8,
    restitution: 0.14,
    friction: 0.45,
    deform: {
      ...deformDefaults,
      type: "jelly",
      stiffness,
      damping: 2.4,
      volume: options.fluidity ? 0.97 : 0.9,
      maxStretch: options.maxStretch ?? 1.85,
      fluidity: options.fluidity ?? 0,
      intensity: 1.5,
      movementInfluence: 1.25,
      radiusConstraint: 0.28,
      surfaceCollision: true,
    },
  });
}

function botNode(
  id: string,
  name: string,
  position: Vec3,
  color: string,
  options: Partial<ActorSettings> & { mass?: number; speed?: number; jelly?: boolean } = {},
) {
  const { mass, speed, jelly, ...actor } = options;
  return makeNode("box", {
    id,
    name,
    position,
    scale: [0.82, 1.8, 0.68],
    color,
    physics: "dynamic",
    mass: mass ?? 16,
    restitution: 0,
    friction: 0,
    behavior: "none",
    speed: speed ?? 4.2,
    actor: { ...actorDefaults, humanoid: true, ...actor },
    ...(jelly
      ? {
          deform: {
            ...deformDefaults,
            type: "jelly" as const,
            stiffness: 46,
            damping: 2.6,
            volume: 0.9,
            maxStretch: 1.8,
            intensity: 1.5,
            movementInfluence: 1.2,
            surfaceCollision: true,
          },
        }
      : {}),
  });
}

/** Criação das paredes de contenção do pátio (evitam que tudo caia no vazio). */
function fences(nodes: Node3D[]) {
  for (const [i, [x, z]] of [
    [0, -ARENA_HALF],
    [0, ARENA_HALF],
    [-ARENA_HALF, 0],
    [ARENA_HALF, 0],
  ].entries()) {
    const horizontal = i < 2;
    nodes.push(
      brute(
        `gf-fence-${i}`,
        "Cerca de contenção",
        [x, 3, z],
        horizontal ? [ARENA_HALF * 2, 6, 1] : [1, 6, ARENA_HALF * 2],
        "#6d6f74",
        "tex-grade",
        { roughness: 0.6, metalness: 0.35 },
      ),
    );
  }
}

export function buildArena(): { scene: SceneData; meta: ArenaMeta; settings: Project["settings"] } {
  const nodes: Node3D[] = [];
  const breakables: Record<string, BreakProfile> = {};
  const npcs: string[] = [];
  const jellies: string[] = [];
  const targets: string[] = [];

  /* ------------------------------------------------------------- piso --- */
  nodes.push(
    brute("gf-floor", "Pátio", [0, -0.5, 0], [ARENA_HALF * 2, 1, ARENA_HALF * 2], "#5c5f63", "tex-concreto", {
      roughness: 0.85,
    }),
  );
  nodes.push(
    brute("gf-floor-paint", "Demarcação central", [0, 0.02, 0], [26, 0.06, 26], "#6a6d52", "tex-aviso", {
      receiveShadow: true,
    }),
  );
  nodes.push(
    brute("gf-floor-blood", "Zona de gore", [-14, 0.03, 14], [18, 0.06, 18], "#6e4a44", "tex-sangue", {
      receiveShadow: true,
    }),
  );

  /* --------------------------------------------------- paredes e torres --- */
  nodes.push(
    brute("gf-wall-back", "Paredão", [0, 4, -26], [30, 8, 1], "#8d8880", "tex-concreto"),
    brute("gf-wall-left", "Muro oeste", [-26, 3, -6], [1, 6, 26], "#8d8880", "tex-concreto"),
    brute("gf-roof", "Telhado do galpão", [-20, 7.4, -14], [14, 0.5, 14], "#6b6f75", "tex-metal"),
    brute("gf-column-a", "Coluna A", [-14.5, 3.6, -14], [1, 7.4, 1], "#7b7f85", "tex-metal"),
    brute("gf-column-b", "Coluna B", [-25.5, 3.6, -14], [1, 7.4, 1], "#7b7f85", "tex-metal"),
    brute("gf-column-c", "Coluna C", [-14.5, 3.6, -7], [1, 7.4, 1], "#7b7f85", "tex-metal"),
    brute("gf-column-d", "Coluna D", [-25.5, 3.6, -7], [1, 7.4, 1], "#7b7f85", "tex-metal"),
    brute("gf-ramp", "Rampa de acesso", [16, 1.4, -20], [8, 0.6, 12], "#7d8288", "tex-metal", {
      rotation: [-18, 0, 0],
      metalness: 0.4,
    }),
    brute("gf-platform-a", "Mezanino A", [20, 4.2, 6], [10, 0.5, 10], "#6f7479", "tex-grade"),
    brute("gf-platform-b", "Mezanino B", [6, 6.4, 14], [8, 0.5, 8], "#6f7479", "tex-grade"),
    brute("gf-bridge", "Passarela", [13, 5.2, 10], [8, 0.4, 1.6], "#7a7f84", "tex-grade"),
    brute("gf-stairs-1", "Degrau 1", [26, 0.6, -6], [4, 1.2, 4], "#75797f", "tex-concreto"),
    brute("gf-stairs-2", "Degrau 2", [26, 1.8, -10], [4, 2.4, 4], "#75797f", "tex-concreto"),
    brute("gf-stairs-3", "Degrau 3", [26, 3, -14], [4, 3.6, 4], "#75797f", "tex-concreto"),
  );

  /* --------------------------------------------------------- pátio --- */
  const crates: [number, number, number][] = [
    [-6, 0.45, -4],
    [-4.6, 0.45, -5.2],
    [-5.3, 1.36, -4.6],
    [3, 0.45, -3],
    [4.4, 0.45, -2.4],
    [3.7, 1.36, -2.7],
    [-10, 0.45, 6],
    [8, 0.45, 4],
    [9.4, 0.45, 4.8],
    [8.7, 1.36, 4.4],
  ];
  crates.forEach(([x, y, z], i) => {
    const id = `gf-crate-${i}`;
    nodes.push(
      prop(id, `Caixote ${i + 1}`, [x, y, z], [0.92, 0.92, 0.92], "#b07a3c", "tex-madeira", {
        mass: 9,
      }),
    );
    breakables[id] = { hp: 55, material: "madeira", chunks: 9 };
  });

  const barrels: [number, number, number][] = [
    [1.5, 0.6, 6.5],
    [2.9, 0.6, 7.6],
    [-2.5, 0.6, 9.5],
    [12, 0.6, -6],
    [-11.5, 0.6, -10],
  ];
  barrels.forEach(([x, y, z], i) => {
    const id = `gf-barrel-${i}`;
    nodes.push(
      makeNode("cylinder", {
        id,
        name: `Barril explosivo ${i + 1}`,
        position: [x, y, z],
        scale: [1, 1.2, 1],
        color: "#d1493f",
        textureId: "tex-metal",
        physics: "dynamic",
        mass: 22,
        restitution: 0.1,
        friction: 0.45,
        metalness: 0.45,
        roughness: 0.4,
      }),
    );
    breakables[id] = {
      hp: 40,
      material: "explosivo",
      chunks: 8,
      explosive: { radius: 6.5, force: 30, damage: 130 },
    };
  });

  nodes.push(
    prop("gf-glass-1", "Vitrine", [0.5, 1.6, -14], [3.2, 2.4, 0.12], "#9fd8e8", null, {
      mass: 6,
      roughness: 0.06,
      metalness: 0.1,
    }),
    prop("gf-glass-2", "Vitrine alta", [6.5, 1.9, -14], [2.4, 3, 0.12], "#9fd8e8", null, {
      mass: 6,
      roughness: 0.06,
      metalness: 0.1,
    }),
    prop("gf-tank-1", "Botijão", [-8.5, 0.95, -8], [1.3, 1.9, 1.3], "#f0c04a", null, {
      mass: 34,
      roughness: 0.3,
      metalness: 0.5,
    }),
    prop("gf-plank-1", "Tábua larga", [18, 0.3, 16], [1, 0.14, 6], "#c08a4a", "tex-madeira", {
      mass: 14,
    }),
    makeNode("sphere", {
      id: "gf-ball-1",
      name: "Bola de demolição",
      position: [24, 1.9, 18],
      scale: [1.9, 1.9, 1.9],
      color: "#3f454c",
      physics: "dynamic",
      mass: 120,
      restitution: 0.12,
      friction: 0.6,
      metalness: 0.8,
      roughness: 0.35,
    }),
  );
  breakables["gf-glass-1"] = { hp: 12, material: "vidro", chunks: 14 };
  breakables["gf-glass-2"] = { hp: 12, material: "vidro", chunks: 14 };
  breakables["gf-tank-1"] = {
    hp: 55,
    material: "explosivo",
    chunks: 10,
    explosive: { radius: 9, force: 42, damage: 190 },
  };
  breakables["gf-plank-1"] = { hp: 40, material: "madeira", chunks: 6 };

  /* --------------------------------------------- tanque de gelatina --- */
  nodes.push(
    jellyNode("gf-jelly-a", "Gelatina gigante", [-8, 1.1, 12], [2.4, 2.4, 2.4], "#6ff0c0", "box", 44, {
      mass: 18,
    }),
    jellyNode("gf-jelly-b", "Esfera mole", [-12.5, 1.4, 15], [2.4, 2.4, 2.4], "#57d8ae", "sphere", 56, {
      mass: 14,
    }),
    jellyNode("gf-jelly-c", "Gota viscosa", [-5, 1.2, 17], [1.8, 1.8, 1.8], "#9be7ff", "sphere", 28, {
      mass: 10,
      fluidity: 0.85,
      maxStretch: 2,
    }),
    jellyNode("gf-jelly-d", "Cubo firme", [-16, 0.8, 18], [1.5, 1.5, 1.5], "#7cf0b8", "box", 140, {
      mass: 12,
    }),
    jellyNode("gf-jelly-pad-1", "Trampolim elástico", [4, 1.4, 18], [4.4, 0.6, 4.4], "#6fd8ff", "box", 62, {
      static: true,
    }),
    jellyNode("gf-jelly-pad-2", "Trampolim alto", [10, 3.4, 18], [3.6, 0.6, 3.6], "#8fd8ff", "box", 78, {
      static: true,
    }),
  );
  jellies.push("gf-jelly-a", "gf-jelly-b", "gf-jelly-c", "gf-jelly-d", "gf-jelly-pad-1", "gf-jelly-pad-2");

  /* ------------------------------------------------ linha de tiro --- */
  for (let i = 0; i < 5; i++) {
    const id = `gf-target-${i}`;
    nodes.push(
      makeNode("cylinder", {
        id,
        name: `Alvo ${i + 1}`,
        position: [-14 + i * 3.4, 1.5, -20],
        rotation: [90, 0, 0],
        scale: [1.1, 0.3, 1.1],
        color: i % 2 ? "#e0512f" : "#f0e2c0",
        physics: "dynamic",
        mass: 6,
        restitution: 0.2,
        friction: 0.4,
      }),
    );
    targets.push(id);
    breakables[id] = { hp: 65, material: "madeira", chunks: 7 };
  }
  nodes.push(
    brute("gf-range-wall", "Muro de impacto", [-14 + 6.8, 2.4, -24.4], [18, 4.8, 0.6], "#9a958c", "tex-concreto"),
    brute("gf-range-bench", "Bancada de tiro", [-13, 0.55, -12], [12, 1.1, 1.2], "#77736b", "tex-madeira"),
  );

  /* -------------------------------------------------- arena de NPCs --- */
  nodes.push(
    brute("gf-pit-wall-a", "Borda oeste", [-30, 1.4, 4], [1, 2.8, 16], "#7c8087", "tex-concreto"),
    brute("gf-pit-wall-b", "Borda leste", [-30, 1.4, 22], [1, 2.8, 16], "#7c8087", "tex-concreto"),
    brute("gf-stand", "Arquibancada", [-24, 1.2, 28], [14, 2.4, 3], "#6e7278", "tex-grade", {
      rotation: [-6, 0, 0],
    }),
  );
  const bots = [
    ["gf-bot-1", "Caçador 1", [-24, 1, 8], "#b4553f", "attack", 13],
    ["gf-bot-2", "Caçador 2", [-21, 1, 11], "#b4553f", "attack", 13],
    ["gf-bot-3", "Patrulha 1", [-26, 1, 16], "#7ea2c9", "patrol", 8],
    ["gf-bot-4", "Seguidor", [-19, 1, 18], "#8fbf7a", "follow", 7],
  ] as const;
  for (const [id, name, position, color, bot, damage] of bots) {
    nodes.push(
      botNode(id, name, position as Vec3, color, {
        bot: bot as ActorSettings["bot"],
        damage,
        health: 120,
        detection: 26,
        attackRange: 2,
        cooldown: 1,
        radius: 7,
        speed: 4.4,
      }),
    );
    npcs.push(id);
  }
  // Gelatinas humanoides: contam no limite de 12 rigs da engine, então vão só duas.
  nodes.push(
    botNode("gf-bot-jelly-1", "Bruto de gelatina", [-27, 1.2, 12], "#7cf0b8", {
      bot: "follow",
      damage: 9,
      health: 180,
      jelly: true,
      mass: 14,
      speed: 3.6,
    }),
    botNode("gf-bot-jelly-2", "Gosma caçadora", [-23, 1.2, 24], "#9be7ff", {
      bot: "attack",
      damage: 11,
      health: 150,
      jelly: true,
      mass: 12,
      speed: 4,
    }),
  );
  jellies.push("gf-bot-jelly-1", "gf-bot-jelly-2");
  npcs.push("gf-bot-jelly-1", "gf-bot-jelly-2");

  /* -------------------------------------------------- torre de queda --- */
  nodes.push(
    brute("gf-tower-base", "Base da torre", [26, 0.6, 24], [7, 1.2, 7], "#6f7379", "tex-concreto"),
    brute("gf-tower-c1", "Pilar 1", [23.5, 6, 21.5], [0.8, 12, 0.8], "#7b7f85", "tex-metal"),
    brute("gf-tower-c2", "Pilar 2", [28.5, 6, 21.5], [0.8, 12, 0.8], "#7b7f85", "tex-metal"),
    brute("gf-tower-c3", "Pilar 3", [23.5, 6, 26.5], [0.8, 12, 0.8], "#7b7f85", "tex-metal"),
    brute("gf-tower-c4", "Pilar 4", [28.5, 6, 26.5], [0.8, 12, 0.8], "#7b7f85", "tex-metal"),
    brute("gf-tower-top", "Plataforma de salto", [26, 12.4, 24], [6.4, 0.5, 6.4], "#8b8f95", "tex-grade"),
    brute("gf-tower-ramp-1", "Rampa 1", [26, 3.4, 17.5], [4, 0.5, 8], "#7d8288", "tex-metal", {
      rotation: [24, 0, 0],
    }),
    brute("gf-tower-ramp-2", "Rampa 2", [19, 7.4, 24], [8, 0.5, 4], "#7d8288", "tex-metal", {
      rotation: [0, 0, -24],
    }),
  );

  /* ---------------------------------------------------------- luzes --- */
  nodes.push(
    makeNode("cylinder", {
      id: "gf-lamp-1",
      name: "Refletor central",
      position: [0, 8.5, 0],
      scale: [0.5, 0.5, 0.5],
      color: "#ffdca8",
      physics: "static",
      light: {
        type: "point",
        enabled: true,
        color: "#ffd8a0",
        intensity: 14,
        distance: 34,
        decay: 1.8,
        angle: 50,
        penumbra: 0.5,
        shadows: false,
        flicker: 0.08,
        flickerSpeed: 6,
      },
    }),
    makeNode("cylinder", {
      id: "gf-lamp-2",
      name: "Refletor da arena",
      position: [-25, 6.5, 14],
      scale: [0.5, 0.5, 0.5],
      color: "#ff5c4d",
      physics: "static",
      light: {
        type: "point",
        enabled: true,
        color: "#ff8a5c",
        intensity: 11,
        distance: 26,
        decay: 1.9,
        angle: 52,
        penumbra: 0.5,
        shadows: false,
        flicker: 0.14,
        flickerSpeed: 9,
      },
    }),
  );

  fences(nodes);

  /* -------------------------------------------------------- jogador --- */
  nodes.push(
    makeNode("box", {
      id: PLAYER_ID,
      name: "Sujeito da Forja",
      position: [0, 1.2, 14],
      scale: [0.72, 1.75, 0.72],
      color: "#3f6d75",
      physics: "dynamic",
      behavior: "player",
      mass: 18,
      restitution: 0,
      friction: 0,
      speed: 6.4,
      actor: {
        ...actorDefaults,
        humanoid: true,
        health: 100,
        bot: "off",
        ragdollOnDeath: true,
        skin: "#d7ab84",
      },
    }),
  );

  const scene: SceneData = {
    id: "goreforge-arena",
    name: "Pátio da Forja",
    nodes,
  };
  const settings: Project["settings"] = {
    background: "#4a4a52",
    gravity: -20,
    gameCamera: "first",
    playerId: PLAYER_ID,
    textureTile: 2.2,
    textures: arenaTextures,
    shadows: {
      ...shadowDefaults,
      resolution: 2048,
      coverage: 78,
      softness: 3,
      intensity: 0.9,
      sunPower: 3.2,
      ambientPower: 1.15,
      follow: true,
    },
    sky: { enabled: true, sunElevation: 26, sunAzimuth: 128, clouds: true },
    volume: 0.85,
    fov: 82,
    physicsHz: 120,
    solverIterations: 16,
    moveMultiplier: 1,
    sprintMultiplier: 1.6,
    jumpSpeed: 7.4,
  };

  const zones: ArenaZone[] = [
    {
      id: "patio",
      name: "Pátio central",
      center: [0, 0, 0],
      radius: 14,
      hint: "Caixotes, barris e torres: mire nos explosivos para a reação em cadeia.",
    },
    {
      id: "range",
      name: "Linha de tiro",
      center: [-13, 0, -18],
      radius: 10,
      hint: "Alvos móveis e vitrines. Teste precisão, penetração e headshots.",
    },
    {
      id: "jelly",
      name: "Tanque de gelatina",
      center: [-8, 0, 16],
      radius: 12,
      hint: "Corpos elásticos da engine: empurre, atire e observe a deformação.",
    },
    {
      id: "pits",
      name: "Arena de NPCs",
      center: [-24, 0, 14],
      radius: 12,
      hint: "Caçadores e gelatinas humanoides. Ragdoll e desmembramento ao morrer.",
    },
    {
      id: "tower",
      name: "Torre de queda",
      center: [26, 0, 24],
      radius: 9,
      hint: "12 m de plataforma. Use dash no ar e veja o impacto no piso de gore.",
    },
  ];

  return {
    scene,
    settings,
    meta: {
      name: "PÁTIO DA FORJA",
      playerId: PLAYER_ID,
      spawn: [0, 1.4, 14],
      zones,
      breakables,
      npcs,
      jellies,
      targets,
    },
  };
}

/** Projeto completo (uma cena) — usado pelo exportador e pelos testes. */
export function arenaProject(): { project: Project; meta: ArenaMeta } {
  const { scene, settings, meta } = buildArena();
  return {
    project: {
      format: "gameforge",
      version: 7,
      name: "GORE FORGE · Pátio da Forja",
      activeScene: scene.id,
      scenes: [scene],
      settings,
    },
    meta,
  };
}
