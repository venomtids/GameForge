import * as THREE from "three";
import * as CANNON from "cannon-es";
import type { GameContext } from "./context";
import type { BreakProfile } from "../arena";
import { clamp, rng } from "./util";

interface Breakable {
  profile: BreakProfile;
  hp: number;
  max: number;
}

export interface ExplosionOptions {
  /** Origem (para créditos de abate e killfeed). */
  source?: string;
  weapon?: string;
  /** Profundidade da reação em cadeia. */
  depth?: number;
}

/**
 * Destruição: fratura de props em estilhaços físicos e explosões com impulso
 * radial sobre TODOS os corpos dinâmicos (Cannon-es), dano por queda de
 * distância, reação em cadeia entre explosivos e marcas no cenário.
 */
export class Destruction {
  breakables = new Map<string, Breakable>();
  private pending: { id: string; delay: number; options: ExplosionOptions }[] = [];
  private random = rng(777);
  private direction = new THREE.Vector3();
  private ray = new THREE.Raycaster();

  constructor(private ctx: GameContext) {
    for (const [id, profile] of Object.entries(ctx.meta.breakables))
      this.track(id, profile);
  }

  track(id: string, profile: BreakProfile) {
    this.breakables.set(id, { profile, hp: profile.hp, max: Math.max(1, profile.hp) });
  }

  untrack(id: string) {
    this.breakables.delete(id);
  }

  profileOf(id: string) {
    return this.breakables.get(id);
  }

  /** Aplica dano a um objeto destrutível. Devolve true se ele quebrou agora. */
  damage(id: string, amount: number, options: { point?: THREE.Vector3; direction?: THREE.Vector3; source?: string; depth?: number } = {}) {
    const entry = this.breakables.get(id);
    if (!entry || !this.ctx.settings.destruction) return false;
    entry.hp -= amount;
    if (entry.hp > 0) return false;
    this.break(id, options);
    return true;
  }

  /** Quebra imediatamente: estilhaços + poeira + (se for explosivo) explosão. */
  break(
    id: string,
    options: {
      point?: THREE.Vector3;
      direction?: THREE.Vector3;
      source?: string;
      weapon?: string;
      depth?: number;
    } = {},
  ) {
    const entry = this.breakables.get(id);
    const object = this.ctx.world.objects.get(id);
    const node = this.ctx.world.configs.find((n) => n.id === id);
    if (!entry || !object || !node) return;
    this.breakables.delete(id);
    const position = object.getWorldPosition(new THREE.Vector3());
    const scale = new THREE.Vector3(...node.scale);
    const color = node.color;
    this.fracture(id, position, scale, color, entry.profile, options);
    this.ctx.world.command({ type: "remove", id });
    this.ctx.store.destroyed += 1;
    this.ctx.store.score += 25;
    this.ctx.store.pushFeed({
      text: `${node.name} destruído`,
      detail: `${Math.round(entry.profile.hp)} de resistência`,
      kind: "destroy",
    });
    this.ctx.decals.spawn(position, new THREE.Vector3(0, 1, 0), entry.profile.material === "vidro" ? "vidro" : "queimado", 1.4, 18);
    if (entry.profile.explosive) {
      const { radius, force, damage } = entry.profile.explosive;
      this.explode(position, radius, force, damage, {
        source: options.source,
        weapon: options.weapon,
        depth: options.depth ?? 0,
      });
    }
  }

