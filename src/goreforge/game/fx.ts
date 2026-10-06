import * as THREE from "three";
import type { GameContext } from "./context";
import { clamp, coneDirection, rng } from "./util";

/**
 * Efeitos visuais do GORE FORGE: partículas (dois barramentos: aditivo e
 * translúcido), traçantes, cascas de bala, explosões e tremor de câmera.
 *
 * Tudo é POOLADO: nenhuma partícula cria geometria/material novo por impacto,
 * então rajadas de escopeta e reações em cadeia não enchem a memória de GPU.
 */
export type ParticleKind =
  | "faisca"
  | "poeira"
  | "lasca"
  | "vidro"
  | "sangue"
  | "carne"
  | "fumaca"
  | "fogo"
  | "plasma"
  | "gelatina"
  | "dissolver"
  | "casulo";

interface ParticleSpec {
  color: string;
  size: number;
  life: number;
  speed: number;
  gravity: number;
  drag: number;
  spread: number;
  additive: boolean;
  glow: number;
}

const specs: Record<ParticleKind, ParticleSpec> = {
  faisca: { color: "#ffd166", size: 0.06, life: 0.35, speed: 9, gravity: -14, drag: 4, spread: 1, additive: true, glow: 1 },
  poeira: { color: "#b9b2a4", size: 0.34, life: 1.5, speed: 2.2, gravity: -0.4, drag: 1.5, spread: 0.9, additive: false, glow: 0 },
  lasca: { color: "#c08a4a", size: 0.14, life: 1.1, speed: 5, gravity: -12, drag: 1.2, spread: 1, additive: false, glow: 0 },
  vidro: { color: "#cdf1ff", size: 0.11, life: 1.3, speed: 6.5, gravity: -13, drag: 1.1, spread: 1, additive: true, glow: 0.6 },
  sangue: { color: "#a3130b", size: 0.16, life: 1.4, speed: 6.5, gravity: -15, drag: 1.1, spread: 1, additive: false, glow: 0 },
  carne: { color: "#6d1410", size: 0.24, life: 1.8, speed: 4.5, gravity: -15, drag: 1.4, spread: 1, additive: false, glow: 0 },
  fumaca: { color: "#4b4a48", size: 1.1, life: 3.4, speed: 1.6, gravity: 0.7, drag: 0.9, spread: 1.1, additive: false, glow: 0 },
  fogo: { color: "#ff8a2b", size: 0.9, life: 0.9, speed: 5.5, gravity: 2.2, drag: 2.4, spread: 1, additive: true, glow: 1 },
  plasma: { color: "#31e7ff", size: 0.36, life: 1.1, speed: 3.2, gravity: 0, drag: 1.6, spread: 1, additive: true, glow: 1 },
  gelatina: { color: "#6ff0c0", size: 0.3, life: 1.7, speed: 4.2, gravity: -9, drag: 2.1, spread: 1, additive: false, glow: 0.2 },
  dissolver: { color: "#ff8aff", size: 0.3, life: 1.2, speed: 2.6, gravity: 1.4, drag: 2.6, spread: 1, additive: true, glow: 1 },
  casulo: { color: "#d8b46a", size: 0.09, life: 2.6, speed: 5.5, gravity: -14, drag: 0.7, spread: 1, additive: false, glow: 0 },
};

