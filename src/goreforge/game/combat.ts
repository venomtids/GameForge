import * as THREE from "three";
import * as CANNON from "cannon-es";
import type { GameContext } from "./context";
import {
  damageAtRange,
  effectiveSpread,
  fireInterval,
  weaponFor,
  type WeaponSpec,
} from "../config/weapons";
import { clamp, coneDirection, rng } from "./util";

type SurfaceMaterial = "madeira" | "metal" | "concreto" | "vidro" | "gelatina" | "tecido" | "explosivo";

interface HitInfo {
  nodeId: string | null;
  object: THREE.Object3D;
  point: THREE.Vector3;
  normal: THREE.Vector3;
  distance: number;
}

interface Projectile {
  id: string;
  weapon: string;
  spec: WeaponSpec;
  bornAt: number;
  fuse: number;
  trail: number;
  last: THREE.Vector3;
  handler?: (event: { body: CANNON.Body }) => void;
}

/**
 * Combate: disparo, propagação de dano, projéteis, corpo a corpo e recuo.
 *
 * A detecção usa o raycast do three sobre as MALHAS REAIS (inclusive as
 * gelatinas deformadas por PhysicalRig e os membros do ragdoll), então acertar
 * um corpo mole em movimento acerta exatamente o triângulo que está lá.
 * Objetos elásticos ainda recebem reação localizada via contactImpulse.
 */
export class Combat {
  recoil = new THREE.Vector2();
  recoilVelocity = new THREE.Vector2();
  spread = 0;
  private cooldown = 0;
  private projectiles = new Map<string, Projectile>();
  private raycaster = new THREE.Raycaster();
  private origin = new THREE.Vector3();
  private direction = new THREE.Vector3();
  private random = rng(2044);
  private up = new THREE.Vector3(0, 1, 0);

  constructor(private ctx: GameContext) {}

  get projectileCount() {
    return this.projectiles.size;
  }

  get currentSpec() {
    return weaponFor(this.ctx.store.weapon);
  }

  /* --------------------------------------------------------------- mira --- */
  /** Arma atual com o recuo aplicado (usada pelo view model e pelo tiro). */
  aimDirection(out?: THREE.Vector3) {
    const target = out ?? new THREE.Vector3();
    this.ctx.camera.getWorldDirection(target);
    return target;
  }

  muzzlePoint() {
    const spec = this.currentSpec;
    const local = new THREE.Vector3(...spec.view.muzzle);
    this.ctx.camera.updateMatrixWorld();
    return this.ctx.camera.localToWorld(local.clone());
  }

  /* ----------------------------------------------------------- gatilho --- */
  triggerDown() {
    const store = this.ctx.store;
    const spec = this.currentSpec;
    store.firing = true;
    if (spec.kind === "tool") {
      this.ctx.tools.trigger(spec.tool, { down: true });
      return;
    }
    if (this.cooldown <= 0) this.attemptFire();
  }

  triggerUp() {
    this.ctx.store.firing = false;
    const spec = this.currentSpec;
    if (spec.kind === "tool") this.ctx.tools.release("drop");
  }

  reload() {
    const store = this.ctx.store;
    const spec = this.currentSpec;
    if (spec.magazine <= 0 || store.reloading > 0) return;
    const ammo = store.ammoOf();
    if (store.settings.infiniteAmmo || (ammo.mag < spec.magazine && ammo.reserve > 0)) {
      store.reloading = spec.reload;
      this.ctx.world.audio.play(spec.sfx.reload, 0.8, 1);
      this.ctx.tools.cancel();
    } else if (ammo.mag <= 0) {
      this.ctx.world.audio.play(spec.sfx.empty, 0.5, 1);
    }
  }

  private attemptFire() {
    const store = this.ctx.store;
    const spec = this.currentSpec;
    const ammo = store.ammoOf();
    if (spec.magazine > 0 && !store.settings.infiniteAmmo && ammo.mag <= 0) {
      store.reloading = spec.reload;
      this.ctx.world.audio.play(spec.sfx.empty, 0.5, 1.2);
      this.ctx.store.pushToast("Carregador vazio — recarregue (R)", "bad");
      return;
    }
    if (!store.consume()) {
      this.ctx.world.audio.play(spec.sfx.empty, 0.5, 1.2);
      return;
    }
    this.cooldown = fireInterval(spec);
    store.shots += 1;
    const moving = this.ctx.player.speedRatio();
    this.spread = effectiveSpread(spec, {
      moving,
      airborne: !this.ctx.player.grounded,
      ads: store.ads,
      crouched: this.ctx.player.crouched,
    });
    if (spec.kind === "melee") this.melee(spec);
    else if (spec.kind === "projectile") this.launch(spec);
    else this.hitscan(spec);
    this.applyKick(spec);
  }