  private fracture(
    id: string,
    position: THREE.Vector3,
    scale: THREE.Vector3,
    color: string,
    profile: BreakProfile,
    options: { point?: THREE.Vector3; direction?: THREE.Vector3 },
  ) {
    const total = Math.max(0, Math.min(16, profile.chunks));
    if (total <= 0) {
      this.ctx.fx.impact(position, new THREE.Vector3(0, 1, 0), profile.material, 1.4);
      return;
    }
    const perAxis = Math.max(2, Math.ceil(Math.cbrt(total)));
    const chunk = new THREE.Vector3(
      Math.max(0.12, scale.x / perAxis),
      Math.max(0.12, scale.y / perAxis),
      Math.max(0.12, scale.z / perAxis),
    );
    const outward = new THREE.Vector3();
    let count = 0;
    for (let x = 0; x < perAxis && count < total; x++)
      for (let y = 0; y < perAxis && count < total; y++)
        for (let z = 0; z < perAxis && count < total; z++) {
          count++;
          const local = new THREE.Vector3(
            (x + 0.5 - perAxis / 2) * chunk.x,
            (y + 0.5 - perAxis / 2) * chunk.y,
            (z + 0.5 - perAxis / 2) * chunk.z,
          );
          const spawnPoint = position.clone().add(local);
          outward.copy(local).normalize();
          const force = 2.2 + this.random() * 3.4 + (options.direction?.length() ?? 0) * 0.2;
          const velocity = outward
            .clone()
            .multiplyScalar(force)
            .addScaledVector(options.direction ?? new THREE.Vector3(), 1.6)
            .add(new THREE.Vector3(0, 1.6 + this.random() * 2.4, 0));
          this.ctx.spawner.chunk(spawnPoint, chunk, color, velocity, {
            mass: Math.max(0.25, chunk.length() * 1.4),
            restitution: profile.material === "vidro" ? 0.45 : 0.28,
          });
        }
    this.ctx.fx.impact(position, new THREE.Vector3(0, 1, 0), profile.material, 1.2);
    this.ctx.fx.ruin(position, Math.max(0.5, scale.length() * 0.2));
    this.ctx.world.audio.play(
      profile.material === "vidro" ? "vidro" : profile.material === "explosivo" ? "explosao.pequena" : "impacto.concreto",
      0.7,
      0.9 + this.random() * 0.25,
    );
    void id;
  }

