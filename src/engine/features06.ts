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
}
export const deformDefaults: DeformSettings = {
  type: "none",
  stiffness: 80,
  damping: 3,
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
      finite(v.stiffness, 20, 180) &&
      finite(v.damping, 0.5, 8),
    "Física articulada/deformável inválida.",
  );
  return { type: v.type, stiffness: v.stiffness, damping: v.damping };
}