  private applyKick(spec: WeaponSpec) {
    const scale = this.ctx.store.ads ? 0.65 : 1;
    const pitch = spec.recoil.pitch * scale * (0.85 + this.random() * 0.3);
    const yaw = (this.random() - 0.5) * spec.recoil.yaw * scale * 2;
    this.ctx.rig.pitch = clamp(this.ctx.rig.pitch + pitch, -1.4, 1.4);
    this.ctx.rig.yaw += yaw;
    this.recoilVelocity.x += pitch * 22;
    this.recoilVelocity.y += yaw * 20;
    this.ctx.fx.shake(spec.shake);
    this.ctx.fx.muzzleFlash(this.muzzlePoint(), this.aimDirection(), spec.tracer, spec.view.kick);
    this.ctx.world.audio.play(spec.sfx.fire, 0.85, 0.96 + this.random() * 0.08);
    const eject = spec.view.eject;
    if (eject && this.random() < 0.9)
      this.ctx.spawner.ejectShell(
        this.ctx.camera.localToWorld(new THREE.Vector3(...eject)),
        new THREE.Vector3(
          (0.6 + this.random()) * Math.cos(this.ctx.rig.yaw) * 2,
          2 + this.random(),
          (0.6 + this.random()) * Math.sin(this.ctx.rig.yaw) * 2,
        ),
      );
  }

  /* ------------------------------------------------------------ hitscan --- */
  private hitscan(spec: WeaponSpec) {
    const origin = this.ctx.camera.getWorldPosition(this.origin);
    const base = this.aimDirection(this.direction);
    const muzzle = this.muzzlePoint();
    const spreadRad = THREE.MathUtils.degToRad(this.spread);
    const shots = Math.max(1, spec.pellets);
    let anyHit = false;
    for (let i = 0; i < shots; i++) {
      const direction = coneDirection(base, spreadRad, this.random, new THREE.Vector3());
      const hits = this.castRay(
        origin,
        direction,
        spec.range,
        Math.max(1, spec.penetration + 1),
      );
      if (!hits.length) {
        this.ctx.fx.tracer(
          muzzle,
          origin.clone().addScaledVector(direction, spec.range),
          spec.tracer,
        );
        continue;
      }
      let remaining = damageAtRange(spec, hits[0].distance);
      let pierced = 0;
      for (const hit of hits) {
        const hitDamage = remaining;
        this.resolveHit(hit, hitDamage, direction, spec);
        anyHit = true;
        this.ctx.fx.tracer(
          pierced === 0 ? muzzle : hits[pierced - 1].point,
          hit.point,
          spec.tracer,
        );
        pierced++;
        if (pierced > spec.penetration) break;
        remaining *= 0.72;
      }
    }
    if (anyHit) {
      this.ctx.store.hits += 1;
      this.ctx.store.score += 2;
    }
  }

  /** Raycast com resolução do nó dono (sobe a hierarquia até achar nodeId). */
  private castRay(origin: THREE.Vector3, direction: THREE.Vector3, range: number, max: number) {
    this.raycaster.set(origin, direction);
    this.raycaster.near = 0.02;
    this.raycaster.far = range;
    const intersections = this.raycaster.intersectObjects(this.ctx.world.root.children, true);
    const hits: HitInfo[] = [];
    let lastNode: string | null = null;
    for (const intersection of intersections) {
      if (!intersection.object.visible) continue;
      if (!(intersection.object as THREE.Mesh).isMesh) continue;
      const nodeId = this.nodeIdOf(intersection.object);
      if (nodeId && nodeId === lastNode) continue;
      const normal = intersection.face
        ? intersection.face.normal
            .clone()
            .transformDirection(intersection.object.matrixWorld)
            .normalize()
        : this.up.clone().multiplyScalar(-1);
      hits.push({
        nodeId,
        object: intersection.object,
        point: intersection.point.clone(),
        normal,
        distance: intersection.distance,
      });
      lastNode = nodeId;
      if (hits.length >= max) break;
    }
    return hits;
  }

