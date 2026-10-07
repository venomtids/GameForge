import * as THREE from "three";
import * as CANNON from "cannon-es";
import type { GameContext } from "./context";
import type { ToolKind } from "../config/weapons";
import { clamp } from "./util";

/**
 * Ferramentas de sandbox: Gravador (física), Dissolvedor, Solda (ancorar) e
 * Duplicador. Todas trabalham sobre nós e corpos REAIS da engine — nada de
 * cópias paralelas do mundo — então qualquer coisa que você cria pelo menu
 * pode ser agarrada, ancorada, copiada ou apagada.
 */
export class Tools {
  heldId: string | null = null;
  heldDistance = 3;
  private raycaster = new THREE.Raycaster();
  private beam: THREE.LineSegments;
  private glow: THREE.Mesh;
  private cooldown = 0;
  private particleTimer = 0;

  constructor(private ctx: GameContext) {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(),
    ]);
    this.beam = new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({
        color: "#31e7ff",
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.beam.frustumCulled = false;
    this.beam.visible = false;
    this.beam.name = "goreforge-beam";
    this.ctx.scene.add(this.beam);
    this.glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 12, 10),
      new THREE.MeshBasicMaterial({
        color: "#31e7ff",
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.glow.visible = false;
    this.ctx.scene.add(this.glow);
  }

  get holding() {
    return this.heldId;
  }

  /** Aciona a ferramenta (botão esquerdo). */
  trigger(tool: ToolKind, options: { down: boolean } = { down: true }) {
    if (!tool || !options.down) return;
    const hit = this.pick();
    switch (tool) {
      case "physgun": {
        if (this.heldId) {
          this.release("throw");
          return;
        }
        if (!hit) {
          this.ctx.world.audio.play("ui.erro", 0.4, 1.1);
          return;
        }
        const body = hit.nodeId ? this.ctx.world.bodies.get(hit.nodeId) : null;
        if (!body || body.mass <= 0) {
          this.ctx.store.pushToast("Objeto ancorado: use a Solda para soltá-lo.", "bad");
          return;
        }
        this.heldId = hit.nodeId!;
        this.heldDistance = clamp(hit.distance, 1.6, 9);
        body.allowSleep = false;
        body.angularDamping = 0.6;
        body.wakeUp();
        this.ctx.world.audio.play("gravador.agarrar", 0.7, 1);
        this.ctx.store.pushToast("Agarrado — botão direito arremessa", "info");
        break;
      }
      case "dissolve": {
        if (!hit?.nodeId) return;
        this.dissolve(hit.nodeId, hit.point);
        break;
      }
      case "anchor": {
        if (!hit?.nodeId) return;
        this.toggleAnchor(hit.nodeId);
        break;
      }
      case "clone": {
        if (!hit?.nodeId) return;
        const created = this.ctx.spawner.clone(hit.nodeId);
        if (created) {
          this.ctx.world.audio.play("duplicar", 0.6, 1);
          this.ctx.store.pushToast("Objeto duplicado", "good");
        }
        break;
      }
      default:
        break;
    }
  }

  /** Solta (ou arremessa) o objeto do Gravador. */
  release(mode: "drop" | "throw" = "drop") {
    if (!this.heldId) return;
    const body = this.ctx.world.bodies.get(this.heldId);
    if (body) {
      body.angularDamping = 0.01;
      body.allowSleep = true;
      if (mode === "throw") {
        const direction = new THREE.Vector3();
        this.ctx.camera.getWorldDirection(direction);
        const force = 16 * Math.max(1, body.mass * 0.35);
        body.applyImpulse(new CANNON.Vec3(direction.x * force, (direction.y + 0.15) * force, direction.z * force));
        body.wakeUp();
      }
      this.ctx.world.audio.play("gravador.soltar", 0.6, 1);
    }
    this.heldId = null;
    this.beam.visible = false;
    this.glow.visible = false;
  }

  cancel() {
    if (this.heldId) this.release("drop");
  }

  private toggleAnchor(nodeId: string) {
    const node = this.ctx.world.configs.find((n) => n.id === nodeId);
    if (!node || node.behavior === "player") return;
    const next = node.physics === "static" ? "dynamic" : "static";
    this.ctx.world.applyNodePatch(nodeId, { physics: next });
    this.ctx.world.audio.play("solda", 0.55, next === "static" ? 0.9 : 1.2);
    this.ctx.store.pushToast(next === "static" ? "Objeto ancorado" : "Objeto solto", "info");
    const object = this.ctx.world.objects.get(nodeId);
    if (object) {
      const point = object.getWorldPosition(new THREE.Vector3());
      this.ctx.fx.burst("faisca", point, { amount: 16, scale: 0.8, direction: new THREE.Vector3(0, 1, 0) });
      this.ctx.fx.flash(point, 6, 0.12, "#ffd166");
    }
  }

  /** Apaga o objeto escolhido devolvendo o material em partículas. */
  dissolve(nodeId: string, point: THREE.Vector3) {
    if (nodeId === this.ctx.world.playerId) return;
    const node = this.ctx.world.configs.find((n) => n.id === nodeId);
    const object = this.ctx.world.objects.get(nodeId);
    if (!node || !object) return;
    const center = object.getWorldPosition(new THREE.Vector3());
    this.ctx.fx.burst("dissolver", center, { amount: 34, scale: 1.3, jitter: 0.5 });
    this.ctx.fx.burst("poeira", center, { amount: 10, scale: 0.8, jitter: 0.4 });
    this.ctx.world.audio.play("dissolver", 0.7, 1);
    this.ctx.decals.spawn(point, new THREE.Vector3(0, 1, 0), "dissolvido", 0.9, 14);
    this.ctx.destruction.untrack(nodeId);
    this.ctx.spawner.remove(nodeId);
    this.ctx.store.destroyed += 1;
    this.ctx.store.score += 6;
  }

  private pick() {
    const origin = this.ctx.camera.getWorldPosition(new THREE.Vector3());
    const direction = new THREE.Vector3();
    this.ctx.camera.getWorldDirection(direction);
    const range = this.ctx.combat.currentSpec.range;
    this.raycaster.set(origin, direction);
    this.raycaster.near = 0.05;
    this.raycaster.far = range;
    const intersections = this.raycaster.intersectObjects(this.ctx.world.root.children, true);
    for (const intersection of intersections) {
      if (!intersection.object.visible || !(intersection.object as THREE.Mesh).isMesh) continue;
      const nodeId = this.ctx.combat.nodeIdOf(intersection.object);
      if (!nodeId) continue;
      const normal = intersection.face
        ? intersection.face.normal.clone().transformDirection(intersection.object.matrixWorld).normalize()
        : new THREE.Vector3(0, 1, 0);
      return { nodeId, point: intersection.point.clone(), normal, distance: intersection.distance };
    }
    return null;
  }

  update(dt: number) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    const tool = this.ctx.combat.currentSpec.tool;
    if (this.heldId) {
      const body = this.ctx.world.bodies.get(this.heldId);
      if (!body) {
        this.heldId = null;
        this.beam.visible = false;
        this.glow.visible = false;
        return;
      }
      const origin = this.ctx.camera.getWorldPosition(new THREE.Vector3());
      const direction = new THREE.Vector3();
      this.ctx.camera.getWorldDirection(direction);
      const target = origin.clone().addScaledVector(direction, this.heldDistance);
      const position = new THREE.Vector3(body.position.x, body.position.y, body.position.z);
      const offset = target.clone().sub(position);
      const distance = offset.length();
      const speed = clamp(distance * 12, 0, 30);
      body.velocity.set(
        offset.x * Math.min(1, speed / Math.max(0.001, distance)),
        offset.y * Math.min(1, speed / Math.max(0.001, distance)),
        offset.z * Math.min(1, speed / Math.max(0.001, distance)),
      );
      body.angularVelocity.scale(0.92, body.angularVelocity);
      body.wakeUp();
      /* feixe: da boca da arma até o objeto */
      const muzzle = this.ctx.combat.muzzlePoint();
      const positions = this.beam.geometry.attributes.position as THREE.BufferAttribute;
      positions.setXYZ(0, muzzle.x, muzzle.y, muzzle.z);
      positions.setXYZ(1, position.x, position.y, position.z);
      positions.needsUpdate = true;
      this.beam.geometry.computeBoundingSphere();
      this.beam.visible = true;
      this.glow.position.copy(position);
      this.glow.visible = true;
      this.particleTimer -= dt;
      if (this.particleTimer <= 0) {
        this.particleTimer = 0.05;
        this.ctx.fx.burst("plasma", position, { amount: 2, scale: 0.4, jitter: 0.3 });
      }
    } else {
      this.beam.visible = false;
      this.glow.visible = false;
    }

    /* Dissolvedor automático segura o gatilho: apaga em sequência. */
    if (tool === "dissolve" && this.ctx.store.firing && this.cooldown <= 0) {
      this.cooldown = 0.12;
      const hit = this.pick();
      if (hit?.nodeId) this.dissolve(hit.nodeId, hit.point);
    }
    /* Duplicador automático: cria cópias enquanto segura. */
    if (tool === "clone" && this.ctx.store.firing && this.cooldown <= 0) {
      this.cooldown = 0.3;
      const hit = this.pick();
      if (hit?.nodeId) {
        const created = this.ctx.spawner.clone(hit.nodeId, new THREE.Vector3(0, 1.1, 0.8));
        if (created) this.ctx.world.audio.play("duplicar", 0.4, 1.05);
      }
    }
  }

  reset() {
    this.release("drop");
  }

  dispose() {
    this.beam.geometry.dispose();
    (this.beam.material as THREE.Material).dispose();
    this.beam.removeFromParent();
    this.glow.geometry.dispose();
    (this.glow.material as THREE.Material).dispose();
    this.glow.removeFromParent();
  }
}
