import * as THREE from "three";
import { VIEWMODEL_LAYER } from "../../engine/viewmodel";
import type { GameContext } from "./context";
import { weaponFor, type ViewPart, type WeaponSpec } from "../config/weapons";
import { clamp, damp } from "./util";

/**
 * Modelo em primeira pessoa montado por dados (`weapon.view.parts`).
 *
 * Fica na CAMADA 1 (a mesma dos braços da engine): é desenhado num segundo
 * passe com o z-buffer limpo, então nunca atravessa paredes nem briga com a
 * ordenação de transparências. Balanço, recuo, recarga e mira são calculados
 * aqui e resetados a cada quadro (nada acumula).
 */
export class ViewModel {
  root = new THREE.Group();
  private groups = new Map<string, THREE.Group>();
  private current: THREE.Group | null = null;
  private currentId = "";
  private geometryCache = new Map<string, THREE.BufferGeometry>();
  private materials = new Map<string, THREE.MeshStandardMaterial>();
  private phase = 0;
  private swayX = 0;
  private swayY = 0;
  private reloadSpin = 0;
  private adsBlend = 0;
  private swing = 0;

  constructor(private ctx: GameContext) {
    this.root.name = "goreforge-viewmodel";
    this.root.layers.set(VIEWMODEL_LAYER);
    ctx.rig.camera.add(this.root);
    this.equip(ctx.store.weapon);
  }

  private geometry(part: ViewPart) {
    const key = `${part.shape}:${part.size.join(",")}`;
    let geometry = this.geometryCache.get(key);
    if (!geometry) {
      geometry =
        part.shape === "cyl"
          ? new THREE.CylinderGeometry(part.size[0], part.size[1], part.size[2], 12)
          : part.shape === "sphere"
            ? new THREE.SphereGeometry(part.size[0], 12, 10)
            : part.shape === "cone"
              ? new THREE.ConeGeometry(part.size[0], part.size[1], 10)
              : new THREE.BoxGeometry(part.size[0], part.size[1], part.size[2]);
      this.geometryCache.set(key, geometry);
    }
    return geometry;
  }

  private material(part: ViewPart) {
    const key = `${part.color}:${part.metal ?? 0.2}:${part.rough ?? 0.5}:${part.emissive ?? ""}`;
    let material = this.materials.get(key);
    if (!material) {
      material = new THREE.MeshStandardMaterial({
        color: part.color,
        metalness: part.metal ?? 0.2,
        roughness: part.rough ?? 0.5,
        emissive: new THREE.Color(part.emissive ?? "#000000"),
        emissiveIntensity: part.emissive ? 1.4 : 0,
      });
      this.materials.set(key, material);
    }
    return material;
  }

  /** Monta (e memoiza) o grupo do modelo de uma arma. */
  build(spec: WeaponSpec) {
    let group = this.groups.get(spec.id);
    if (group) return group;
    group = new THREE.Group();
    group.scale.setScalar(spec.view.scale);
    for (const part of spec.view.parts) {
      const mesh = new THREE.Mesh(this.geometry(part), this.material(part));
      mesh.position.set(...part.pos);
      if (part.rot) mesh.rotation.set(...part.rot);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      group.add(mesh);
    }
    group.traverse((o) => o.layers.set(VIEWMODEL_LAYER));
    this.groups.set(spec.id, group);
    return group;
  }

  equip(weaponId: string) {
    if (weaponId === this.currentId) return;
    const spec = weaponFor(weaponId);
    const group = this.build(spec);
    if (this.current) this.root.remove(this.current);
    this.root.add(group);
    this.current = group;
    this.currentId = weaponId;
    this.swing = 1;
  }

  get currentWeapon() {
    return this.currentId;
  }

  update(dt: number) {
    const store = this.ctx.store;
    const spec = weaponFor(store.weapon);
    this.equip(store.weapon);
    const group = this.current;
    if (!group) return;
    const visible = this.ctx.settings.viewmodel && store.alive;
    group.visible = visible;
    /* Em mira, os braços da engine saem de cena para dar lugar ao modelo. */
    this.ctx.rig.arms.visible = this.ctx.rig.arms.visible && !store.ads;
    if (!visible) return;

    const player = this.ctx.player;
    const look = this.ctx.input.sampleLook();
    const moving = clamp(player.speed / Math.max(1, this.ctx.settings.walkSpeed), 0, 2);
    const targetAds = store.ads ? 1 : 0;
    this.adsBlend = damp(this.adsBlend, targetAds, store.ads ? 12 : 9, dt);
    this.swing = damp(this.swing, 0, 6, dt);
    this.phase += dt * (1.6 + player.speed * 1.6);

    /* balanço ao andar + oscilação por olhar (o modelo "pesa") */
    const bobAmount = 0.014 * moving * (player.grounded ? 1 : 0.3) * this.ctx.settings.shake;
    const bobY = Math.sin(this.phase * 2) * bobAmount;
    const bobX = Math.cos(this.phase) * bobAmount * 0.8;
    this.swayX = damp(this.swayX, clamp(-look.dx * 6, -0.06, 0.06), 9, dt);
    this.swayY = damp(this.swayY, clamp(-look.dy * 6, -0.05, 0.05), 9, dt);

    /* recuo e recarga */
    const recoil = this.ctx.combat.recoil;
    this.reloadSpin = store.reloading > 0 ? 1 : damp(this.reloadSpin, 0, 6, dt);
    const sprintTilt = player.state === "sprint" ? 1 : 0;

    const hip = new THREE.Vector3(...spec.view.hip);
    const ads = new THREE.Vector3(...spec.view.ads);
    const base = hip.clone().lerp(ads, this.adsBlend);
    const reloadDip = this.reloadSpin * 0.28;
    const swing = this.swing;

    group.position.set(
      base.x + bobX + this.swayX + swing * 0.12 + sprintTilt * 0.04,
      base.y + bobY + this.swayY - reloadDip - swing * 0.18 - this.adsBlend * 0.01,
      base.z + swing * 0.16 + recoil.x * 0.06,
    );
    group.rotation.set(
      -recoil.x * 0.55 - this.swayY * 3 + reloadDip * 1.4 + swing * 0.5 - this.adsBlend * 0.02,
      this.swayX * 4 + sprintTilt * 0.12,
      this.swayX * 2.4 + reloadDip * 0.7 + swing * 0.6 + sprintTilt * 0.18,
    );
    if (this.reloadSpin > 0.01) group.rotateZ(Math.sin(this.reloadSpin * Math.PI) * 0.5);
  }

  /** Ponto do cano no espaço do modelo (para flashes presos à arma). */
  muzzleLocal(spec = weaponFor(this.currentId)) {
    return new THREE.Vector3(...spec.view.muzzle);
  }

  dispose() {
    for (const group of this.groups.values()) {
      for (const child of group.children) {
        if (child instanceof THREE.Mesh) (child.material as THREE.Material).dispose();
      }
      group.removeFromParent();
    }
    for (const geometry of this.geometryCache.values()) geometry.dispose();
    for (const material of this.materials.values()) material.dispose();
    this.groups.clear();
    this.geometryCache.clear();
    this.materials.clear();
    this.root.removeFromParent();
  }
}
