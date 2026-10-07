/**
 * Catálogo do menu de spawn ("Toolbox de destruição").
 *
 * Cada item é um patch no formato `applyNodePatch` + comando `spawn` da engine,
 * então TUDO que aparece aqui nasce dentro do mesmo mundo físico (Cannon-es),
 * com deformação elástica e contatos reais — não existe caminho paralelo.
 *
 * `hp` alimenta o sistema de destruição (fratura em estilhaços) e `tags`
 * alimenta a busca do menu. Adicionar um item novo = uma linha de dados.
 */
export interface Spawnable {
  id: string;
  name: string;
  icon: string;
  category: string;
  description: string;
  tags: string[];
  /** Vida para fraturar; 0 = indestrutível. */
  hp: number;
  /** Material da superfície: define faísca/poeira/som de impacto. */
  material: "madeira" | "metal" | "concreto" | "vidro" | "gelatina" | "tecido" | "explosivo";
  /** Chunks gerados ao destruir (0 = some em partículas). */
  chunks: number;
  /** Explode ao ser destruído. */
  explosive?: { radius: number; force: number; damage: number };
  /** Peso no orçamento de spawn (npcLimit / maxSpawned). */
  weight: number;
  patch: Record<string, unknown>;
}

export const spawnCategories = [
  "Gelatina",
  "Caixas e blocos",
  "Explosivos",
  "Veículos e peças",
  "Bonecos",
  "NPCs",
  "Cenário",
] as const;

const jelly = (stiffness: number, extra: Record<string, unknown> = {}) => ({
  deform: {
    type: "jelly" as const,
    stiffness,
    damping: 2.4,
    volume: 0.9,
    maxStretch: 1.8,
    fluidity: 0,
    intensity: 1.4,
    movementInfluence: 1.2,
    maintainRadius: true,
    radiusConstraint: 0.28,
    surfaceCollision: true,
    ...extra,
  },
});

interface NpcOptions {
  bot?: "off" | "patrol" | "follow" | "attack";
  health?: number;
  detection?: number;
  attackRange?: number;
  damage?: number;
  cooldown?: number;
  speed?: number;
  radius?: number;
  skin?: string;
  mass?: number;
  actor?: Record<string, unknown>;
}
/** Humanoide jogável pela IA da engine (bot patrol/follow/attack) + ragdoll ao morrer. */
const npc = (options: NpcOptions = {}) => ({
  actor: {
    humanoid: true,
    health: options.health ?? 100,
    ragdollOnDeath: true,
    bot: options.bot ?? "off",
    skin: options.skin ?? "#ddb48d",
    animationSpeed: 1,
    radius: options.radius ?? 4,
    detection: options.detection ?? 18,
    attackRange: options.attackRange ?? 1.8,
    damage: options.damage ?? 9,
    cooldown: options.cooldown ?? 1.1,
    ...options.actor,
  },
  physics: "dynamic",
  mass: options.mass ?? 16,
  friction: 0,
  restitution: 0,
  speed: options.speed ?? 4.2,
});