  nodeIdOf(object: THREE.Object3D) {
    let current: THREE.Object3D | null = object;
    while (current) {
      const id = current.userData?.nodeId;
      if (typeof id === "string") return id;
      current = current.parent;
    }
    return null;
  }

  private materialOf(nodeId: string | null, object: THREE.Object3D): SurfaceMaterial {
    if (!nodeId) return "concreto";
    const profile = this.ctx.destruction.profileOf(nodeId);
    if (profile) return profile.profile.material;
    const node = this.ctx.world.configs.find((n) => n.id === nodeId);
    if (!node) return "concreto";
    if (node.actor.humanoid || node.behavior === "player") return "tecido";
    if (node.deform.type === "jelly") return "gelatina";
    if (node.textureId === "tex-metal" || node.textureId === "tex-grade") return "metal";
    if (node.textureId === "tex-madeira") return "madeira";
    const mesh = object as THREE.Mesh;
    const material = mesh.material as THREE.MeshStandardMaterial | undefined;
    const code = material?.color?.getHexString?.() ?? "";
    if (code.startsWith("c") || code.startsWith("9")) return "concreto";
    return node.kind === "sphere" && node.color === "#9fd8e8" ? "vidro" : "concreto";
  }

  /** Resolve dano, reação física, sangue, estilhaços e som para um acerto. */
  private resolveHit(hit: HitInfo, damage: number, direction: THREE.Vector3, spec: WeaponSpec) {
    const material = this.materialOf(hit.nodeId, hit.object);
    this.ctx.fx.impact(hit.point, hit.normal, material, 1);
    this.ctx.decals.spawn(
      hit.point,
      hit.normal,
      material === "vidro" ? "vidro" : material === "gelatina" ? "gelatina" : "buraco",
      material === "vidro" ? 0.5 : 0.3,
      18,
    );

    const node = hit.nodeId ? this.ctx.world.configs.find((n) => n.id === hit.nodeId) : null;
    /* Corpos macios reagem no ponto exato do triângulo atingido. */
    const rig = hit.nodeId ? this.ctx.world.physicalRigs.get(hit.nodeId) : null;
    if (rig && rig.type === "jelly")
      rig.contactImpulse(hit.point, hit.normal.clone().multiplyScalar(-1), spec.impulse * 0.5);

    const body = hit.nodeId ? this.ctx.world.bodies.get(hit.nodeId) : null;
    if (body && body.mass > 0 && hit.nodeId !== this.ctx.world.playerId) {
      const impulse = direction.clone().multiplyScalar(spec.impulse);
      const relative = new CANNON.Vec3(
        hit.point.x - body.position.x,
        hit.point.y - body.position.y,
        hit.point.z - body.position.z,
      );
      body.applyImpulse(new CANNON.Vec3(impulse.x, impulse.y, impulse.z), relative);
      body.wakeUp();
    }

    if (node && (node.actor.humanoid || node.behavior === "player") && node.id !== this.ctx.world.playerId) {
      this.applyHumanoidDamage(node.id, damage, hit, direction, spec);
      return;
    }
    if (hit.nodeId && this.ctx.destruction.profileOf(hit.nodeId)) {
      this.ctx.destruction.damage(hit.nodeId, damage, {
        point: hit.point,
        direction,
        source: this.ctx.world.playerId ?? undefined,
      });
      return;
    }
    if (node && node.deform.type === "jelly") {
      this.ctx.store.pushDamage(Math.round(damage), hit.point, "normal");
      this.ctx.world.audio.play("gelatina.impacto", 0.35, 1 + this.random() * 0.3);
    }
  }

