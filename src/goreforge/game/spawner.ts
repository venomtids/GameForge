import * as THREE from "three";
import type { GameContext } from "./context";
import { spawnableFor, spawnWeight, type Spawnable } from "../config/spawnables";
import { rng } from "./util";

interface SpawnRecord {
  id: string;
  kind: "prop" | "debris" | "npc" | "projectile" | "shell";
  at: number;
}

interface GroupOptions {
  count?: unknown;
  step?: unknown;
  radius?: unknown;
  arc?: unknown;
  floors?: unknown;
  height?: unknown;
  size?: unknown;
  kind?: unknown;
  scale?: unknown;
  color?: unknown;
  mass?: unknown;
  physics?: unknown;
  speed?: unknown;
  actor?: unknown;
}

export interface SpawnOptions {
  position?: THREE.Vector3;
  /** Velocidade inicial em m/s (usa o patch vx/vy/vz da engine). */
  velocity?: THREE.Vector3;
  scale?: number;
  rotation?: [number, number, number];
  /** Deslocamento em relação à orientação do jogador (padrão: 1,6 m à frente). */
  forward?: number;
  height?: number;
  yaw?: number;
  silent?: boolean;
  kind?: SpawnRecord["kind"];
}

/**
 * Cria objetos no mundo SEMPRE pelo comando `spawn` da engine, o mesmo caminho
 * usado por scripts Lua/JS. Isso garante que todo item do menu nasça com corpo
 * Cannon-es, textura, luz, rig elástico e sincronização de malha.
 */
export class Spawner {
  private counter = 0;
  private records: SpawnRecord[] = [];
  private random = rng(4242);
  private budget: number;

  constructor(private ctx: GameContext) {
    this.budget = Math.max(120, this.ctx.settings.npcLimit * 14);
  }

  get list() {
    return this.records;
  }

  get count() {
    return this.records.length;
  }

  countOf(kind: SpawnRecord["kind"]) {
    return this.records.filter((r) => r.kind === kind).length;
  }

  private uniqueId(base: string) {
    let id = `${base}-${++this.counter}`;
    while (this.ctx.world.objects.has(id)) id = `${base}-${++this.counter}`;
    return id;
  }

  /** Envia um comando cru de criação; devolve o id quando aceito. */
  raw(id: string, patch: Record<string, unknown>, kind: SpawnRecord["kind"] = "prop") {
    const before = this.ctx.world.objects.size;
    this.ctx.world.command({ type: "spawn", id, patch });
    if (this.ctx.world.objects.size === before) return null;
    this.records.push({ id, kind, at: this.ctx.time });
    this.store().spawned += 1;
    this.store().spawnedNow = this.records.length;
    this.enforceBudget();
    return id;
  }

  private store() {
    return this.ctx.store;
  }

