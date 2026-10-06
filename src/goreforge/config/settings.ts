/**
 * Configuração de jogo do GORE FORGE.
 *
 * Tudo aqui é dado puro (sem THREE, sem DOM) para poder ser:
 *  - validado e testado no Node;
 *  - gravado/restaurado no localStorage;
 *  - exportado/importado como JSON pelo menu de Interface.
 *
 * Os valores são normalizados por `validateSettings`, então um JSON
 * incompleto, antigo ou com número fora da faixa nunca quebra o jogo.
 */
export type QualityMode = "auto" | "economy" | "high";
export type GoreLevel = "off" | "light" | "full" | "insane";

export interface GameSettings {
  /* ---------- movimento ---------- */
  walkSpeed: number;
  sprintSpeed: number;
  crouchSpeed: number;
  acceleration: number;
  groundFriction: number;
  airControl: number;
  jumpSpeed: number;
  doubleJump: boolean;
  coyoteTime: number;
  dashDistance: number;
  dashCooldown: number;
  slideBoost: number;
  slideFriction: number;
  fallDamage: number;

  /* ---------- combate ---------- */
  maxHealth: number;
  maxArmor: number;
  healthRegen: number;
  difficulty: number;
  headshotMultiplier: number;
  limbMultiplier: number;
  infiniteAmmo: boolean;
  friendlyFire: boolean;

  /* ---------- destruição e gore ---------- */
  gore: GoreLevel;
  bloodAmount: number;
  gibThreshold: number;
  dismember: boolean;
  maxDecals: number;
  destruction: boolean;
  explosiveForce: number;
  npcLimit: number;

  /* ---------- desempenho e gráficos ---------- */
  quality: QualityMode;
  fov: number;
  sensitivity: number;
  shake: number;
  particles: number;
  tracers: boolean;
  damageNumbers: boolean;
  viewmodel: boolean;

  /* ---------- interface ---------- */
  theme: string;
  hudLayout: "classico" | "compacto" | "minimalista" | "tatico";
  hudScale: number;
  hudOpacity: number;

  /* ---------- áudio ---------- */
  volume: number;
}

export const goreforgeDefaults: GameSettings = {
  walkSpeed: 6.4,
  sprintSpeed: 10.6,
  crouchSpeed: 3.1,
  acceleration: 62,
  groundFriction: 9.5,
  airControl: 0.32,
  jumpSpeed: 7.4,
  doubleJump: true,
  coyoteTime: 0.12,
  dashDistance: 6.5,
  dashCooldown: 1.4,
  slideBoost: 5.2,
  slideFriction: 2.6,
  fallDamage: 0.55,

  maxHealth: 100,
  maxArmor: 50,
  healthRegen: 3.5,
  difficulty: 1,
  headshotMultiplier: 2.6,
  limbMultiplier: 0.7,
  infiniteAmmo: false,
  friendlyFire: true,

  gore: "full",
  bloodAmount: 1,
  gibThreshold: 55,
  dismember: true,
  maxDecals: 160,
  destruction: true,
  explosiveForce: 1,
  npcLimit: 24,

  quality: "auto",
  fov: 82,
  sensitivity: 1.5,
  shake: 1,
  particles: 1,
  tracers: true,
  damageNumbers: true,
  viewmodel: true,

  theme: "ferro",
  hudLayout: "classico",
  hudScale: 1,
  hudOpacity: 1,

  volume: 0.85,
};

type Range = [number, number];

const ranges: Record<
  keyof Omit<
    GameSettings,
    | "doubleJump"
    | "infiniteAmmo"
    | "friendlyFire"
    | "dismember"
    | "destruction"
    | "tracers"
    | "damageNumbers"
    | "viewmodel"
    | "gore"
    | "quality"
    | "theme"
    | "hudLayout"
  >,
  Range