  private applyHumanoidDamage(
    nodeId: string,
    damage: number,
    hit: HitInfo,
    direction: THREE.Vector3,
    spec: WeaponSpec,
  ) {
    const store = this.ctx.store;
    const zone = this.ctx.gibs.partAt(nodeId, hit.point);
    let amount = damage;
    if (zone.head) amount *= store.settings.headshotMultiplier;
    else if (zone.limb) amount *= store.settings.limbMultiplier;
    this.ctx.world.damage(nodeId, amount, spec.name);
    store.damageDealt += amount;
    store.markHit(zone.head);
    store.pushDamage(Math.round(amount), hit.point, zone.head ? "headshot" : "normal");
    this.ctx.gibs.onDamage(nodeId, hit.point, direction, amount, {
      headshot: zone.head,
      limb: zone.limb,
      dismember: spec.gore.dismember,
      blood: spec.gore.blood,
      force: spec.impulse,
    });
    if (zone.head && this.random() < 0.4) this.ctx.world.audio.play("osso.quebrar", 0.4, 1.1);
    const alive = (this.ctx.world.health.get(nodeId) ?? 100) > 0;
    if (!alive) {
      const node = this.ctx.world.configs.find((n) => n.id === nodeId);
      store.addKill(zone.head, spec.name, node?.name ?? nodeId, hit.distance);
      const gib = amount * spec.gore.gib > store.settings.gibThreshold * 0.35;
      this.ctx.gibs.onDeath(nodeId, {
        point: hit.point,
        direction,
        force: amount * spec.gore.gib,
        gib,
      });
    }
  }

  /* --------------------------------------------------------- projéteis --- */
  private launch(spec: WeaponSpec) {
    const projectile = spec.projectile!;
    const origin = this.muzzlePoint().addScaledVector(this.aimDirection(), 0.35);
    const direction = coneDirection(
      this.aimDirection(),
      THREE.MathUtils.degToRad(this.spread),
      this.random,
      new THREE.Vector3(),
    );
    const velocity = direction.clone().multiplyScalar(projectile.speed);
    const spawned = this.ctx.spawner.raw(
      `gf-tiro-${Math.round(this.ctx.time * 1000)}-${Math.round(this.random() * 9999)}`,
      {
        kind: "sphere",
        name: spec.name,
        scale: [projectile.radius * 2, projectile.radius * 2, projectile.radius * 2],
        color: projectile.color,
        emissive: projectile.emissive,
        emissiveIntensity: 1.6,
        physics: "dynamic",
        mass: projectile.jelly ? 6 : 3,
        restitution: projectile.jelly ? 0.35 : 0.15,
        friction: 0.4,
        x: origin.x,
        y: origin.y,
        z: origin.z,
        vx: velocity.x,
        vy: velocity.y,
        vz: velocity.z,
      },
      "projectile",
    );
    if (!spawned) return;
    const entry: Projectile = {
      id: spawned,
      weapon: spec.id,
      spec,
      bornAt: this.ctx.time,
      fuse: projectile.fuse,
      trail: 0,
      last: origin.clone(),
    };
    const body = this.ctx.world.bodies.get(spawned);
    if (body) {
      body.allowSleep = false;
      body.linearDamping = projectile.gravity;
      const handler = () => this.detonate(entry);
      body.addEventListener("collide", handler);
      entry.handler = handler;
    }
    this.projectiles.set(spawned, entry);
    this.ctx.world.audio.play(spec.sfx.fire, 0.9, 0.92 + this.random() * 0.1);
  }

  /** Arrasto por passo: projéteis pesados perdem velocidade e caem em arco. */
  private applyProjectileDrag(entry: Projectile, body: CANNON.Body) {
    const projectile = entry.spec.projectile;
    if (!projectile) return;
    const drag = 1 - clamp(projectile.gravity * 0.02, 0, 0.5);
    body.velocity.x *= drag;
    body.velocity.z *= drag;
  }

  detonate(entry: Projectile) {
    if (!this.projectiles.has(entry.id)) return;
    this.projectiles.delete(entry.id);
    const body = this.ctx.world.bodies.get(entry.id);
    const position = body
      ? new THREE.Vector3(body.position.x, body.position.y, body.position.z)
      : entry.last.clone();
    const projectile = entry.spec.projectile!;
    if (projectile.jelly) {
      this.ctx.spawner.jellyBlob(
        position,
        projectile.jelly.size,
        projectile.jelly.stiffness,
        new THREE.Vector3(
          (body?.velocity.x ?? 0) * 0.3,
          (body?.velocity.y ?? 0) * 0.2 + 1,
          (body?.velocity.z ?? 0) * 0.3,
        ),
        projectile.color,
      );
      this.ctx.fx.burst("gelatina", position, { amount: 20, scale: 1.4 });
      this.ctx.world.audio.play("gelatina.impacto", 0.6, 1);
      this.ctx.decals.spawn(position, new THREE.Vector3(0, 1, 0), "gelatina", 1.1, 18);
    } else if (projectile.explode) {
      this.ctx.destruction.explode(
        position,
        projectile.explode.radius,
        projectile.explode.force,
        projectile.explode.damage,
        { weapon: entry.spec.name, source: this.ctx.world.playerId ?? undefined },
      );
    }
    this.ctx.spawner.remove(entry.id);
  }