  /** Cria um item do catálogo, expandindo grupos (fila, pilha, leque, andaime). */
  spawn(itemId: string, options: SpawnOptions = {}): string[] {
    const item: Spawnable = spawnableFor(itemId);
    const origin = this.resolveOrigin(item, options);
    const yaw = options.yaw ?? this.ctx.rig.yaw;
    const created: string[] = [];
    const group =
      (item.patch.spawnRow as GroupOptions | undefined) ??
      (item.patch.spawnStack as GroupOptions | undefined) ??
      (item.patch.spawnFan as GroupOptions | undefined);
    const scaffold = item.patch.scaffold as GroupOptions | undefined;
    if (group) {
      const count = Math.max(1, Math.min(24, Number(group.count) || 1));
      const row = !!item.patch.spawnRow;
      const step = (group.step as number[]) ?? [1, 0, 0];
      const radius = Number(group.radius) || 3;
      const arc = Number(group.arc) || Math.PI;
      for (let i = 0; i < count; i++) {
        let offsetX = 0;
        let offsetZ = 0;
        if (row) {
          offsetX = (i - (count - 1) / 2) * step[0];
          offsetZ = step[2] ? (i - (count - 1) / 2) * step[2] : 0;
        } else if (item.patch.spawnStack) {
          // pilha cresce no eixo Y (tratado abaixo por offsetY)
        } else {
          const angle = yaw + (i / Math.max(1, count - 1) - 0.5) * arc;
          offsetX = Math.sin(angle) * radius;
          offsetZ = Math.cos(angle) * radius;
        }
        const offsetY = item.patch.spawnStack ? i * (Number(step[1]) || 1.8) : 0;
        const patch = this.groupPatch(item, group, offsetX, offsetY, offsetZ, yaw);
        created.push(...this.commit(patch, origin, options));
      }
    } else if (scaffold) {
      const floors = Math.max(1, Math.min(6, Number(scaffold.floors) || 2));
      const height = Number(scaffold.height) || 3;
      const size = Number(scaffold.size) || 4;
      for (let floor = 0; floor < floors; floor++) {
        created.push(
          ...this.commit(
            { ...this.stripComposites(item.patch), position: undefined, x: undefined, y: undefined, z: undefined, kind: "box", scale: [size, 0.3, size], color: "#7d8288", textureId: "tex-grade", physics: "static", name: `${item.name} piso ${floor + 1}`, _offset: [0, floor * height, 0] },
            origin,
            options,
          ),
        );
        for (const [dx, dz] of [
          [size / 2 - 0.3, size / 2 - 0.3],
          [-(size / 2 - 0.3), size / 2 - 0.3],
          [size / 2 - 0.3, -(size / 2 - 0.3)],
          [-(size / 2 - 0.3), -(size / 2 - 0.3)],
        ])
          created.push(
            ...this.commit(
              {
                kind: "box",
                scale: [0.24, height, 0.24],
                color: "#6f7479",
                physics: "static",
                textureId: "tex-metal",
                name: `${item.name} coluna ${floor + 1}`,
                _offset: [dx, floor * height + height / 2, dz],
              },
              origin,
              options,
            ),
          );
      }
    } else {
      created.push(...this.commit(this.stripComposites(item.patch), origin, options));
    }
    if (!options.silent) {
      this.ctx.world.audio.play("spawn.item", 0.5, 0.9 + this.random() * 0.3);
      this.ctx.fx.burst("poeira", origin, { amount: 8, scale: 0.6, direction: new THREE.Vector3(0, 1, 0) });
      this.ctx.store.spawnRecent = [
        item.id,
        ...this.ctx.store.spawnRecent.filter((id) => id !== item.id),
      ].slice(0, 8);
    }
    return created;
  }

  private groupPatch(
    item: Spawnable,
    group: GroupOptions,
    offsetX: number,
    offsetY: number,
    offsetZ: number,
    yaw: number,
  ) {
    const patch: Record<string, unknown> = {
      ...this.stripComposites(item.patch),
      kind: (group.kind as string) ?? "box",
      scale: group.scale ?? [0.9, 0.9, 0.9],
      color: group.color ?? item.patch.color,
      mass: group.mass ?? 8,
      physics: (group.physics as string) ?? "dynamic",
      name: item.name,
      _offset: [offsetX, offsetY, offsetZ],
      _yaw: yaw,
    };
    if (group.speed !== undefined) patch.speed = group.speed;
    if (group.actor) patch.actor = group.actor;
    delete patch.spawnRow;
    delete patch.spawnStack;
    delete patch.spawnFan;
    return patch;
  }

  private stripComposites(patch: Record<string, unknown>) {
    const clean = { ...patch };
    delete clean.spawnRow;
    delete clean.spawnStack;
    delete clean.spawnFan;
    delete clean.scaffold;
    delete clean._offset;
    delete clean._yaw;
    return clean;
  }

