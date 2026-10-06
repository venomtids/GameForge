export interface ShadowSettings {
  enabled: boolean;
  filter: "soft" | "vsm";
  resolution: 512 | 1024 | 2048 | 4096;
  coverage: number;
  softness: number;
  bias: number;
  normalBias: number;
  intensity: number;
  sunPower: number;
  ambientPower: number;
  follow: boolean;
}
export const shadowDefaults: ShadowSettings = {
  enabled: true,
  filter: "soft",
  resolution: 2048,
  coverage: 50,
  softness: 3,
  bias: -0.0001,
  normalBias: 0.025,
  intensity: 0.85,
  sunPower: 3,
  ambientPower: 1.3,
  follow: true,
};
export interface ActorSettings {
  humanoid: boolean;
  skin: string;
  animationSpeed: number;
  health: number;
  ragdollOnDeath: boolean;
  bot: "off" | "patrol" | "follow" | "attack";
  radius: number;
  detection: number;
  attackRange: number;
  damage: number;
  cooldown: number;
}
export const actorDefaults: ActorSettings = {
  humanoid: false,
  skin: "#ddb48d",
  animationSpeed: 1,
  health: 100,
  ragdollOnDeath: true,
  bot: "off",
  radius: 4,
  detection: 16,
  attackRange: 1.6,
  damage: 8,
  cooldown: 1,
};
export interface DeformSettings {
  type: "none" | "ragdoll" | "jelly";
  stiffness: number;
  damping: number;
  /** Shape/volume recovery; optional for compatibility with old projects. */
  volume?: number;
  /** Maximum spring length relative to its rest length. */
  maxStretch?: number;
  /** Vertex response settings, optional in legacy schema7 projects. */
  intensity?: number;
  movementInfluence?: number;
  distanceFalloff?: number;
  maintainRadius?: boolean;
  radiusConstraint?: number;
  /** Offset from the mesh/joint pivot, in half-extents. */
  pivot?: [number, number, number];
  useLOD?: boolean;
  lodNear?: number;
  lodFar?: number;
  performance?: number;
}
export const deformDefaults: DeformSettings = {
  type: "none",
  stiffness: 100,
  damping: 3,
  volume: 0.85,
  maxStretch: 1.65,
  intensity: 1.2,
  movementInfluence: 1.25,
  distanceFalloff: 1.2,
  maintainRadius: true,
  radiusConstraint: 0.3,
  pivot: [0, 0, 0],
  useLOD: true,
  lodNear: 14,
  lodFar: 80,
  performance: 0,
};
const finite = (v: unknown, a: number, b: number) =>
  typeof v === "number" && Number.isFinite(v) && v >= a && v <= b;
function check(v: unknown, message: string): asserts v {
  if (!v) throw Error(message);
}
export function validateShadows(v: any): ShadowSettings | undefined {
  if (v === undefined) return undefined;
  check(
    v &&
      typeof v.enabled === "boolean" &&
      typeof v.follow === "boolean" &&
      ["soft", "vsm"].includes(v.filter) &&
      [512, 1024, 2048, 4096].includes(v.resolution),
    "Configurações de sombra inválidas.",
  );
  for (const [key, min, max] of [
    ["coverage", 10, 150],
    ["softness", 0, 8],
    ["bias", -0.01, 0.01],
    ["normalBias", 0, 0.2],
    ["intensity", 0, 1],
    ["sunPower", 0, 8],
    ["ambientPower", 0, 5],
  ] as const)
    check(finite(v[key], min, max), `Sombra: ${key} inválido.`);
  return Object.fromEntries(
    Object.keys(shadowDefaults).map((k) => [k, v[k]]),
  ) as unknown as ShadowSettings;
}
export function validateActor(v: any): ActorSettings {
  check(
    v &&
      typeof v.humanoid === "boolean" &&
      /^#[0-9a-f]{6}$/i.test(v.skin) &&
      typeof v.ragdollOnDeath === "boolean" &&
      ["off", "patrol", "follow", "attack"].includes(v.bot),
    "Personagem/bot inválido.",
  );
  for (const [key, min, max] of [
    ["animationSpeed", 0.1, 3],
    ["health", 1, 1000],
    ["radius", 0.5, 30],
    ["detection", 1, 60],
    ["attackRange", 0.5, 5],
    ["damage", 0, 100],
    ["cooldown", 0.2, 10],
  ] as const)
    check(finite(v[key], min, max), `Ator: ${key} inválido.`);
  return Object.fromEntries(
    Object.keys(actorDefaults).map((k) => [k, v[k]]),
  ) as unknown as ActorSettings;
}
export function validateDeform(v: any): DeformSettings {
  check(
    v &&
      ["none", "ragdoll", "jelly"].includes(v.type) &&
      finite(v.stiffness, 5, 180) &&
      finite(v.damping, 0.1, 8) &&
      (v.volume === undefined || finite(v.volume, 0, 1)) &&
      (v.maxStretch === undefined || finite(v.maxStretch, 1.1, 2.5)),
    "Física articulada/deformável inválida.",
  );
  for (const [key, min, max] of [
    ["intensity", 0, 3],
    ["movementInfluence", 0, 4],
    ["distanceFalloff", 0.1, 4],
    ["radiusConstraint", 0, 1],
    ["lodNear", 1, 50],
    ["lodFar", 10, 200],
    ["performance", 0, 1],
  ] as const)
    check(
      v[key] === undefined || finite(v[key], min, max),
      `Gelatina: ${key} inválido.`,
    );
  for (const key of ["maintainRadius", "useLOD"] as const)
    check(
      v[key] === undefined || typeof v[key] === "boolean",
      `Gelatina: ${key} inválido.`,
    );
  check(
    v.pivot === undefined ||
      (Array.isArray(v.pivot) &&
        v.pivot.length === 3 &&
        v.pivot.every((x: unknown) => finite(x, -2, 2))),
    "Pivô da gelatina inválido.",
  );
  check(
    (v.lodFar ?? 80) > (v.lodNear ?? 14),
    "LOD distante deve ser maior que LOD próximo.",
  );
  const optional = Object.fromEntries(
    [
      "intensity",
      "movementInfluence",
      "distanceFalloff",
      "maintainRadius",
      "radiusConstraint",
      "useLOD",
      "lodNear",
      "lodFar",
      "performance",
    ]
      .filter((k) => v[k] !== undefined)
      .map((k) => [k, v[k]]),
  );
  return {
    ...optional,
    ...(v.pivot === undefined
      ? {}
      : { pivot: [...v.pivot] as [number, number, number] }),
    type: v.type,
    stiffness: v.stiffness,
    damping: v.damping,
    ...(v.volume === undefined ? {} : { volume: v.volume }),
    ...(v.maxStretch === undefined ? {} : { maxStretch: v.maxStretch }),
  };
}