  /** Explosão: impulso radial, dano, estilhaços, clarão e tremor. */
  explode(position: THREE.Vector3, radius: number, force: number, damage: number, options: ExplosionOptions = {}) {
    const forceScale = this.ctx.settings.explosiveForce;
    this.ctx.fx.explosion(position, radius, clamp(2.2 * forceScale, 0.4, 3));
    this.ctx.world.audio.play("explosao", 0.85, 0.92 + this.random() * 0.2);
    this.ctx.decals.spawn(position.clone().setY(position.y - 1.2), new THREE.Vector3(0, 1, 0), "queimado", radius * 0.6, 24);
    this.ctx.store.pushFeed({
      text: "Explosão",
      detail: `raio ${radius.toFixed(0)} m · força ${Math.round(force * forceScale)}`,
      kind: "explosion",
    });
    this.ctx.store.score += 30;

    /* 1. Impulso em todos os corpos dinâmicos do mundo físico. */
    for (const [id, body] of this.ctx.world.bodies) {
      if (!body.mass) continue;
      const dx = body.position.x - position.x;
      const dy = body.position.y - position.y;
      const dz = body.position.z - position.z;
      const distance = Math.hypot(dx, dy, dz);
      if (distance > radius) continue;
      const falloff = Math.pow(1 - distance / radius, 1.4);
      const scale = (force * forceScale * falloff * clamp(body.mass, 0.5, 60)) / Math.max(0.6, distance);
      this.direction.set(dx, dy + 0.6, dz).normalize();
      const magnitude = clamp(scale, 0, 2600);
      body.applyImpulse(
        new CANNON.Vec3(
          this.direction.x * magnitude,
          this.direction.y * magnitude,
          this.direction.z * magnitude,
        ),
      );
      body.wakeUp();
      // Objetos voadores também giram: torque proporcional ao impulso.
      body.angularVelocity.set(
        body.angularVelocity.x + (this.random() - 0.5) * falloff * 12,
        body.angularVelocity.y + (this.random() - 0.5) * falloff * 12,
        body.angularVelocity.z + (this.random() - 0.5) * falloff * 12,
      );
      void id;
    }

    /* 2. Dano em NPCs, jogador e props destrutíveis dentro do raio. */
    for (const node of this.ctx.world.configs) {
      if (!node.actor.humanoid && !this.breakables.has(node.id)) continue;
      const object = this.ctx.world.objects.get(node.id);
      if (!object) continue;
      const point = object.getWorldPosition(new THREE.Vector3());
      const distance = point.distanceTo(position);
      if (distance > radius) continue;
      const falloff = Math.pow(1 - distance / radius, 1.2);
      const blocked = this.occluded(position, point);
      const applied = damage * falloff * (blocked ? 0.35 : 1);
      if (node.id === this.ctx.world.playerId) {
        this.ctx.player.damage(applied, "explosão");
        const knock = this.direction.copy(
          new THREE.Vector3(
            point.x - position.x,
            point.y - position.y + 1,
            point.z - position.z,
          ).normalize(),
        );
        this.ctx.player.knockback(knock, force * forceScale * falloff * 0.6);
      } else if (node.actor.humanoid && (this.ctx.world.health.get(node.id) ?? 100) > 0) {
        this.ctx.world.damage(node.id, applied, options.weapon ?? "explosão");
        if ((this.ctx.world.health.get(node.id) ?? 100) <= 0) {
          this.ctx.store.addKill(
            false,
            options.weapon ?? "Explosão",
            node.name,
            distance,
          );
          this.ctx.gibs.onDeath(node.id, { point, direction: this.direction, force: force * 0.6, gib: true });
        }
      } else if (this.breakables.has(node.id)) {
        const profile = this.breakables.get(node.id)!;
        if (applied >= profile.hp * 0.5)
          this.damage(node.id, applied, { point, source: options.source, depth: options.depth });
      }
    }

    /* 3. Reação em cadeia: outros explosivos do raio detonam em sequência. */
    const depth = options.depth ?? 0;
    if (depth < 4)
      for (const [id, entry] of this.breakables) {
        if (!entry.profile.explosive) continue;
        const object = this.ctx.world.objects.get(id);
        if (!object) continue;
        const distance = object.getWorldPosition(new THREE.Vector3()).distanceTo(position);
        if (distance > radius || distance > entry.profile.explosive.radius + 2) continue;
        this.pending.push({
          id,
          delay: 0.05 + this.random() * 0.18,
          options: { ...options, depth: depth + 1 },
        });
      }

    /* 4. Empurrão no jogador por proximidade (mesmo atrás de parede). */
    const player = this.ctx.world.playerId ? this.ctx.world.bodies.get(this.ctx.world.playerId) : null;
    if (player) {
      const distance = Math.hypot(
        player.position.x - position.x,
        player.position.y - position.y,
        player.position.z - position.z,
      );
      if (distance < radius * 1.3)
        this.ctx.fx.shake(clamp(2.4 * (1 - distance / (radius * 1.3)), 0, 3));
    }
  }

  /** Verifica se uma parede estática bloqueia a linha entre dois pontos. */
  private occluded(from: THREE.Vector3, to: THREE.Vector3) {
    this.direction.copy(to).sub(from);
    const distance = this.direction.length();
    if (distance < 0.2) return false;
    this.ray.set(from, this.direction.normalize());
    this.ray.far = distance - 0.2;
    const hits = this.ray.intersectObjects(this.ctx.world.root.children, true);
    return hits.some((hit) => {
      const id = hit.object.userData.nodeId as string | undefined;
      return (
        !!id &&
        this.ctx.world.configs.some((n) => n.id === id && n.physics === "static") &&
        hit.object.visible
      );
    });
  }

  update(dt: number) {
    if (!this.pending.length) return;
    for (const entry of [...this.pending]) {
      entry.delay -= dt;
      if (entry.delay > 0) continue;
      this.pending = this.pending.filter((p) => p !== entry);
      this.break(entry.id, entry.options);
    }
  }

  reset() {
    this.breakables.clear();
    this.pending = [];
    for (const [id, profile] of Object.entries(this.ctx.meta.breakables))
      this.track(id, profile);
  }
}
