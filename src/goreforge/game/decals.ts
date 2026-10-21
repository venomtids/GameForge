import * as THREE from "three";
import type { GameContext } from "./context";
import { hashString, rng } from "./util";

/**
 * Marcas de impacto e poças de sangue.
 *
 * Uma GPU textura por tipo (buraco, sangue, queimadura, gelatina) desenhada em
 * canvas na primeira utilização, e um pool de planos com material próprio que
 * é apenas REPOSICIONADO — sem criar geometria por tiro.
 */
export type DecalKind = "buraco" | "sangue" | "queimado" | "gelatina" | "dissolvido" | "vidro";

const DECAL_COLORS: Record<DecalKind, { ink: string; glow: string }> = {
  buraco: { ink: "#12100e", glow: "#3a352c" },
  sangue: { ink: "#7a0d05", glow: "#c21a0c" },
  queimado: { ink: "#141210", glow: "#ff8a2b" },
  gelatina: { ink: "#2fae88", glow: "#9bffe0" },
  dissolvido: { ink: "#7a2f8f", glow: "#ff8aff" },
  vidro: { ink: "#cfe9f5", glow: "#ffffff" },
};

function decalTexture(kind: DecalKind) {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const random = rng(hashString(kind));
  const { ink, glow } = DECAL_COLORS[kind];
  if (kind === "sangue") {
    ctx.fillStyle = ink;
    for (let i = 0; i < 26; i++) {
      const a = random() * Math.PI * 2;
      const r = random() * 26;
      const radius = 2 + random() * 9;
      ctx.globalAlpha = 0.5 + random() * 0.5;
      ctx.beginPath();
      ctx.arc(size / 2 + Math.cos(a) * r, size / 2 + Math.sin(a) * r, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 9 + random() * 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "dissolvido" || kind === "gelatina") {
    ctx.fillStyle = ink;
    ctx.globalAlpha = 0.85;
    for (let i = 0; i < 18; i++) {
      const a = random() * Math.PI * 2;
      const r = random() * 24;
      ctx.beginPath();
      ctx.arc(size / 2 + Math.cos(a) * r, size / 2 + Math.sin(a) * r, 3 + random() * 10, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = glow;
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, 8 + i * 4 + random() * 3, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, ink);
    gradient.addColorStop(0.35, kind === "queimado" ? "#2a1c10" : "#1c1813");
    gradient.addColorStop(0.7, "rgba(0,0,0,0.35)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = glow;
    ctx.lineWidth = kind === "vidro" ? 1.5 : 2;
    for (let i = 0; i < 7; i++) {
      const a = random() * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(size / 2, size / 2);
      ctx.lineTo(size / 2 + Math.cos(a) * size * 0.45, size / 2 + Math.sin(a) * size * 0.45);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, kind === "buraco" ? 7 : 10, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

interface Decal {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  kind: DecalKind;
  fade: boolean;
}

const geometry = new THREE.PlaneGeometry(1, 1);
const LIFETIMES: Record<DecalKind, number> = {
  buraco: 26,
  sangue: 40,
  queimado: 22,
  gelatina: 18,
  dissolvido: 16,
  vidro: 20,
};

export class Decals {
  group = new THREE.Group();
  private pool: Decal[] = [];
  private textures = new Map<DecalKind, THREE.Texture>();
  private materials = new Map<DecalKind, THREE.MeshBasicMaterial>();
  private random = rng(90210);
  private normal = new THREE.Vector3();
  private quaternion = new THREE.Quaternion();
  private up = new THREE.Vector3(0, 0, 1);

  constructor(private ctx: GameContext) {
    this.group.name = "goreforge-decals";
    ctx.scene.add(this.group);
    for (const kind of Object.keys(DECAL_COLORS) as DecalKind[]) {
      const texture = decalTexture(kind);
      this.textures.set(kind, texture);
      this.materials.set(
        kind,
        new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -4,
          opacity: kind === "buraco" ? 0.95 : 0.85,
        }),
      );
    }
  }

  get count() {
    return this.pool.filter((d) => d.life > 0).length;
  }

  spawn(
    point: THREE.Vector3,
    normal: THREE.Vector3,
    kind: DecalKind,
    size = 0.32,
    life?: number,
  ) {
    const limit = this.ctx.settings.maxDecals;
    if (limit <= 0) return null;
    let entry = this.pool.find((d) => d.life <= 0);
    if (!entry && this.pool.length < limit) {
      const mesh = new THREE.Mesh(geometry, this.materials.get(kind)!);
      mesh.renderOrder = 2;
      mesh.frustumCulled = true;
      this.group.add(mesh);
      entry = { mesh, life: 0, maxLife: 1, kind, fade: true };
      this.pool.push(entry);
    }
    if (!entry) {
      // Pool cheio: recicla a marca mais antiga (FIFO) em vez de crescer.
      entry = this.pool.reduce((oldest, item) => (item.life < oldest.life ? item : oldest), this.pool[0]);
    }
    const material = this.materials.get(kind)!;
    entry.mesh.material = material;
    entry.kind = kind;
    this.normal.copy(normal).normalize();
    this.quaternion.setFromUnitVectors(this.up, this.normal);
    entry.mesh.quaternion.copy(this.quaternion);
    entry.mesh.rotateZ(this.random() * Math.PI * 2);
    entry.mesh.position.copy(point).addScaledVector(this.normal, 0.014);
    /* A geometria do decalque tem raio 1.1 m: limitamos a escala para uma poça
       de sangue nunca virar um tapete de vários metros com o gore no máximo. */
    const scale = Math.min(kind === "sangue" ? 1.5 : 2.2, size * (0.75 + this.random() * 0.6));
    entry.mesh.scale.set(scale, scale, scale);
    entry.maxLife = life ?? LIFETIMES[kind];
    entry.life = entry.maxLife;
    entry.fade = true;
    entry.mesh.visible = true;
    entry.mesh.material.opacity = kind === "buraco" ? 0.95 : 0.85;
    return entry.mesh;
  }

  /** Poça no chão: só se o suporte for realmente horizontal. */
  spill(point: THREE.Vector3, kind: DecalKind = "sangue", size = 0.9) {
    return this.spawn(point, new THREE.Vector3(0, 1, 0), kind, size);
  }

  update(dt: number) {
    for (const entry of this.pool) {
      if (entry.life <= 0) continue;
      entry.life -= dt;
      if (entry.life <= entry.maxLife * 0.35) {
        const t = Math.max(0, entry.life / (entry.maxLife * 0.35));
        (entry.mesh.material as THREE.MeshBasicMaterial).opacity = t * 0.85;
      }
      if (entry.life <= 0) entry.mesh.visible = false;
    }
  }

  clear() {
    for (const entry of this.pool) {
      entry.life = 0;
      entry.mesh.visible = false;
    }
  }

  dispose() {
    for (const texture of this.textures.values()) texture.dispose();
    for (const material of this.materials.values()) material.dispose();
    geometry.dispose();
    this.group.removeFromParent();
  }
}