const VERTEX = /* glsl */ `
  attribute float size;
  attribute float alpha;
  attribute vec3 tint;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = tint;
    vAlpha = alpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * 320.0 / max(0.001, -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r2 = dot(d, d);
    if (r2 > 0.25) discard;
    float a = smoothstep(0.25, 0.015, r2) * vAlpha;
    if (a <= 0.002) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

class ParticleBank {
  points: THREE.Points;
  private capacity: number;
  private count = 0;
  private positions: Float32Array;
  private colors: Float32Array;
  private sizes: Float32Array;
  private alphas: Float32Array;
  private velocity: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private gravity: Float32Array;
  private drag: Float32Array;
  private baseSize: Float32Array;
  private baseColor: Float32Array;
  private geometry: THREE.BufferGeometry;

  constructor(capacity: number, additive: boolean) {
    this.capacity = capacity;
    this.positions = new Float32Array(capacity * 3);
    this.colors = new Float32Array(capacity * 3);
    this.sizes = new Float32Array(capacity);
    this.alphas = new Float32Array(capacity);
    this.velocity = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.gravity = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);
    this.baseSize = new Float32Array(capacity);
    this.baseColor = new Float32Array(capacity * 3);
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute("tint", new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute("size", new THREE.BufferAttribute(this.sizes, 1));
    this.geometry.setAttribute("alpha", new THREE.BufferAttribute(this.alphas, 1));
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geometry, material);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 6 : 5;
    this.geometry.setDrawRange(0, 0);
    for (let i = 0; i < capacity; i++) this.alphas[i] = 0;
  }

  spawn(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    spec: ParticleSpec,
    amount: number,
    scale: number,
    random: () => number,
    jitter = 0.06,
  ) {
    const color = new THREE.Color(spec.color);
    const dir = new THREE.Vector3();
    for (let i = 0; i < amount; i++) {
      if (this.count >= this.capacity) return;
      const index = this.count++;
      const offset = index * 3;
      coneDirection(direction, spec.spread, random, dir);
      this.positions[offset] = origin.x + (random() - 0.5) * jitter;
      this.positions[offset + 1] = origin.y + (random() - 0.5) * jitter;
      this.positions[offset + 2] = origin.z + (random() - 0.5) * jitter;
      const speed = spec.speed * (0.45 + random() * 0.85) * scale;
      this.velocity[offset] = dir.x * speed;
      this.velocity[offset + 1] = dir.y * speed + spec.gravity * (-0.06 * random());
      this.velocity[offset + 2] = dir.z * speed;
      const life = spec.life * (0.7 + random() * 0.6);
      this.life[index] = life;
      this.maxLife[index] = life;
      this.gravity[index] = spec.gravity;
      this.drag[index] = spec.drag;
      this.sizes[index] = spec.size * scale * (0.7 + random() * 0.7);
      this.baseSize[index] = this.sizes[index];
      this.alphas[index] = 1;
      const variation = 0.75 + random() * 0.45;
      this.colors[offset] = color.r * variation;
      this.colors[offset + 1] = color.g * variation;
      this.colors[offset + 2] = color.b * variation;
      this.baseColor[offset] = color.r;
      this.baseColor[offset + 1] = color.g;
      this.baseColor[offset + 2] = color.b;
    }
    this.geometry.setDrawRange(0, this.count);
  }

  update(dt: number) {
    if (!this.count) return;
    const pos = this.positions;
    for (let i = 0; i < this.count; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        const last = --this.count;
        if (i !== last) {
          for (let k = 0; k < 3; k++) {
            pos[i * 3 + k] = pos[last * 3 + k];
            this.velocity[i * 3 + k] = this.velocity[last * 3 + k];
            this.colors[i * 3 + k] = this.colors[last * 3 + k];
            this.baseColor[i * 3 + k] = this.baseColor[last * 3 + k];
          }
          this.life[i] = this.life[last];
          this.maxLife[i] = this.maxLife[last];
          this.gravity[i] = this.gravity[last];
          this.drag[i] = this.drag[last];
          this.sizes[i] = this.sizes[last];
          this.baseSize[i] = this.baseSize[last];
          this.alphas[i] = this.alphas[last];
        }
        i--;
        continue;
      }
      const offset = i * 3;
      const drag = Math.exp(-this.drag[i] * dt);
      this.velocity[offset] *= drag;
      this.velocity[offset + 1] = this.velocity[offset + 1] * drag + this.gravity[i] * dt;
      this.velocity[offset + 2] *= drag;
      pos[offset] += this.velocity[offset] * dt;
      pos[offset + 1] += this.velocity[offset + 1] * dt;
      pos[offset + 2] += this.velocity[offset + 2] * dt;
      const t = clamp(this.life[i] / Math.max(0.0001, this.maxLife[i]), 0, 1);
      this.alphas[i] = t * t * (this.gravity[i] > 0 ? t : 1);
      this.sizes[i] = this.baseSize[i] * (1 + (1 - t) * 0.5);
      this.colors[offset] = this.baseColor[offset] * (0.35 + t * 0.65);
      this.colors[offset + 1] = this.baseColor[offset + 1] * (0.2 + t * 0.8);
      this.colors[offset + 2] = this.baseColor[offset + 2] * (0.15 + t * 0.85);
    }
    this.geometry.setDrawRange(0, this.count);
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.tint.needsUpdate = true;
    this.geometry.attributes.size.needsUpdate = true;
    this.geometry.attributes.alpha.needsUpdate = true;
  }

  get live() {
    return this.count;
  }

  clear() {
    this.count = 0;
    this.geometry.setDrawRange(0, 0);
  }

  dispose() {
    this.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
    this.points.removeFromParent();
  }
}

/** Linhas de traçante pooladas (uma malha só). */
class TracerPool {
  lines: THREE.LineSegments;
  private capacity = 96;
  private count = 0;
  private positions: Float32Array;
  private colors: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;

  constructor() {
    this.positions = new Float32Array(this.capacity * 6);
    this.colors = new Float32Array(this.capacity * 6);
    this.life = new Float32Array(this.capacity);
    this.maxLife = new Float32Array(this.capacity);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(this.colors, 3));
    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.9,
    });
    this.lines = new THREE.LineSegments(geometry, material);
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 7;
    geometry.setDrawRange(0, 0);
  }

  fire(from: THREE.Vector3, to: THREE.Vector3, color: string, life = 0.055) {
    if (this.count >= this.capacity) return;
    const index = this.count++;
    const offset = index * 6;
    this.positions[offset] = from.x;
    this.positions[offset + 1] = from.y;
    this.positions[offset + 2] = from.z;
    this.positions[offset + 3] = to.x;
    this.positions[offset + 4] = to.y;
    this.positions[offset + 5] = to.z;
    const tint = new THREE.Color(color);
    for (let i = 0; i < 2; i++) {
      this.colors[offset + i * 3] = tint.r;
      this.colors[offset + i * 3 + 1] = tint.g;
      this.colors[offset + i * 3 + 2] = tint.b;
    }
    this.life[index] = life;
    this.maxLife[index] = life;
    this.lines.geometry.setDrawRange(0, this.count * 2);
  }

  update(dt: number) {
    if (!this.count) return;
    for (let i = 0; i < this.count; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        const last = --this.count;
        if (i !== last) {
          for (let k = 0; k < 6; k++) {
            this.positions[i * 6 + k] = this.positions[last * 6 + k];
            this.colors[i * 6 + k] = this.colors[last * 6 + k];
          }
          this.life[i] = this.life[last];
          this.maxLife[i] = this.maxLife[last];
        }
        i--;
      }
    }
    this.lines.geometry.setDrawRange(0, this.count * 2);
    this.lines.geometry.attributes.position.needsUpdate = true;
    this.lines.geometry.attributes.color.needsUpdate = true;
  }

  clear() {
    this.count = 0;
    this.lines.geometry.setDrawRange(0, 0);
  }

  dispose() {
    this.lines.geometry.dispose();
    (this.lines.material as THREE.Material).dispose();
    this.lines.removeFromParent();
  }
}

export interface BurstOptions {
  amount?: number;
  scale?: number;
  direction?: THREE.Vector3;
  jitter?: number;
}

export class Effects {
  group = new THREE.Group();
  private additive: ParticleBank;
  private soft: ParticleBank;
  private tracers = new TracerPool();
  private shells: { mesh: THREE.Mesh; life: number; maxLife: number; radius: number }[] = [];
  private lights: { light: THREE.PointLight; life: number; maxLife: number; peak: number }[] = [];
  private random = rng(1337);
  private shellGeometry = new THREE.SphereGeometry(1, 16, 12);
  private shellMaterial = new THREE.MeshBasicMaterial({
    color: "#ffb46b",
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.BackSide,
  });
  private lastBloodAt = 0;

  constructor(private ctx: GameContext) {
    const quality = ctx.settings.particles;
    this.additive = new ParticleBank(Math.round(1800 * Math.max(0.25, quality)), true);
    this.soft = new ParticleBank(Math.round(2200 * Math.max(0.25, quality)), false);
    this.group.add(this.additive.points, this.soft.points, this.tracers.lines);
    this.group.name = "goreforge-fx";
    ctx.scene.add(this.group);
    for (let i = 0; i < 2; i++) {
      const light = new THREE.PointLight("#ff9a4d", 0, 26, 2);
      light.visible = false;
      this.group.add(light);
      this.lights.push({ light, life: 0, maxLife: 1, peak: 60 });
    }
    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(this.shellGeometry, this.shellMaterial.clone());
      mesh.visible = false;
      mesh.renderOrder = 8;
      this.group.add(mesh);
      this.shells.push({ mesh, life: 0, maxLife: 1, radius: 1 });
    }
  }

  get particleCount() {
    return this.additive.live + this.soft.live;
  }

  burst(kind: ParticleKind, origin: THREE.Vector3, options: BurstOptions = {}) {
    const spec = specs[kind];
    const scale = (options.scale ?? 1) * this.ctx.settings.particles;
    const amount = Math.max(1, Math.round((options.amount ?? 10) * this.ctx.settings.particles));
    if (scale <= 0) return;
    const direction = options.direction ?? new THREE.Vector3(0, 1, 0);
    (spec.additive ? this.additive : this.soft).spawn(
      origin,
      direction,
      spec,
      amount,
      scale,
      this.random,
      options.jitter ?? 0.08,
    );
  }

  /** Explosão visual completa: clarão, onda, fumaça e tremor. */
  explosion(position: THREE.Vector3, radius: number, shake = 2) {
    this.burst("fogo", position, { amount: 46, scale: radius * 0.22, jitter: radius * 0.2 });
    this.burst("fumaca", position, {
      amount: 30,
      scale: radius * 0.28,
      direction: new THREE.Vector3(0, 1, 0),
      jitter: radius * 0.25,
    });
    this.burst("faisca", position, {
      amount: 60,
      scale: radius * 0.18,
      direction: new THREE.Vector3(0, 1, 0),
      jitter: radius * 0.1,
    });
    const shell = this.shells.find((s) => s.life <= 0) ?? this.shells[0];
    shell.life = 0.45;
    shell.maxLife = 0.45;
    shell.radius = radius * 0.55;
    shell.mesh.visible = true;
    shell.mesh.position.copy(position);
    shell.mesh.scale.setScalar(radius * 0.25);
    this.flash(position, radius * 12, 0.32);
    this.shake(shake);
  }

  flash(position: THREE.Vector3, intensity: number, seconds: number, color = "#ff9a4d") {
    const entry = this.lights.find((l) => l.life <= 0) ?? this.lights[0];
    entry.life = seconds;
    entry.maxLife = seconds;
    entry.peak = intensity;
    entry.light.color.set(color);
    entry.light.position.copy(position);
    entry.light.visible = true;
    entry.light.intensity = intensity;
  }

  tracer(from: THREE.Vector3, to: THREE.Vector3, color: string, life = 0.055) {
    if (!this.ctx.settings.tracers) return;
    this.tracers.fire(from, to, color, life);
  }

  shake(amount: number) {
    const scaled = amount * this.ctx.settings.shake;
    if (scaled <= 0) return;
    this.ctx.world.shake = {
      amount: Math.min(3, Math.max(this.ctx.world.shake.until > this.ctx.time ? this.ctx.world.shake.amount : 0, scaled)),
      until: this.ctx.time + 0.12 + scaled * 0.1,
    };
  }

  /** Sangue com limite de emissão para não virar sopa em tiroteio longo. */
  blood(position: THREE.Vector3, direction: THREE.Vector3, amount: number, big = false) {
    const ratio = this.ctx.settings.bloodAmount;
    if (ratio <= 0) return;
    if (this.ctx.time - this.lastBloodAt < 0.012 && amount < 12) return;
    this.lastBloodAt = this.ctx.time;
    const dir = direction.clone().normalize();
    this.burst("sangue", position, { amount: amount * ratio, scale: big ? 1.6 : 1, direction: dir });
    if (big) {
      this.burst("carne", position, { amount: amount * 0.35 * ratio, scale: 1.4, direction: dir });
      this.ctx.world.audio.play("sangue.splash", 0.5, 0.9 + this.random() * 0.3);
    }
  }

  impact(
    position: THREE.Vector3,
    normal: THREE.Vector3,
    material: "madeira" | "metal" | "concreto" | "vidro" | "gelatina" | "tecido" | "explosivo",
    strength = 1,
  ) {
    switch (material) {
      case "metal":
        this.burst("faisca", position, { amount: 14 * strength, direction: normal, scale: 1.1 });
        this.burst("poeira", position, { amount: 4, direction: normal, scale: 0.6 });
        break;
      case "concreto":
        this.burst("poeira", position, { amount: 12 * strength, direction: normal, scale: 0.8 });
        break;
      case "madeira":
        this.burst("lasca", position, { amount: 12 * strength, direction: normal });
        this.burst("poeira", position, { amount: 5, direction: normal, scale: 0.5 });
        break;
      case "vidro":
        this.burst("vidro", position, { amount: 18 * strength, direction: normal, scale: 1.1 });
        break;
      case "gelatina":
        this.burst("gelatina", position, { amount: 14 * strength, direction: normal, scale: 1.2 });
        break;
      case "explosivo":
        this.burst("faisca", position, { amount: 18 * strength, direction: normal, scale: 1.2 });
        this.burst("fogo", position, { amount: 6, direction: normal, scale: 0.6 });
        break;
      default:
        this.burst("sangue", position, { amount: 10 * strength, direction: normal });
        break;
    }
    this.ctx.world.audio.play(
      material === "metal"
        ? "impacto.metal"
        : material === "vidro"
          ? "impacto.vidro"
          : material === "gelatina"
            ? "gelatina.impacto"
            : material === "tecido"
              ? "impacto.carne"
              : "impacto.concreto",
      0.35 + 0.25 * strength,
      0.85 + this.random() * 0.35,
    );
  }

  /** Pequena trilha luminosa atrás de projéteis (granadas, gelatina, mísseis). */
  trail(position: THREE.Vector3, color: string, additive = true) {
    const spec: ParticleSpec = {
      color,
      size: 0.16,
      life: 0.4,
      speed: 0.4,
      gravity: 0.3,
      drag: 3,
      spread: 0.6,
      additive,
      glow: 1,
    };
    (additive ? this.additive : this.soft).spawn(
      position,
      new THREE.Vector3(0, 1, 0),
      spec,
      2,
      1,
      this.random,
      0.05,
    );
  }

  muzzleFlash(position: THREE.Vector3, direction: THREE.Vector3, color: string, scale = 1) {
    this.burst("faisca", position, { amount: 6 * scale, direction, scale: 0.8, jitter: 0.02 });
    this.burst("fumaca", position, { amount: 3 * scale, direction, scale: 0.35, jitter: 0.04 });
    this.flash(position, 6 * scale, 0.06, color);
  }

  update(dt: number) {
    this.additive.update(dt);
    this.soft.update(dt);
    this.tracers.update(dt);
    for (const shell of this.shells) {
      if (shell.life <= 0) continue;
      shell.life -= dt;
      const t = clamp(shell.life / shell.maxLife, 0, 1);
      const scale = shell.radius * (1.6 - t * 1.1);
      shell.mesh.scale.setScalar(scale);
      const material = shell.mesh.material as THREE.MeshBasicMaterial;
      material.opacity = t * 0.75;
      shell.mesh.visible = shell.life > 0;
      if (shell.life <= 0) shell.mesh.visible = false;
    }
    for (const entry of this.lights) {
      if (entry.life <= 0) continue;
      entry.life -= dt;
      const t = clamp(entry.life / entry.maxLife, 0, 1);
      entry.light.intensity = entry.peak * t * t;
      if (entry.life <= 0) {
        entry.light.visible = false;
        entry.light.intensity = 0;
      }
    }
  }

  /** Rastro de fumaça que sobe de destruição em massa. */
  ruin(position: THREE.Vector3, size = 1) {
    this.burst("fumaca", position, { amount: 12, scale: size, direction: new THREE.Vector3(0, 1, 0), jitter: 0.4 });
    this.burst("poeira", position, { amount: 8, scale: size * 0.8, direction: new THREE.Vector3(0, 1, 0), jitter: 0.3 });
  }

  rain(position: THREE.Vector3, amount: number, color = "#8f1408") {
    const spec: ParticleSpec = { ...specs.sangue, color };
    this.soft.spawn(position, new THREE.Vector3(0, -1, 0), spec, amount * this.ctx.settings.bloodAmount, 1, this.random, 0.5);
  }

  /** Anel de choque no chão (usado por dash e explosões). */
  ring(position: THREE.Vector3, radius: number, color = "#ffd166") {
    const shell = this.shells.find((s) => s.life <= 0) ?? this.shells[0];
    shell.life = 0.4;
    shell.maxLife = 0.4;
    shell.radius = radius;
    (shell.mesh.material as THREE.MeshBasicMaterial).color.set(color);
    shell.mesh.visible = true;
    shell.mesh.position.copy(position);
    shell.mesh.scale.setScalar(radius * 0.2);
  }

  clear() {
    this.additive.clear();
    this.soft.clear();
    this.tracers.clear();
    for (const shell of this.shells) {
      shell.life = 0;
      shell.mesh.visible = false;
    }
    for (const entry of this.lights) {
      entry.life = 0;
      entry.light.visible = false;
      entry.light.intensity = 0;
    }
  }

  dispose() {
    this.additive.dispose();
    this.soft.dispose();
    this.tracers.dispose();
    this.group.removeFromParent();
  }
}