> = {
  walkSpeed: [1, 20],
  sprintSpeed: [1, 30],
  crouchSpeed: [0.5, 10],
  acceleration: [5, 200],
  groundFriction: [0.5, 40],
  airControl: [0, 1],
  jumpSpeed: [1, 20],
  coyoteTime: [0, 0.4],
  dashDistance: [0, 20],
  dashCooldown: [0, 6],
  slideBoost: [0, 16],
  slideFriction: [0.2, 20],
  fallDamage: [0, 3],
  maxHealth: [10, 500],
  maxArmor: [0, 300],
  healthRegen: [0, 30],
  difficulty: [0.25, 4],
  headshotMultiplier: [1, 8],
  limbMultiplier: [0.1, 2],
  bloodAmount: [0, 3],
  gibThreshold: [0, 400],
  maxDecals: [0, 600],
  explosiveForce: [0.1, 4],
  npcLimit: [0, 64],
  fov: [50, 120],
  sensitivity: [0.1, 5],
  shake: [0, 3],
  particles: [0, 2],
  hudScale: [0.6, 1.8],
  hudOpacity: [0.25, 1],
  volume: [0, 1],
};

const boolKeys = [
  "doubleJump",
  "infiniteAmmo",
  "friendlyFire",
  "dismember",
  "destruction",
  "tracers",
  "damageNumbers",
  "viewmodel",
] as const;
const goreLevels: GoreLevel[] = ["off", "light", "full", "insane"];
const qualityModes: QualityMode[] = ["auto", "economy", "high"];
const hudLayouts: GameSettings["hudLayout"][] = [
  "classico",
  "compacto",
  "minimalista",
  "tatico",
];

/** Normaliza qualquer objeto (JSON antigo, editado à mão) para GameSettings. */
export function validateSettings(raw: unknown): GameSettings {
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const out = { ...goreforgeDefaults } as GameSettings;
  for (const key of Object.keys(ranges) as (keyof typeof ranges)[]) {
    const value = input[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      const [min, max] = ranges[key];
      (out[key] as number) = Math.min(max, Math.max(min, value));
    }
  }
  for (const key of boolKeys)
    if (typeof input[key] === "boolean") out[key] = input[key] as boolean;
  if (goreLevels.includes(input.gore as GoreLevel))
    out.gore = input.gore as GoreLevel;
  if (qualityModes.includes(input.quality as QualityMode))
    out.quality = input.quality as QualityMode;
  if (hudLayouts.includes(input.hudLayout as GameSettings["hudLayout"]))
    out.hudLayout = input.hudLayout as GameSettings["hudLayout"];
  if (typeof input.theme === "string" && input.theme.length <= 24)
    out.theme = input.theme;
  return out;
}

/** Multiplicador de partículas/decalques por nível de gore (0 = desligado). */
export function goreScale(settings: GameSettings) {
  if (settings.gore === "off") return 0;
  const base =
    settings.gore === "light" ? 0.45 : settings.gore === "full" ? 1 : 1.6;
  return base * settings.bloodAmount;
}

export function goreEnabled(settings: GameSettings) {
  return settings.gore !== "off" && settings.bloodAmount > 0;
}

export const SETTINGS_KEY = "goreforge.settings.v1";

export function loadSettings(storage?: Storage | null): GameSettings {
  try {
    const store = storage ?? (typeof localStorage === "undefined" ? null : localStorage);
    const text = store?.getItem(SETTINGS_KEY);
    return text ? validateSettings(JSON.parse(text)) : { ...goreforgeDefaults };
  } catch {
    return { ...goreforgeDefaults };
  }
}

export function saveSettings(
  settings: GameSettings,
  storage?: Storage | null,
): boolean {
  try {
    const store = storage ?? (typeof localStorage === "undefined" ? null : localStorage);
    store?.setItem(SETTINGS_KEY, JSON.stringify(validateSettings(settings)));
    return !!store;
  } catch {
    return false;
  }
}
