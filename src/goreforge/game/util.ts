import * as THREE from "three";

/** Utilidades pequenas e determinísticas compartilhadas pelos sistemas. */
export const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Interpolação independente do framerate. */
export const damp = (a: number, b: number, speed: number, dt: number) =>
  lerp(a, b, 1 - Math.exp(-speed * Math.min(dt, 0.1)));

export const TAU = Math.PI * 2;

/** PRNG determinístico (mulberry32) para fraturas e espalhamentos iguais. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(text: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Direção aleatória em cone (usada por spread de balas e jatos de sangue). */
export function coneDirection(
  direction: THREE.Vector3,
  spreadRadians: number,
  random: () => number,
  out = new THREE.Vector3(),
) {
  const angle = random() * TAU;
  const radius = Math.sqrt(random()) * spreadRadians;
  const up = Math.abs(direction.y) > 0.94 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(direction, up).normalize();
  const realUp = new THREE.Vector3().crossVectors(right, direction).normalize();
  out
    .copy(direction)
    .addScaledVector(right, Math.tan(radius) * Math.cos(angle))
    .addScaledVector(realUp, Math.tan(radius) * Math.sin(angle))
    .normalize();
  return out;
}

/** Projeta um ponto do mundo na tela (para números de dano e indicadores). */
export function projectToScreen(
  point: THREE.Vector3,
  camera: THREE.Camera,
  width: number,
  height: number,
) {
  const projected = point.clone().project(camera);
  return {
    x: (projected.x * 0.5 + 0.5) * width,
    y: (-projected.y * 0.5 + 0.5) * height,
    visible: projected.z < 1 && projected.z > -1,
  };
}

/** Nome curto de um nodeId para o killfeed ("gf-bot-1" → "Bot 1"). */
export function prettyId(id: string) {
  const clean = id.replace(/^gf-/, "").replace(/-/g, " ");
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

export function formatNumber(value: number, digits = 0) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatClock(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
