/** Componentes genéricos da 0.7: luzes por nó, lanterna e áudio sintetizado.
 * Nada aqui conhece jogos específicos — os projetos é que decidem o que a luz faz. */
export interface LightSettings {
  type: "none" | "point" | "spot";
  enabled: boolean;
  color: string;
  intensity: number;
  distance: number;
  decay: number;
  angle: number;
  penumbra: number;
  shadows: boolean;
  flicker: number;
  flickerSpeed: number;
}
export const lightDefaults: LightSettings = {
  type: "none",
  enabled: true,
  color: "#ffe3b6",
  intensity: 8,
  distance: 20,
  decay: 1.5,
  angle: 52,
  penumbra: 0.35,
  shadows: false,
  flicker: 0,
  flickerSpeed: 7,
};
export interface TorchSettings {
  enabled: boolean;
  color: string;
  intensity: number;
  distance: number;
  angle: number;
  penumbra: number;
  shadows: boolean;
  offset: [number, number, number];
}
export const torchDefaults: TorchSettings = {
  enabled: false,
  color: "#ffeed0",
  intensity: 26,
  distance: 30,
  angle: 33,
  penumbra: 0.45,
  shadows: false,
  offset: [0.24, -0.2, 0],
};
export const soundNames = [
  "clique",
  "porta.abrir",
  "porta.fechar",
  "porta.bater",
  "porta.trancada",
  "gaveta",
  "armario",
  "item",
  "moeda",
  "bateria",
  "chave",
  "gazua",
  "curativo",
  "lanterna",
  "lanterna.falha",
  "eletrico",
  "luz.estouro",
  "passo",
  "corrida",
  "rugido",
  "ambush",
  "screech",
  "sussurro",
  "olhos",
  "figura.passo",
  "figura.rugido",
  "seek.tambor",
  "seek.grito",
  "seek.parede",
  "halt",
  "coracao",
  "morte",
  "elevador",
  "tremor",
  "vento",
  "drone",
  "vidro",
  "trovao",
  "acerto",
  "vitoria",
  "aranha",
  "susto",
  "snare",
  "dupe",
  "vulto",
  "tosse",
] as const;
export type SoundName = (typeof soundNames)[number];
export const loopNames = [
  "vento",
  "drone",
  "coracao",
  "tambores",
  "passos.figura",
  "alarme",
  "aranha",
] as const;
const finite = (v: unknown, a: number, b: number) =>
  typeof v === "number" && Number.isFinite(v) && v >= a && v <= b;
const color = (v: unknown) => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
function check(v: unknown, message: string): asserts v {
  if (!v) throw Error(message);
}
export function validateLight(v: any): LightSettings {
  check(
    v &&
      ["none", "point", "spot"].includes(v.type) &&
      typeof v.enabled === "boolean" &&
      typeof v.shadows === "boolean" &&
      color(v.color),
    "Luz inválida.",
  );
  for (const [key, min, max] of [
    ["intensity", 0, 60],
    ["distance", 0, 120],
    ["decay", 0, 3],
    ["angle", 5, 90],
    ["penumbra", 0, 1],
    ["flicker", 0, 1],
    ["flickerSpeed", 0.5, 30],
  ] as const)
    check(finite(v[key], min, max), `Luz: ${key} inválido.`);
  return Object.fromEntries(
    Object.keys(lightDefaults).map((k) => [k, v[k]]),
  ) as unknown as LightSettings;
}
export function validateTorch(v: any): TorchSettings | undefined {
  if (v === undefined) return undefined;
  check(
    v &&
      typeof v.enabled === "boolean" &&
      typeof v.shadows === "boolean" &&
      color(v.color) &&
      Array.isArray(v.offset) &&
      v.offset.length === 3 &&
      v.offset.every((n: unknown) => finite(n, -3, 3)),
    "Lanterna inválida.",
  );
  for (const [key, min, max] of [
    ["intensity", 0, 60],
    ["distance", 0, 120],
    ["angle", 5, 90],
    ["penumbra", 0, 1],
  ] as const)
    check(finite(v[key], min, max), `Lanterna: ${key} inválido.`);
  return {
    enabled: v.enabled,
    color: v.color,
    intensity: v.intensity,
    distance: v.distance,
    angle: v.angle,
    penumbra: v.penumbra,
    shadows: v.shadows,
    offset: [...v.offset] as [number, number, number],
  };
}
/** Mescla um patch parcial de luz, mantendo tudo dentro dos limites da validação. */
export function mergeLight(base: LightSettings, patch: any): LightSettings {
  if (!patch || typeof patch !== "object") return base;
  const merged: any = { ...base };
  for (const key of ["type", "enabled", "color", "shadows"] as const)
    if (typeof patch[key] === typeof (base as any)[key]) merged[key] = patch[key];
  for (const [key, min, max] of [
    ["intensity", 0, 60],
    ["distance", 0, 120],
    ["decay", 0, 3],
    ["angle", 5, 90],
    ["penumbra", 0, 1],
    ["flicker", 0, 1],
    ["flickerSpeed", 0.5, 30],
  ] as const) {
    const value = (patch as any)[key];
    if (typeof value === "number" && Number.isFinite(value))
      merged[key] = Math.max(min, Math.min(max, value));
  }
  if (!color(merged.color)) merged.color = base.color;
  return merged;
}