export const spawnables: Spawnable[] = [
  /* ---------------------------------------------------------- gelatina --- */
  {
    id: "jelly-cube",
    name: "Cubo de gelatina",
    icon: "🟩",
    category: "Gelatina",
    description: "Bloco elástico livre. Empurra o que estiver na frente e volta à forma.",
    tags: ["gelatina", "mole", "fisica"],
    hp: 120,
    material: "gelatina",
    chunks: 6,
    weight: 1,
    patch: {
      kind: "box",
      name: "Cubo de gelatina",
      scale: [0.9, 0.9, 0.9],
      color: "#6ff0c0",
      physics: "dynamic",
      mass: 6,
      restitution: 0.15,
      friction: 0.4,
      ...jelly(52),
    },
  },
  {
    id: "jelly-boulder",
    name: "Pedra de gelatina",
    icon: "🟢",
    category: "Gelatina",
    description: "Esfera macia grande. Rola, achata no chão e volta pulando.",
    tags: ["gelatina", "esfera", "mole"],
    hp: 200,
    material: "gelatina",
    chunks: 8,
    weight: 2,
    patch: {
      kind: "sphere",
      name: "Pedra de gelatina",
      scale: [1.6, 1.6, 1.6],
      color: "#57d8ae",
      physics: "dynamic",
      mass: 10,
      restitution: 0.3,
      friction: 0.5,
      ...jelly(58),
    },
  },
  {
    id: "jelly-drop",
    name: "Gota viscosa",
    icon: "💧",
    category: "Gelatina",
    description: "Corpo com pressão interna (fluidity 0.85). Espirra e se refaz.",
    tags: ["gelatina", "viscosa", "pressao"],
    hp: 160,
    material: "gelatina",
    chunks: 10,
    weight: 2,
    patch: {
      kind: "sphere",
      name: "Gota viscosa",
      scale: [1.2, 1.2, 1.2],
      color: "#9be7ff",
      physics: "dynamic",
      mass: 8,
      restitution: 0.05,
      ...jelly(28, { fluidity: 0.85, damping: 3, maxStretch: 2, volume: 0.97 }),
    },
  },
  {
    id: "jelly-plat",
    name: "Plataforma elástica",
    icon: "🛏️",
    category: "Gelatina",
    description: "Ancorada no ar: cede ao peso e devolve o pulo. Ótima para parkour.",
    tags: ["gelatina", "plataforma", "ancorada"],
    hp: 0,
    material: "gelatina",
    chunks: 0,
    weight: 3,
    patch: {
      kind: "box",
      name: "Plataforma elástica",
      scale: [4.2, 0.5, 4.2],
      color: "#6fd8ff",
      physics: "static",
      restitution: 0.1,
      ...jelly(64, { movementInfluence: 0.9, radiusConstraint: 0.45 }),
    },
  },
  {
    id: "jelly-man",
    name: "Zumbi de gelatina",
    icon: "🧟",
    category: "Gelatina",
    description: "NPC elástico que anda atrás de você. Derruba e se dobra nos impactos.",
    tags: ["gelatina", "npc", "zumbi"],
    hp: 180,
    material: "gelatina",
    chunks: 12,
    weight: 3,
    patch: {
      name: "Zumbi de gelatina",
      kind: "box",
      scale: [0.86, 1.8, 0.7],
      color: "#7cf0b8",
      ...npc({ bot: "follow", speed: 3.4, damage: 7, skin: "#b6ffdc" }),
      ...jelly(48),
    },
  },

  /* ---------------------------------------------------- caixas e blocos --- */
  {
    id: "crate",
    name: "Caixote",
    icon: "📦",
    category: "Caixas e blocos",
    description: "Quebra em 9 pedaços de madeira com a força do impacto.",
    tags: ["madeira", "caixa", "destrutivel"],
    hp: 55,
    material: "madeira",
    chunks: 9,
    weight: 1,
    patch: {
      kind: "box",
      name: "Caixote",
      scale: [0.9, 0.9, 0.9],
      color: "#b07a3c",
      physics: "dynamic",
      mass: 8,
      restitution: 0.1,
      friction: 0.5,
      textureId: "tex-madeira",
    },
  },
  {
    id: "crate-big",
    name: "Contêiner",
    icon: "🧱",
    category: "Caixas e blocos",
    description: "Caixa grande de 2,4 m. Vira uma pilha de destroços pesada.",
    tags: ["madeira", "grande", "destrutivel"],
    hp: 140,
    material: "madeira",
    chunks: 12,
    weight: 3,
    patch: {
      kind: "box",
      name: "Contêiner",
      scale: [2.4, 1.6, 2.4],
      color: "#8d6a3f",
      physics: "dynamic",
      mass: 40,
      restitution: 0.05,
      friction: 0.6,
      textureId: "tex-madeira",
    },
  },
  {
    id: "block",
    name: "Bloco de concreto",
    icon: "🧊",
    category: "Caixas e blocos",
    description: "Pesado, teimoso e ótimo para esmagar. Fratura em pedra.",
    tags: ["concreto", "pesado", "destrutivel"],
    hp: 260,
    material: "concreto",
    chunks: 10,
    weight: 4,
    patch: {
      kind: "box",
      name: "Bloco de concreto",
      scale: [1.6, 1.6, 1.6],
      color: "#9aa0a6",
      physics: "dynamic",
      mass: 60,
      restitution: 0.02,
      friction: 0.7,
      textureId: "tex-concreto",
    },
  },
  {
    id: "glass",
    name: "Painel de vidro",
    icon: "🔷",
    category: "Caixas e blocos",
    description: "Estilhaça no primeiro tiro. Cacos cortantes voando.",
    tags: ["vidro", "quebravel", "fino"],
    hp: 12,
    material: "vidro",
    chunks: 14,
    weight: 1,
    patch: {
      kind: "box",
      name: "Painel de vidro",
      scale: [2.6, 2, 0.1],
      color: "#9fd8e8",
      roughness: 0.06,
      metalness: 0.1,
      physics: "dynamic",
      mass: 6,
      restitution: 0.15,
      friction: 0.3,
    },
  },
  {
    id: "steel",
    name: "Chapa de aço",
    icon: "⬜",
    category: "Caixas e blocos",
    description: "Aguenta muito tiro. Serve de escudo e rampa.",
    tags: ["metal", "escudo", "duro"],
    hp: 420,
    material: "metal",
    chunks: 6,
    weight: 4,
    patch: {
      kind: "box",
      name: "Chapa de aço",
      scale: [3, 2, 0.16],
      color: "#8f97a1",
      roughness: 0.35,
      metalness: 0.65,
      physics: "dynamic",
      mass: 70,
      restitution: 0.05,
      friction: 0.5,
      textureId: "tex-metal",
    },
  },
  {
    id: "domino",
    name: "Dominó (10 peças)",
    icon: "🁣",
    category: "Caixas e blocos",
    description: "Fila de dominós prontos para o efeito cascata.",
    tags: ["fisica", "cascata", "madeira"],
    hp: 0,
    material: "madeira",
    chunks: 0,
    weight: 2,
    patch: {
      name: "Dominó",
      kind: "group",
      spawnRow: { count: 10, step: [0.42, 0, 0.06], kind: "box", scale: [0.3, 0.9, 0.12], color: "#e0d6c0", mass: 3, physics: "dynamic" },
    },
  },

  /* ----------------------------------------------------------- explosivos --- */
  {
    id: "barrel",
    name: "Barril explosivo",
    icon: "🛢️",
    category: "Explosivos",
    description: "Quando estoura, arremessa tudo em 6 m e destrói o que estiver perto.",
    tags: ["explosivo", "barril", "reacao"],
    hp: 40,
    material: "explosivo",
    chunks: 8,
    weight: 2,
    explosive: { radius: 6.5, force: 30, damage: 130 },
    patch: {
      kind: "cylinder",
      name: "Barril explosivo",
      scale: [1, 1.2, 1],
      color: "#d1493f",
      roughness: 0.4,
      metalness: 0.45,
      physics: "dynamic",
      mass: 22,
      restitution: 0.1,
      friction: 0.45,
      textureId: "tex-metal",
    },
  },
  {
    id: "tank",
    name: "Botijão de gás",
    icon: "💣",
    category: "Explosivos",
    description: "Explosão maior: 9 m, força 42. Cuidado com a reação em cadeia.",
    tags: ["explosivo", "grande", "reacao"],
    hp: 55,
    material: "explosivo",
    chunks: 10,
    weight: 3,
    explosive: { radius: 9, force: 42, damage: 190 },
    patch: {
      kind: "cylinder",
      name: "Botijão de gás",
      scale: [1.3, 1.9, 1.3],
      color: "#f0c04a",
      roughness: 0.3,
      metalness: 0.5,
      physics: "dynamic",
      mass: 34,
      restitution: 0.08,
      friction: 0.4,
    },
  },
  {
    id: "mine",
    name: "Mina de contato",
    icon: "⚡",
    category: "Explosivos",
    description: "Fica no chão e detona no primeiro corpo que tocar.",
    tags: ["explosivo", "armadilha"],
    hp: 20,
    material: "explosivo",
    chunks: 4,
    weight: 1,
    explosive: { radius: 4.5, force: 22, damage: 95 },
    patch: {
      kind: "cylinder",
      name: "Mina de contato",
      scale: [0.7, 0.24, 0.7],
      color: "#5a636b",
      metalness: 0.6,
      physics: "dynamic",
      mass: 6,
      restitution: 0,
      friction: 0.8,
      emissive: "#ff3b30",
    },
  },
  {
    id: "powder",
    name: "Barrica de pólvora",
    icon: "🧨",
    category: "Explosivos",
    description: "Explosão enorme e lenta: 12 m de raio para testes de estresse.",
    tags: ["explosivo", "estresse", "grande"],
    hp: 30,
    material: "explosivo",
    chunks: 12,
    weight: 5,
    explosive: { radius: 12, force: 52, damage: 240 },
    patch: {
      kind: "box",
      name: "Barrica de pólvora",
      scale: [1.4, 1.6, 1.4],
      color: "#6b4b2a",
      physics: "dynamic",
      mass: 24,
      restitution: 0.05,
      friction: 0.6,
      textureId: "tex-madeira",
    },
  },

  /* ----------------------------------------------------- veículos e peças --- */
  {
    id: "ball",
    name: "Bola de demolição",
    icon: "⚫",
    category: "Veículos e peças",
    description: "Esfera de 120 kg. Estoura tudo que estiver no caminho.",
    tags: ["fisica", "pesada", "rolando"],
    hp: 999,
    material: "metal",
    chunks: 0,
    weight: 5,
    patch: {
      kind: "sphere",
      name: "Bola de demolição",
      scale: [1.8, 1.8, 1.8],
      color: "#3f454c",
      metalness: 0.8,
      roughness: 0.35,
      physics: "dynamic",
      mass: 120,
      restitution: 0.25,
      friction: 0.6,
    },
  },
  {
    id: "wheel",
    name: "Pneu",
    icon: "🛞",
    category: "Veículos e peças",
    description: "Roda macia: rola longe e quica nos obstáculos.",
    tags: ["fisica", "roda", "borracha"],
    hp: 90,
    material: "tecido",
    chunks: 6,
    weight: 2,
    patch: {
      kind: "torus",
      name: "Pneu",
      scale: [1.1, 1.1, 1.1],
      color: "#22262b",
      roughness: 0.9,
      physics: "dynamic",
      mass: 18,
      restitution: 0.42,
      friction: 0.8,
    },
  },
  {
    id: "plank",
    name: "Tábua",
    icon: "🪵",
    category: "Veículos e peças",
    description: "Rampa improvisada. Três tábuas fazem uma ponte.",
    tags: ["madeira", "rampa", "construcao"],
    hp: 35,
    material: "madeira",
    chunks: 5,
    weight: 1,
    patch: {
      kind: "box",
      name: "Tábua",
      scale: [0.35, 0.12, 3.2],
      color: "#c08a4a",
      physics: "dynamic",
      mass: 6,
      restitution: 0.05,
      friction: 0.6,
      textureId: "tex-madeira",
    },
  },
  {
    id: "ramp",
    name: "Rampa de aço",
    icon: "📐",
    category: "Veículos e peças",
    description: "Cunha estática para lançar carros, corpos e gelatina.",
    tags: ["rampa", "estatica", "construcao"],
    hp: 0,
    material: "metal",
    chunks: 0,
    weight: 3,
    patch: {
      kind: "wedge",
      name: "Rampa de aço",
      scale: [3.6, 1.6, 4.2],
      color: "#7e868f",
      metalness: 0.6,
      roughness: 0.4,
      physics: "static",
      textureId: "tex-metal",
    },
  },
  {
    id: "torre",
    name: "Torre de blocos",
    icon: "🏗️",
    category: "Veículos e peças",
    description: "Torre de 8 blocos para derrubar de uma vez.",
    tags: ["torre", "cascata", "estatica"],
    hp: 0,
    material: "concreto",
    chunks: 0,
    weight: 3,
    patch: {
      name: "Torre de blocos",
      kind: "group",
      spawnStack: { count: 8, step: [0, 0.62, 0], kind: "box", scale: [0.6, 0.6, 0.6], color: "#a8a29a", mass: 5, physics: "dynamic" },
    },
  },

  /* --------------------------------------------------------------- bonecos --- */
  {
    id: "dummy",
    name: "Boneco de treino",
    icon: "🎯",
    category: "Bonecos",
    description: "Humanoide parado com 200 de vida. Ótimo para medir dano.",
    tags: ["npc", "alvo", "humanoide"],
    hp: 200,
    material: "tecido",
    chunks: 0,
    weight: 2,
    patch: {
      name: "Boneco de treino",
      kind: "box",
      scale: [0.8, 1.8, 0.65],
      color: "#c9b28a",
      ...npc({ health: 200, bot: "off" }),
    },
  },
  {
    id: "ragdoll",
    name: "Ragdoll de teste",
    icon: "🕴️",
    category: "Bonecos",
    description: "Corpo articulado solto: cai em 6 partes com juntas reais.",
    tags: ["npc", "ragdoll", "fisica"],
    hp: 100,
    material: "tecido",
    chunks: 0,
    weight: 2,
    patch: {
      name: "Ragdoll de teste",
      kind: "box",
      scale: [0.8, 1.8, 0.65],
      color: "#8fa1b5",
      ...npc({}),
      deform: { type: "ragdoll" },
    },
  },
  {
    id: "npc-patrol",
    name: "Bot patrulha",
    icon: "🤖",
    category: "NPCs",
    description: "Anda num quadrado de 6 m. Reage à sua chegada.",
    tags: ["npc", "bot", "patrulha"],
    hp: 100,
    material: "tecido",
    chunks: 0,
    weight: 2,
    patch: {
      name: "Bot patrulha",
      kind: "box",
      scale: [0.8, 1.8, 0.65],
      color: "#7ea2c9",
      ...npc({ bot: "patrol", radius: 6, speed: 3.6 }),
    },
  },
  {
    id: "npc-hunter",
    name: "Caçador agressivo",
    icon: "☠️",
    category: "NPCs",
    description: "Persegue e ataca corpo a corpo. Aumenta a dificuldade do caos.",
    tags: ["npc", "bot", "ataque"],
    hp: 120,
    material: "tecido",
    chunks: 0,
    weight: 3,
    patch: {
      name: "Caçador agressivo",
      kind: "box",
      scale: [0.82, 1.8, 0.68],
      color: "#b4553f",
      ...npc({
        bot: "attack",
        speed: 4.8,
        damage: 13,
        cooldown: 0.9,
        detection: 26,
        attackRange: 2,
        skin: "#c9a07a",
      }),
    },
  },
  {
    id: "npc-horde",
    name: "Horda (6 caçadores)",
    icon: "🧟‍♂️",
    category: "NPCs",
    description: "Seis caçadores em leque. Teste de estresse de corpos e IA.",
    tags: ["npc", "horda", "estresse"],
    hp: 120,
    material: "tecido",
    chunks: 0,
    weight: 6,
    patch: {
      name: "Horda",
      kind: "group",
      spawnFan: {
        count: 6,
        radius: 3.2,
        arc: 2.2,
        kind: "box",
        scale: [0.82, 1.8, 0.68],
        color: "#9c4a3a",
        mass: 16,
        physics: "dynamic",
        speed: 4.4,
        actor: {
          humanoid: true,
          health: 110,
          ragdollOnDeath: true,
          bot: "attack",
          damage: 11,
          cooldown: 1,
          detection: 30,
          attackRange: 2,
        },
      },
    },
  },
  {
    id: "tower-bot",
    name: "Torre de NPCs",
    icon: "🗼",
    category: "NPCs",
    description: "Cinco bonecos empilhados que desabam como um só corpo mole.",
    tags: ["npc", "torre", "ragdoll"],
    hp: 100,
    material: "tecido",
    chunks: 0,
    weight: 4,
    patch: {
      name: "Torre de NPCs",
      kind: "group",
      spawnStack: {
        count: 5,
        step: [0, 1.85, 0],
        kind: "box",
        scale: [0.8, 1.8, 0.65],
        color: "#c1a48c",
        mass: 14,
        physics: "dynamic",
        actor: { humanoid: true, health: 80, ragdollOnDeath: true, bot: "off" },
      },
    },
  },

  /* --------------------------------------------------------------- cenário --- */
  {
    id: "wall",
    name: "Parede de concreto",
    icon: "🧱",
    category: "Cenário",
    description: "Parede estática de 4 m com textura de concreto.",
    tags: ["estatica", "parede", "construcao"],
    hp: 0,
    material: "concreto",
    chunks: 0,
    weight: 2,
    patch: {
      kind: "box",
      name: "Parede de concreto",
      scale: [4, 3, 0.4],
      color: "#b8b3aa",
      physics: "static",
      textureId: "tex-concreto",
    },
  },
  {
    id: "tower-scaffold",
    name: "Andaime",
    icon: "🪜",
    category: "Cenário",
    description: "Estrutura de 3 andares para subir e se jogar de cima.",
    tags: ["estatica", "altura", "parkour"],
    hp: 0,
    material: "metal",
    chunks: 0,
    weight: 3,
    patch: {
      name: "Andaime",
      kind: "group",
      scaffold: { floors: 3, height: 3.1, size: 4.4 },
    },
  },
  {
    id: "lamp",
    name: "Refletor industrial",
    icon: "💡",
    category: "Cenário",
    description: "Luz animada que pisca durante as explosões.",
    tags: ["luz", "cenario", "noite"],
    hp: 25,
    material: "metal",
    chunks: 3,
    weight: 1,
    patch: {
      kind: "cylinder",
      name: "Refletor industrial",
      scale: [0.4, 0.4, 0.4],
      color: "#ffdca8",
      physics: "static",
      emissive: "#ffdca8",
      light: {
        type: "point",
        enabled: true,
        color: "#ffd8a0",
        intensity: 12,
        distance: 16,
        decay: 2,
        shadows: false,
        angle: 40,
        penumbra: 0.5,
      },
    },
  },
];

export function spawnableFor(id: string) {
  return spawnables.find((s) => s.id === id) ?? spawnables[0];
}

/** Busca por nome/descrição/tags — usada pelo campo de pesquisa do menu. */
export function searchSpawnables(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return spawnables;
  return spawnables.filter((s) =>
    [s.name, s.description, s.category, ...s.tags]
      .join(" ")
      .toLowerCase()
      .includes(q),
  );
}

/** Quantos corpos um item cria (grupos fan/stack/row valem por vários). */
export function spawnUnitCount(item: Spawnable) {
  for (const key of ["spawnFan", "spawnStack", "spawnRow"] as const) {
    const group = item.patch[key] as { count?: unknown } | undefined;
    if (group && typeof group.count === "number" && Number.isFinite(group.count))
      return Math.max(1, Math.min(24, Math.round(group.count)));
  }
  const scaffold = item.patch.scaffold as { floors?: unknown } | undefined;
  if (scaffold && typeof scaffold.floors === "number")
    return Math.max(1, Math.round(scaffold.floors) * 4 + 1);
  return 1;
}

/** Peso total no orçamento de spawn. */
export function spawnWeight(item: Spawnable) {
  return spawnUnitCount(item) * item.weight;
}