  private commit(
    patch: Record<string, unknown>,
    origin: THREE.Vector3,
    options: SpawnOptions,
  ) {
    const offset = (patch._offset as [number, number, number] | undefined) ?? [0, 0, 0];
    const yaw = (patch._yaw as number | undefined) ?? options.yaw ?? this.ctx.rig.yaw;
    const clean = this.stripComposites(patch);
    const name = typeof clean.name === "string" ? clean.name : "Item";
    const id = this.uniqueId(`gf-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 18)}`);
    const rotated = new THREE.Vector3(offset[0], offset[1], offset[2]).applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      yaw,
    );
    const position = origin.clone().add(rotated);
    clean.x = position.x;
    clean.y = position.y;
    clean.z = position.z;
    if (options.velocity) {
      clean.vx = options.velocity.x;
      clean.vy = options.velocity.y;
      clean.vz = options.velocity.z;
    }
    const scaleFactor = options.scale ?? 1;
    if (scaleFactor !== 1) {
      const base = (Array.isArray(clean.scale) ? clean.scale : [1, 1, 1]) as number[];
      clean.scale = base.map((v) => Number(v) * scaleFactor);
    }
    const strict = !!(clean.actor as { humanoid?: boolean } | undefined)?.humanoid;
    const kind: SpawnRecord["kind"] = options.kind ?? (strict ? "npc" : "prop");
    if (strict && this.countOf("npc") >= this.ctx.settings.npcLimit) {
      this.ctx.store.pushToast("Limite de NPCs atingido. Remova alguns antes de criar mais.", "bad");
      return [];
    }
    const id2 = this.raw(id, clean, kind);
    return id2 ? [id2] : [];
  }

  private resolveOrigin(item: Spawnable, options: SpawnOptions) {
    if (options.position) return options.position.clone();
    const direction = new THREE.Vector3();
    this.ctx.camera.getWorldDirection(direction);
    const base = this.ctx.camera.getWorldPosition(new THREE.Vector3());
    const grouped = !!(item.patch.spawnStack || item.patch.spawnFan || item.patch.spawnRow || item.patch.scaffold);
    const forward = options.forward ?? (grouped ? 3.6 : 2.2);
    const point = base.clone().addScaledVector(direction, forward);
    point.y = Math.max(point.y + (options.height ?? -0.6), 0.6);
    return point;
  }

  /** Estilhaço físico (destruição, gore, vidro). */
  chunk(
    position: THREE.Vector3,
    size: THREE.Vector3,
    color: string,
    velocity: THREE.Vector3,
    options: { mass?: number; restitution?: number; kind?: SpawnRecord["kind"]; life?: number } = {},
  ) {
    const id = this.uniqueId("gf-estilhaco");
    const patch: Record<string, unknown> = {
      kind: "box",
      name: "Estilhaço",
      scale: [
        Math.max(0.05, size.x * (0.4 + this.random() * 0.5)),
        Math.max(0.05, size.y * (0.4 + this.random() * 0.5)),
        Math.max(0.05, size.z * (0.4 + this.random() * 0.5)),
      ],
      color,
      physics: "dynamic",
      mass: options.mass ?? 0.6,
      restitution: options.restitution ?? 0.35,
      friction: 0.5,
      x: position.x + (this.random() - 0.5) * 0.3,
      y: position.y + (this.random() - 0.5) * 0.3,
      z: position.z + (this.random() - 0.5) * 0.3,
      rx: this.random() * 720 - 360,
      ry: this.random() * 720 - 360,
      rz: this.random() * 720 - 360,
      vx: velocity.x,
      vy: velocity.y,
      vz: velocity.z,
    };
    const created = this.raw(id, patch, options.kind ?? "debris");
    if (created && options.life)
      window.setTimeout(() => this.remove(created), options.life * 1000);
    return created;
  }

  /** Cápsula/casca ejetada pela arma: detalhe barato que reforça o tiro. */
  ejectShell(position: THREE.Vector3, velocity: THREE.Vector3, color = "#d8b46a") {
    const id = this.uniqueId("gf-casca");
    return this.raw(
      id,
      {
        kind: "cylinder",
        name: "Casca",
        scale: [0.05, 0.16, 0.05],
        color,
        metalness: 0.85,
        roughness: 0.3,
        physics: "dynamic",
        mass: 0.05,
        restitution: 0.4,
        friction: 0.4,
        x: position.x,
        y: position.y,
        z: position.z,
        rx: this.random() * 360,
        rz: this.random() * 360,
        vx: velocity.x,
        vy: velocity.y,
        vz: velocity.z,
      },
      "shell",
    );
  }

  /** Corpo elástico criado por impacto de projétil de gelatina. */
  jellyBlob(
    position: THREE.Vector3,
    size: [number, number, number],
    stiffness: number,
    velocity: THREE.Vector3,
    color = "#6ff0c0",
  ) {
    const id = this.uniqueId("gf-gelatina");
    return this.raw(
      id,
      {
        kind: "box",
        name: "Gelatina disparada",
        scale: size,
        color,
        physics: "dynamic",
        mass: 6,
        restitution: 0.2,
        friction: 0.4,
        deform: {
          type: "jelly",
          stiffness,
          damping: 2.4,
          volume: 0.9,
          maxStretch: 1.9,
          fluidity: 0,
          intensity: 1.5,
          movementInfluence: 1.2,
          maintainRadius: true,
          radiusConstraint: 0.3,
          surfaceCollision: true,
        },
        x: position.x,
        y: position.y,
        z: position.z,
        vx: velocity.x,
        vy: velocity.y,
        vz: velocity.z,
      },
      "prop",
    );
  }

  /** Duplica um nó existente (ferramenta Duplicador). */
  clone(nodeId: string, offset = new THREE.Vector3(0, 0, 1.2)): string | null {
    const node = this.ctx.world.configs.find((n) => n.id === nodeId);
    const object = this.ctx.world.objects.get(nodeId);
    if (!node || !object || node.behavior === "player") return null;
    const position = object.getWorldPosition(new THREE.Vector3()).add(offset);
    const patch: Record<string, unknown> = {
      ...JSON.parse(JSON.stringify(node)),
      name: `${node.name} (cópia)`,
      x: position.x,
      y: position.y,
      z: position.z,
      vx: 0,
      vy: 0,
      vz: 0,
    };
    delete patch.id;
    delete patch.parent;
    delete patch.script;
    patch.behavior = "none";
    const id = this.uniqueId("gf-copia");
    const npc = node.actor.humanoid;
    return this.raw(id, patch, npc ? "npc" : "prop");
  }

  remove(id: string) {
    if (id === this.ctx.world.playerId) return;
    this.ctx.world.command({ type: "remove", id });
    this.records = this.records.filter((r) => r.id !== id);
    this.store().spawnedNow = this.records.length;
  }

  /** Remove o que o jogador criou (mantendo o cenário original do pátio). */
  clearSpawned(keepNpcs = false) {
    let removed = 0;
    for (const record of [...this.records]) {
      if (keepNpcs && record.kind === "npc") continue;
      this.remove(record.id);
      removed++;
    }
    if (removed) this.ctx.store.pushToast(`${removed} objetos removidos.`, "info");
    return removed;
  }

  /** Estilhaços e cascas somem sozinhos para o orçamento nunca estourar. */
  private enforceBudget() {
    if (this.records.length <= this.budget) return;
    let removed = 0;
    for (const record of [...this.records]) {
      if (this.records.length <= this.budget * 0.8) break;
      if (record.kind !== "debris" && record.kind !== "shell") continue;
      this.remove(record.id);
      removed++;
    }
    if (removed)
      this.ctx.store.pushToast(
        `Limpeza automática: ${removed} destroços reciclados (custo ${this.budget}).`,
        "info",
      );
  }

  /** Peso total no orçamento, para o HUD de diagnóstico. */
  weight() {
    return this.records.reduce((sum, record) => sum + (record.kind === "debris" ? 0.2 : 1), 0);
  }

  itemWeight(id: string) {
    return spawnWeight(spawnableFor(id));
  }
}
