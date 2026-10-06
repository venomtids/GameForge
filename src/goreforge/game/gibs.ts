import * as THREE from "three";
import type { GameContext } from "./context";
import { clamp, rng } from "./util";

interface DeathOptions {
  point: THREE.Vector3;
  direction: THREE.Vector3;
  force?: number;
  gib?: boolean;
}

/** Índices do rig articulado criado pela engine (PhysicalRig tipo ragdoll). */
const RAGDOLL_PARTS = ["tronco", "cabeça", "braço esquerdo", "braço direito", "perna esquerda", "perna direita"];
/** Concordância do aviso de desmembramento (o membro é feminino/masculino). */
const PART_GENDER = ["o", "a", "o", "o", "a", "a"];

/**
 * Gore: sangue, poças, estilhaços de carne e DESMEMBRAMENTO real.
 *
 * O ragdoll é o rig articulado da própria engine (6 corpos + juntas). Para
 * arrancar um membro, o sistema remove as juntas que seguram aquele corpo —
 * ele passa a voar solto, ainda com a malha e o colisor originais, e o resto
 * do corpo continua articulado. Nada disso é animação fake.
 */
export class Gibs {
  private severed = new Map<string, Set<number>>();
  private pools = new Map<string, number>();
  private random = rng(31337);
  private lastPool = new Map<string, number>();

  constructor(private ctx: GameContext) {}

  /** Zona do corpo atingida, a partir do ponto de impacto em relação ao corpo. */
  partAt(nodeId: string, point: THREE.Vector3) {
    const object = this.ctx.world.objects.get(nodeId);
    const node = this.ctx.world.configs.find((n) => n.id === nodeId);
    if (!object || !node) return { part: 0, head: false, limb: false };
    const base = object.getWorldPosition(new THREE.Vector3());
    const height = Math.max(0.6, node.scale[1]);
    const relative = point.y - (base.y - height / 2);
    const ratio = clamp(relative / height, 0, 1.2);
    const lateral = Math.hypot(point.x - base.x, point.z - base.z);
    if (ratio > 0.82) return { part: 1, head: true, limb: false };
    if (lateral > 0.34 * Math.max(0.6, node.scale[0]) + 0.18)
      return { part: relative > height * 0.55 ? 2 : 4, head: false, limb: true };
    if (ratio < 0.42) return { part: relative < height * 0.3 ? 4 : 5, head: false, limb: true };
    return { part: 0, head: false, limb: false };
  }

  /** Impacto em um corpo humanoide: sangue, número e possibilidade de rasgar. */
  onDamage(
    nodeId: string,
    point: THREE.Vector3,
    direction: THREE.Vector3,
    amount: number,
    options: { headshot: boolean; limb: boolean; dismember: number; blood: number; force: number },
  ) {
    const ratio = this.ctx.settings.bloodAmount;
    if (ratio <= 0) return;
    const big = amount > 34;
    this.ctx.fx.blood(point, direction, clamp(6 + amount * 0.35, 6, 26) * options.blood, big);
    this.ctx.decals.spawn(point, direction.clone().multiplyScalar(-1), "sangue", 0.42 + Math.random() * 0.2, 22);
    if (options.dismember > 0 && this.ctx.settings.dismember) {
      const chance = clamp(options.dismember * (amount / 60) * (big ? 1.6 : 1), 0, 0.92);
      if (this.random() < chance) this.dismember(nodeId, point, direction, options.force);
    }
  }

  /** Arranca o membro mais próximo do ponto de impacto (ou a cabeça). */
  dismember(nodeId: string, point: THREE.Vector3, direction: THREE.Vector3, force = 12) {
    const rig = this.ctx.world.physicalRigs.get(nodeId);
    if (!rig || rig.type !== "ragdoll") return false;
    const zone = this.partAt(nodeId, point);
    let index = zone.part;
    // Escolhe o corpo articulado mais próximo do ponto se o chute pela zona falhar.
    let best = Infinity;
    for (let i = 0; i < rig.bodies.length; i++) {
      const body = rig.bodies[i];
      const distance = point.distanceTo(new THREE.Vector3(body.position.x, body.position.y, body.position.z));
      if (distance < best) {
        best = distance;
        index = i;
      }
    }
    const used = this.severed.get(nodeId) ?? new Set<number>();
    if (used.has(index)) return false;
    used.add(index);
    this.severed.set(nodeId, used);

    const body = rig.bodies[index];
    const removed = rig.constraints.filter(
      (constraint) => constraint.bodyA === body || constraint.bodyB === body,
    );
    for (const constraint of removed) this.ctx.world.physics?.removeConstraint(constraint);
    rig.constraints = rig.constraints.filter((constraint) => !removed.includes(constraint));
    const push = direction.clone().normalize().multiplyScalar(force * 0.5);
    body.velocity.set(
      body.velocity.x + push.x * 2.6,
      body.velocity.y + push.y * 2.6 + 3.4,
      body.velocity.z + push.z * 2.6,
    );
    body.angularVelocity.set(
      (this.random() - 0.5) * 16,
      (this.random() - 0.5) * 16,
      (this.random() - 0.5) * 16,
    );
    body.wakeUp();

    const name = RAGDOLL_PARTS[index] ?? "membro";
    const gender = PART_GENDER[index] ?? "o";
    this.ctx.store.gibs += 1;
    this.ctx.store.pushFeed({
      text: `${name} arrancad${gender === "a" ? "a" : "o"}`,
      detail: nodeId.replace(/^gf-/, ""),
      kind: "kill",
    });
    this.ctx.fx.blood(new THREE.Vector3(body.position.x, body.position.y, body.position.z), direction, 34, true);
    this.ctx.world.audio.play("carne.rasgar", 0.7, 0.9 + this.random() * 0.25);
    this.ctx.world.audio.play("osso.quebrar", 0.5, 0.9 + this.random() * 0.4);
    // Pequenos pedaços de carne física no ponto da junta.
    for (let i = 0; i < 3; i++)
      this.ctx.spawner.chunk(
        new THREE.Vector3(body.position.x, body.position.y, body.position.z),
        new THREE.Vector3(0.22, 0.22, 0.22),
        "#7d1a12",
        direction
          .clone()
          .multiplyScalar(6 + this.random() * 5)
          .add(new THREE.Vector3((this.random() - 0.5) * 4, 3 + this.random() * 3, (this.random() - 0.5) * 4)),
        { mass: 0.8, restitution: 0.15, life: 24 },
      );
    return true;
  }