  /* ------------------------------------------------------------- melee --- */
  private melee(spec: WeaponSpec) {
    const melee = spec.melee!;
    const origin = this.ctx.camera.getWorldPosition(this.origin);
    const direction = this.aimDirection(this.direction);
    const hits = this.castRay(origin, direction, melee.reach, 4);
    this.ctx.world.audio.play(spec.sfx.fire, 0.75, 0.95 + this.random() * 0.2);
    if (!hits.length) {
      this.ctx.fx.burst("poeira", origin.clone().addScaledVector(direction, melee.reach * 0.6), {
        amount: 3,
        direction: direction.clone().multiplyScalar(-1),
        scale: 0.5,
      });
      return;
    }
    for (const hit of hits) {
      const factor = 1 - hit.distance / (melee.reach * 1.2);
      this.resolveHit(hit, spec.damage * clamp(factor, 0.35, 1), direction, spec);
      if (hit.nodeId) {
        const body = this.ctx.world.bodies.get(hit.nodeId);
        if (body && body.mass > 0)
          body.applyImpulse(
            new CANNON.Vec3(direction.x * melee.force, direction.y * melee.force + 2, direction.z * melee.force),
          );
      }
      break;
    }
    this.ctx.store.hits += 1;
  }

  /* ------------------------------------------------------------ update --- */
  update(dt: number) {
    const store = this.ctx.store;
    if (store.reloading > 0) {
      store.reloading -= dt;
      if (store.reloading <= 0) {
        store.reloading = 0;
        if (store.reload()) this.ctx.world.audio.play("recarga.pesada", 0.4, 1.05);
      }
    }
    this.cooldown = Math.max(0, this.cooldown - dt);
    const spec = this.currentSpec;
    if (store.firing && spec.auto && this.cooldown <= 0 && store.reloading <= 0) this.attemptFire();
    /* recuperação do recuo visual */
    this.recoilVelocity.multiplyScalar(Math.exp(-spec.recoil.recovery * dt));
    this.recoil.addScaledVector(this.recoilVelocity, dt);
    this.recoil.multiplyScalar(Math.exp(-spec.recoil.recovery * 0.6 * dt));
    /* projéteis: rastro, gravidade própria e espoleta */
    for (const entry of [...this.projectiles.values()]) {
      const body = this.ctx.world.bodies.get(entry.id);
      if (!body) {
        this.projectiles.delete(entry.id);
        continue;
      }
      const point = new THREE.Vector3(body.position.x, body.position.y, body.position.z);
      entry.trail -= dt;
      if (entry.trail <= 0 && entry.spec.projectile?.trail) {
        entry.trail = 0.02;
        this.ctx.fx.trail(point, entry.spec.projectile.emissive, !entry.spec.projectile.jelly);
      }
      entry.last.copy(point);
      this.applyProjectileDrag(entry, body);
      if (body.position.y < -20) {
        this.projectiles.delete(entry.id);
        this.ctx.spawner.remove(entry.id);
        continue;
      }
      if (entry.fuse > 0 && this.ctx.time - entry.bornAt > entry.fuse) this.detonate(entry);
    }
  }

  /** Limpa projéteis e juntas quebradas (usado no reinício). */
  reset() {
    for (const entry of this.projectiles.values()) {
      const body = this.ctx.world.bodies.get(entry.id);
      if (body && entry.handler) body.removeEventListener("collide", entry.handler);
      this.ctx.spawner.remove(entry.id);
    }
    this.projectiles.clear();
    this.recoil.set(0, 0);
    this.recoilVelocity.set(0, 0);
    this.cooldown = 0;
  }
}