  /** Corpo morto: jorra sangue, poça no chão e (às vezes) estoura em pedaços. */
  onDeath(nodeId: string, options: DeathOptions) {
    const node = this.ctx.world.configs.find((n) => n.id === nodeId);
    if (!node) return;
    const ratio = this.ctx.settings.bloodAmount;
    const object = this.ctx.world.objects.get(nodeId);
    const base = object
      ? object.getWorldPosition(new THREE.Vector3())
      : options.point.clone();
    if (ratio > 0) {
      this.ctx.fx.blood(options.point, options.direction, 30 * ratio, true);
      this.spill(base, 1.15);
      this.ctx.world.audio.play("morte.grito", 0.6, 0.9 + this.random() * 0.3);
    }
    const gibThreshold = this.ctx.settings.gibThreshold;
    if (options.gib || gibThreshold <= 0 || (options.force ?? 0) > gibThreshold * 0.6) this.explodeCorpse(nodeId, options);
  }

  /** Estilhaça o corpo em pedaços físicos e remove o nó original. */
  explodeCorpse(nodeId: string, options: DeathOptions) {
    const node = this.ctx.world.configs.find((n) => n.id === nodeId);
    const object = this.ctx.world.objects.get(nodeId);
    if (!node || !object) return;
    const base = object.getWorldPosition(new THREE.Vector3());
    const ratio = this.ctx.settings.bloodAmount;
    const color = node.actor.skin;
    const amount = Math.round(14 * Math.max(0.5, ratio));
    for (let i = 0; i < amount; i++) {
      const offset = new THREE.Vector3(
        (this.random() - 0.5) * node.scale[0],
        (this.random() - 0.5) * node.scale[1],
        (this.random() - 0.5) * node.scale[2],
      );
      const velocity = options.direction
        .clone()
        .multiplyScalar(4 + this.random() * 8)
        .add(new THREE.Vector3((this.random() - 0.5) * 7, 3 + this.random() * 6, (this.random() - 0.5) * 7));
      this.ctx.spawner.chunk(
        base.clone().add(offset),
        new THREE.Vector3(0.28, 0.28, 0.28),
        this.random() > 0.35 ? "#8c1c12" : color,
        velocity,
        { mass: 1.1, restitution: 0.12, life: 30 },
      );
    }
    this.ctx.fx.blood(base, new THREE.Vector3(0, 1, 0), 44 * Math.max(0.4, ratio), true);
    this.ctx.fx.burst("carne", base, { amount: 24, direction: new THREE.Vector3(0, 1, 0), scale: 1.6 });
    this.spill(base, 1.4);
    this.ctx.world.audio.play("sangue.splash", 0.8, 0.85);
    this.ctx.world.command({ type: "remove", id: nodeId });
    this.ctx.store.gibs += 1;
  }

  /** Poça de sangue no chão (só onde existir superfície próxima). */
  spill(position: THREE.Vector3, size = 1) {
    const ratio = this.ctx.settings.bloodAmount;
    if (ratio <= 0) return;
    const last = this.lastPool.get("global") ?? 0;
    const now = this.ctx.time;
    this.pools.set(position.toArray().join(","), now);
    const point = position.clone();
    point.y = Math.max(0.02, position.y - 0.7);
    this.ctx.decals.spill(point, "sangue", size * clamp(ratio, 0.4, 1.6));
    if (now - last > 0.25 || size > 1.5) {
      this.lastPool.set("global", now);
      this.ctx.world.audio.play("sangue.splash", 0.35, 0.8 + this.random() * 0.3);
    }
  }

  /** Dano por queda: usa o histórico de velocidades do controlador. */
  fallImpact(nodeId: string, point: THREE.Vector3, speed: number) {
    if (speed < 12) return;
    const ratio = this.ctx.settings.bloodAmount;
    if (ratio <= 0) return;
    this.ctx.fx.impact(point, new THREE.Vector3(0, 1, 0), "tecido", clamp(speed / 14, 0.6, 2.2));
    this.ctx.decals.spill(point, "sangue", clamp(speed / 20, 0.4, 1.4));
    void nodeId;
  }

  reset() {
    this.severed.clear();
    this.pools.clear();
    this.lastPool.clear();
  }
}
