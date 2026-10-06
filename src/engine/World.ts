import { sampleAnimation } from "./animation";
import { humanoid, animateHumanoid } from "./Humanoid";
import { PhysicalRig } from "./PhysicalRig";
import { JellyCharacter } from "./JellyCharacter";
import {
  DeformedMeshContact,
  resolveDeformedSphere,
} from "./DeformedMeshContact";
import { jellyBox, jellyMaterial } from "./jelly-material";
import { BotController } from "./BotController";
import {
  advancedGeometry,
  configureAdvancedBody,
  pixelTexture,
} from "./surfaces";
import { AudioEngine } from "./Audio";
import { Environment } from "./Environment";
import {
  mergeLight,
  torchDefaults,
  type LightSettings,
  type TorchSettings,
} from "./features07";
import { VoxelVolume } from "./VoxelVolume";
import { makeNode, kindNames, behaviorNames } from "./model";
import { actorDefaults, validateActor, validateDeform } from "./features06";
import type { UIElement } from "./studio-model";
import * as THREE from "three";
import * as CANNON from "cannon-es";
import { controls, Node3D, SceneData, Project } from "./model";

export function geometry(kind: Node3D["kind"]): THREE.BufferGeometry {
  if (kind === "sphere") return new THREE.SphereGeometry(0.5, 24, 16);
  if (kind === "cylinder") return new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
  if (kind === "cone") return new THREE.ConeGeometry(0.5, 1, 8);
  return new THREE.BoxGeometry(1, 1, 1);
}
export function disposeTree(root: THREE.Object3D) {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
      o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => {
        if (m instanceof THREE.MeshStandardMaterial) m.map?.dispose();
        m.dispose();
      });
    }
  });
  root.removeFromParent();
}
export class World {
  private animatedNodes: Node3D[] = [];
  private kinematicIds = new Set<string>();
  private physicalAnimationRoots = new Set<string>();
  motions = new Map<string, { x: number; z: number; speed: number }>();
  turns = new Map<string, number>();
  physicalRigs = new Map<string, PhysicalRig>();
  jellyCharacters = new Map<string, JellyCharacter>();
  private jellyView?: THREE.Vector3;
  private meshContact = new DeformedMeshContact();
  private meshGround?: { body: CANNON.Body; until: number };
  private footProbe = new THREE.Vector3();
  setJellyView(position: THREE.Vector3) {
    (this.jellyView ??= new THREE.Vector3()).copy(position);
  }
  health = new Map<string, number>();
  botOrigins = new Map<string, THREE.Vector3>();
  bots = new BotController();
  lights = new Map<string, THREE.PointLight | THREE.SpotLight>();
  flickers = new Map<string, { until: number; amount: number }>();
  tweens: {
    id: string;
    from: Record<string, number>;
    to: Record<string, number>;
    colorFrom: THREE.Color | null;
    colorTo: THREE.Color | null;
    t: number;
    dur: number;
  }[] = [];
  /** objeto na mao livre do jogador (view model) */
  hand: { kind: string; ate: number } = { kind: "nenhum", ate: 0 };
  /** tremor de camera pedido por script */
  shake: { amount: number; until: number } = { amount: 0, until: -1 };
  torch: TorchSettings = {
    ...torchDefaults,
    offset: [...torchDefaults.offset] as [number, number, number],
  };
  audio = new AudioEngine();
  root = new THREE.Group();
  environment: Environment | null = null;
  voxels: VoxelVolume | null = null;
  ui: UIElement[] = [];
  uiPatches = new Map<string, Record<string, unknown>>();
  events: string[] = [];
  sceneId = "";
  inputFrozen = false;
  settings: Project["settings"] = { background: "#202a30", gravity: -9.81 };
  objects = new Map<string, THREE.Object3D>();
  bodies = new Map<string, CANNON.Body>();
  physics: CANNON.World | null = null;
  configs: Node3D[] = [];
  options = controls({});
  private accumulator = 0;
  private lastJump = -100;
  private lastGelBounce = -100;
  private jumpQueuedUntil = -100;
  private respawnRequested = false;
  elapsed = 0;
  collected = 0;
  total = 0;
  playing = false;
  deaths = 0;
  completed = false;
  checkpointIndex = -1;
  checkpointName = "Início";
  spawn = new THREE.Vector3();
  private lastGround = -100;
  private lastWarning = -100;
  playerId: string | null = null;
  hidden = new Set<string>();
  active = new Set<string>();
  onEvent: (text: string) => void = () => {};
  constructor(public scene: THREE.Scene) {
    scene.add(this.root);
  }
  load(data: SceneData, settings: Project["settings"], playing = false) {
    this.clear();
    this.playing = playing;
    this.options = controls(settings);
    this.configs = structuredClone(data.nodes);
    this.settings = settings;
    this.torch = {
      ...torchDefaults,
      ...(settings.torch ?? {}),
      offset: [...(settings.torch?.offset ?? torchDefaults.offset)] as [
        number,
        number,
        number,
      ],
    };
    this.audio.setVolume(settings.volume ?? 0.9);
    this.sceneId = data.id;
    this.ui = structuredClone(data.ui ?? []);
    if (settings.sky?.enabled)
      this.environment = new Environment(this.scene, settings.sky);
    if (data.voxel) {
      this.voxels = new VoxelVolume(data.voxel, settings.textures ?? []);
      this.root.add(this.voxels.group);
    }
    this.scene.background = new THREE.Color(settings.background);
    for (const n of data.nodes) {
      this.health.set(n.id, n.actor.health);
      const obj = n.actor.humanoid
        ? humanoid(n)
        : n.kind === "group"
          ? new THREE.Group()
          : new THREE.Mesh(
              n.behavior === "collectible"
                ? new THREE.OctahedronGeometry(0.5)
                : n.deform.type === "jelly" && n.kind === "box"
                  ? jellyBox()
                  : (advancedGeometry(n) ?? geometry(n.kind)),
              n.deform.type === "jelly"
                ? jellyMaterial(n.color)
                : new THREE.MeshStandardMaterial({
                    color:
                      n.kind === "terrain" || n.textureId ? "#ffffff" : n.color,
                    vertexColors: n.kind === "terrain",
                    map: this.textureFor(n.textureId, n.scale),
                    transparent: !!n.textureId,
                    alphaTest: n.textureId ? 0.1 : 0,
                    roughness: n.roughness,
                    metalness: n.metalness,
                    flatShading: n.kind === "cone",
                    emissive:
                      n.behavior === "collectible" ? n.color : "#000000",
                    emissiveIntensity: n.behavior === "collectible" ? 0.25 : 0,
                  }),
            );
      obj.name = n.name;
      obj.userData.nodeId = n.id;
      obj.position.fromArray(n.position);
      obj.rotation.set(
        ...(n.rotation.map(THREE.MathUtils.degToRad) as [
          number,
          number,
          number,
        ]),
      );
      obj.scale.fromArray(n.scale);
      obj.visible = n.visible;
      obj.castShadow = n.castShadow;
      obj.receiveShadow = n.receiveShadow;
      this.objects.set(n.id, obj);
      if (n.light.type !== "none") this.createLight(n, obj);
    }
    for (const n of data.nodes)
      (this.objects.get(n.parent ?? "") ?? this.root).add(
        this.objects.get(n.id)!,
      );
    this.animatedNodes = data.nodes.filter(
      (n) =>
        n.animation?.autoplay &&
        n.physics !== "dynamic" &&
        !n.surface &&
        n.deform.type === "none",
    );
    const animated = new Set(this.animatedNodes.map((n) => n.id));
    const byId = new Map(data.nodes.map((n) => [n.id, n]));
    for (const n of data.nodes) {
      if (n.physics !== "static" || n.surface || n.kind === "group") continue;
      let ancestor: string | null = n.id;
      while (ancestor) {
        if (animated.has(ancestor)) {
          this.kinematicIds.add(n.id);
          this.physicalAnimationRoots.add(ancestor);
        }
        ancestor = byId.get(ancestor)?.parent ?? null;
      }
    }
    if (playing) this.applyAnimationPoses(0);
    this.root.updateMatrixWorld(true);
    if (!playing) return;
    for (const n of data.nodes)
      if (n.actor.bot !== "off")
        this.botOrigins.set(
          n.id,
          this.objects.get(n.id)!.getWorldPosition(new THREE.Vector3()),
        );
    this.physics = new CANNON.World({
      gravity: new CANNON.Vec3(0, settings.gravity, 0),
    });
    this.physics.broadphase = new CANNON.SAPBroadphase(this.physics);
    (this.physics.solver as CANNON.GSSolver).iterations = Math.round(
      this.options.solverIterations,
    );
    (this.physics.solver as CANNON.GSSolver).tolerance = 1e-7;
    this.physics.allowSleep = true;
    this.physics.defaultContactMaterial.friction = 0.3;
    const preferred = data.nodes.find(
      (n) => n.id === settings.playerId && n.behavior === "player" && n.visible,
    );
    for (const n of data.nodes) {
      const o = this.objects.get(n.id)!;
      let visible = true;
      o.traverseAncestors((a) => {
        if (!a.visible) visible = false;
      });
      if (!n.visible || !visible) continue;
      this.active.add(n.id);
      if (n.behavior === "collectible") this.total++;
      if (
        n.behavior === "player" &&
        !this.playerId &&
        (!preferred || n.id === preferred.id)
      ) {
        this.playerId = n.id;
        this.spawn.copy(o.getWorldPosition(new THREE.Vector3()));
      }
      this.addBody(n);
    }
    // Reserve the player's rig before environment rigs can exhaust the budget.
    for (const n of [...data.nodes].sort(
      (a, b) => Number(b.id === this.playerId) - Number(a.id === this.playerId),
    ))
      if (
        n.deform.type !== "none" &&
        this.active.has(n.id) &&
        this.bodies.has(n.id)
      )
        this.activateRig(n.id, n.deform.type);
  }
  /** Cria (ou recria) o corpo físico de um nó conforme physics/mass/friction/restitution. */
  addBody(n: Node3D) {
    if (!this.physics || n.physics === "none" || n.kind === "group")
      return null;
    if (["collectible", "checkpoint", "finish", "hazard"].includes(n.behavior))
      return null;
    const o = this.objects.get(n.id);
    if (!o) return null;
    const current = this.bodies.get(n.id);
    if (current) this.physics.removeBody(current);
    const p = o.getWorldPosition(new THREE.Vector3()),
      q = o.getWorldQuaternion(new THREE.Quaternion()),
      s = o.getWorldScale(new THREE.Vector3());
    const shape =
      n.kind === "sphere"
        ? new CANNON.Sphere(Math.max(s.x, s.y, s.z) * 0.5)
        : n.kind === "cylinder" || n.kind === "cone"
          ? new CANNON.Cylinder(
              n.kind === "cone" ? 0 : Math.max(s.x, s.z) * 0.5,
              Math.max(s.x, s.z) * 0.5,
              s.y,
              n.kind === "cone" ? 8 : 12,
            )
          : new CANNON.Box(new CANNON.Vec3(s.x * 0.5, s.y * 0.5, s.z * 0.5));
    const body = new CANNON.Body({
      mass: n.physics === "dynamic" ? n.mass : 0,
      shape,
      position: new CANNON.Vec3(p.x, p.y, p.z),
      quaternion: new CANNON.Quaternion(q.x, q.y, q.z, q.w),
      material: new CANNON.Material({
        friction:
          n.behavior === "player" || n.actor.bot !== "off" ? 0 : n.friction,
        restitution: n.restitution,
      }),
      fixedRotation: n.behavior === "player" || n.actor.bot !== "off",
      allowSleep: n.behavior !== "player" && n.actor.bot === "off",
      linearDamping: n.behavior === "player" ? 0 : 0.01,
    });
    configureAdvancedBody(body, n, s, q);
    if (this.kinematicIds.has(n.id)) {
      body.type = CANNON.Body.KINEMATIC;
      body.allowSleep = false;
    }
    body.updateMassProperties();
    this.bodies.set(n.id, body);
    this.physics.addBody(body);
    const jelly = this.jellyCharacters.get(n.id);
    if (jelly) {
      if (n.physics === "dynamic") {
        jelly.body = body;
        jelly.reset();
      } else {
        jelly.dispose();
        this.jellyCharacters.delete(n.id);
      }
    }
    return body;
  }
  private dropBody(id: string) {
    this.jellyCharacters.get(id)?.dispose();
    this.jellyCharacters.delete(id);
    const body = this.bodies.get(id);
    if (body) this.physics?.removeBody(body);
    this.bodies.delete(id);
  }
  createLight(n: Node3D, o: THREE.Object3D) {
    if (n.light.type === "none") return null;
    const s = n.light,
      light =
        s.type === "spot"
          ? new THREE.SpotLight(
              s.color,
              s.intensity,
              s.distance,
              THREE.MathUtils.degToRad(s.angle),
              s.penumbra,
              s.decay,
            )
          : new THREE.PointLight(s.color, s.intensity, s.distance, s.decay);
    light.name = "node-light";
    light.userData.nodeId = n.id;
    if (light instanceof THREE.SpotLight) {
      light.target.position.set(0, -1, 0);
      light.add(light.target);
      light.target.updateMatrixWorld();
    }
    this.syncLight(light, s);
    o.add(light);
    this.lights.set(n.id, light);
    return light;
  }
  /** Textura do nó com repetição calculada pelo tamanho da peça (1 tile = textureTile m). */
  textureFor(textureId: string | null | undefined, scale: number[]) {
    if (!textureId) return null;
    const t = this.settings.textures?.find((x) => x.id === textureId);
    if (!t) return null;
    const tex = pixelTexture(t);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    this.applyTextureRepeat(tex, scale);
    return tex;
  }
  applyTextureRepeat(tex: THREE.Texture, scale: number[]) {
    const tile = this.settings.textureTile ?? 1.5;
    const dims = scale.map((v) => Math.abs(v)).sort((a, b) => b - a);
    tex.repeat.set(
      Math.max(1, Math.round((dims[0] ?? tile) / tile)),
      Math.max(1, Math.round((dims[1] ?? tile) / tile)),
    );
  }
  private syncLight(
    light: THREE.PointLight | THREE.SpotLight,
    s: LightSettings,
  ) {
    light.visible = s.enabled;
    light.color.set(s.color);
    light.intensity = s.intensity;
    light.distance = s.distance;
    light.decay = s.decay;
    if (light instanceof THREE.SpotLight) {
      light.angle = THREE.MathUtils.degToRad(s.angle);
      light.penumbra = s.penumbra;
    }
    if (light.castShadow !== s.shadows) {
      light.castShadow = s.shadows;
      if (s.shadows) {
        const size = light instanceof THREE.SpotLight ? 1024 : 512;
        light.shadow.mapSize.set(size, size);
        light.shadow.camera.near = 0.2;
        light.shadow.camera.far = Math.max(4, s.distance);
        light.shadow.bias = -0.0015;
        light.shadow.normalBias = 0.03;
        light.shadow.map?.dispose();
        light.shadow.map = null;
      }
    }
  }
  disposeLight(id: string) {
    const light = this.lights.get(id);
    if (!light) return;
    light.shadow?.map?.dispose();
    light.removeFromParent();
    this.lights.delete(id);
  }
  /** Aplica um patch parcial de luz (comando engine.light ou painel Inspetor). */
  applyLight(id: string, patch: any) {
    const n = this.configs.find((c) => c.id === id),
      o = this.objects.get(id);
    if (!n || !o || !patch || typeof patch !== "object") return;
    const merged = mergeLight(n.light, patch),
      typeChanged = merged.type !== n.light.type;
    n.light = merged;
    if (typeChanged || (merged.type !== "none" && !this.lights.has(id))) {
      this.disposeLight(id);
      if (merged.type !== "none") this.createLight(n, o);
    }
    const light = this.lights.get(id);
    if (light) this.syncLight(light, merged);
  }
  flicker(id: string, duration: number, amount: number) {
    if (!Number.isFinite(duration) || !Number.isFinite(amount)) return;
    const entry = {
      until: this.elapsed + THREE.MathUtils.clamp(duration, 0, 60),
      amount: THREE.MathUtils.clamp(amount, 0.05, 1),
    };
    if (id === "*" || !this.lights.has(id))
      for (const key of this.lights.keys()) this.flickers.set(key, entry);
    else this.flickers.set(id, entry);
  }
  torchCommand(patch: any, enabled?: boolean) {
    const clamp = (v: unknown, min: number, max: number, old: number) =>
      typeof v === "number" && Number.isFinite(v)
        ? THREE.MathUtils.clamp(v, min, max)
        : old;
    const p = patch && typeof patch === "object" ? patch : {};
    this.torch = {
      enabled:
        typeof enabled === "boolean"
          ? enabled
          : typeof p.enabled === "boolean"
            ? p.enabled
            : this.torch.enabled,
      color:
        typeof p.color === "string" && /^#[0-9a-f]{6}$/i.test(p.color)
          ? p.color
          : this.torch.color,
      intensity: clamp(p.intensity, 0, 60, this.torch.intensity),
      distance: clamp(p.distance, 0.5, 120, this.torch.distance),
      angle: clamp(p.angle, 5, 90, this.torch.angle),
      penumbra: clamp(p.penumbra, 0, 1, this.torch.penumbra),
      shadows: typeof p.shadows === "boolean" ? p.shadows : this.torch.shadows,
      offset: this.torch.offset,
    };
  }
  /** Tween genérico de transformação/luz resolvido pela engine (suave a 60 quadros). */
  move(id: string, patch: any, seconds: number) {
    const n = this.configs.find((c) => c.id === id),
      o = this.objects.get(id);
    if (!n || !o || !patch || typeof patch !== "object") return;
    const duration = Number.isFinite(seconds)
      ? THREE.MathUtils.clamp(seconds, 0.05, 60)
      : 0.4;
    const from: Record<string, number> = {},
      to: Record<string, number> = {};
    const read = (key: string) => {
      if (key === "x" || key === "y" || key === "z")
        return o.position[key] as number;
      if (key === "rx" || key === "ry" || key === "rz")
        return THREE.MathUtils.radToDeg(o.rotation[key[1] as "x" | "y" | "z"]);
      if (key === "sx" || key === "sy" || key === "sz")
        return o.scale[key[1] as "x" | "y" | "z"];
      return n.light.intensity;
    };
    for (const key of [
      "x",
      "y",
      "z",
      "rx",
      "ry",
      "rz",
      "sx",
      "sy",
      "sz",
      "intensity",
    ]) {
      const value = patch[key];
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      const limit = ["x", "y", "z"].includes(key)
        ? 2000
        : key === "intensity"
          ? 60
          : key.startsWith("s")
            ? 200
            : 3600;
      to[key] = THREE.MathUtils.clamp(value, -limit, limit);
      from[key] = read(key);
    }
    const colorTo =
      typeof patch.color === "string" && /^#[0-9a-f]{6}$/i.test(patch.color)
        ? new THREE.Color(patch.color)
        : null;
    const colorFrom =
      colorTo && o instanceof THREE.Mesh
        ? (o.material as THREE.MeshStandardMaterial).color.clone()
        : null;
    if (!Object.keys(to).length && !colorTo) {
      this.applyNodePatch(id, patch);
      return;
    }
    this.tweens = this.tweens.filter((t) => t.id !== id);
    this.tweens.push({
      id,
      from,
      to,
      colorFrom,
      colorTo,
      t: 0,
      dur: duration,
    });
  }
  private advanceTweens(dt: number) {
    if (!this.tweens.length) return;
    for (const tween of [...this.tweens]) {
      tween.t += Math.min(dt, 0.1);
      const k = Math.min(1, tween.t / tween.dur),
        e = k * k * (3 - 2 * k),
        patch: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(tween.to))
        patch[key] = tween.from[key] + (value - tween.from[key]) * e;
      if (tween.colorFrom && tween.colorTo)
        patch.color =
          "#" + tween.colorFrom.clone().lerp(tween.colorTo, e).getHexString();
      this.applyNodePatch(tween.id, patch, { tweens: true });
      if (k >= 1) this.tweens.splice(this.tweens.indexOf(tween), 1);
    }
  }
  private lightingTick() {
    const t = this.elapsed;
    for (const [id, light] of this.lights) {
      const n = this.configs.find((c) => c.id === id);
      if (!n) continue;
      const event = this.flickers.get(id);
      let amount = Number.isFinite(n.light.flicker) ? n.light.flicker : 0,
        speed = Number.isFinite(n.light.flickerSpeed)
          ? n.light.flickerSpeed
          : 6;
      if (!Number.isFinite(n.light.intensity)) n.light.intensity = 0;
      if (event && t <= event.until) {
        amount = Math.max(amount, event.amount);
        speed = Math.max(speed, 18);
      } else if (event) this.flickers.delete(id);
      if (amount <= 0) {
        if (light.intensity !== n.light.intensity)
          light.intensity = n.light.intensity;
        if (light.visible !== n.light.enabled) light.visible = n.light.enabled;
        continue;
      }
      const noise =
        0.5 + 0.5 * Math.sin(t * speed * 7.3) * Math.sin(t * speed * 3.1);
      light.intensity =
        n.light.intensity * Math.max(0.05, 1 - amount * noise * 0.98);
      if (amount > 0.35 && Math.random() < amount * 0.12) light.visible = false;
      else light.visible = n.light.enabled;
    }
  }
  /** Patch validado de nó usado por engine.set, engine.spawn, tweens e testes. */
  applyNodePatch(id: string, patch: any, options: { tweens?: boolean } = {}) {
    const o = this.objects.get(id),
      n = this.configs.find((c) => c.id === id);
    if (!o || !n || !patch || typeof patch !== "object") return;
    if (patch.deform && typeof patch.deform === "object") {
      // Runtime material/pivot tuning is shared by cages and vertex springs.
      // Changing the rig type still goes through activateRig/restoreRig.
      n.deform = validateDeform({
        ...n.deform,
        ...patch.deform,
        type: n.deform.type,
      });
    }
    if (!options.tweens && this.physicalRigs.has(id)) return;
    const num = (v: unknown, min: number, max: number) =>
      typeof v === "number" && Number.isFinite(v)
        ? THREE.MathUtils.clamp(v, min, max)
        : undefined;
    let moved = false;
    for (const key of ["x", "y", "z"] as const) {
      const value = num(patch[key], -2000, 2000);
      if (value !== undefined) {
        o.position[key] = value;
        moved = true;
      }
    }
    for (const key of ["rx", "ry", "rz"] as const) {
      const value = num(patch[key], -3600, 3600);
      if (value !== undefined) {
        o.rotation[key[1] as "x" | "y" | "z"] = THREE.MathUtils.degToRad(value);
        moved = true;
      }
    }
    const scalePatch =
      Array.isArray(patch.scale) && patch.scale.length === 3
        ? patch.scale
        : ["sx", "sy", "sz"].every((k) => typeof patch[k] === "number")
          ? [patch.sx, patch.sy, patch.sz]
          : null;
    if (scalePatch) {
      const values = (scalePatch as unknown[]).map((v) => num(v, 0.02, 200));
      if (values.every((v) => v !== undefined)) {
        (values as number[]).forEach((v, i) => {
          o.scale.setComponent(i, v);
          n.scale[i] = v;
        });
        if (o instanceof THREE.Mesh) {
          const map = (o.material as THREE.MeshStandardMaterial).map;
          if (map) this.applyTextureRepeat(map, n.scale);
        }
        moved = true;
      }
    }
    if (o instanceof THREE.Mesh) {
      const material = o.material as THREE.MeshStandardMaterial;
      if (
        typeof patch.color === "string" &&
        /^#[0-9a-f]{6}$/i.test(patch.color)
      )
        material.color.set(patch.color);
      for (const key of ["roughness", "metalness"] as const) {
        const value = num(patch[key], 0, 1);
        if (value !== undefined) material[key] = value;
      }
      /* faces e luzes pintadas: brilho proprio (imagem que corta a escuridao) */
      if (
        typeof patch.emissive === "string" &&
        /^#[0-9a-f]{6}$/i.test(patch.emissive)
      ) {
        material.emissive.set(patch.emissive);
        if (!(material.emissiveIntensity > 0)) material.emissiveIntensity = 1;
      }
      if (typeof patch.emissiveIntensity === "number") {
        const value = num(patch.emissiveIntensity, 0, 6);
        if (value !== undefined) material.emissiveIntensity = value;
      }
      if (typeof patch.textureId === "string" || patch.textureId === null) {
        const map = this.textureFor(patch.textureId, n.scale);
        if (map || patch.textureId === null) {
          n.textureId = patch.textureId;
          material.map = map;
          material.color.set(map ? "#ffffff" : n.color);
          material.transparent = !!map;
          material.alphaTest = map ? 0.1 : 0;
          material.needsUpdate = true;
        }
      }
    }
    for (const key of ["visible", "castShadow", "receiveShadow"] as const)
      if (typeof patch[key] === "boolean") o[key] = patch[key];
    for (const key of ["speed", "amplitude"] as const) {
      const value = num(patch[key], 0, 100);
      if (value !== undefined) n[key] = value;
    }
    if (patch.actor && typeof patch.actor === "object") {
      const next = { ...n.actor };
      for (const key of Object.keys(next) as (keyof typeof next)[])
        if (
          typeof patch.actor[key] === typeof next[key] ||
          (typeof next[key] === "string" &&
            typeof patch.actor[key] === "string")
        )
          (next as any)[key] = patch.actor[key];
      n.actor = validateActor(next);
      if (this.bodies.has(id) && n.physics === "dynamic")
        this.bodies.get(id)!.updateMassProperties();
    }
    if (
      typeof patch.behavior === "string" &&
      Object.keys(behaviorNames).includes(patch.behavior)
    )
      n.behavior = patch.behavior;
    if (patch.light && typeof patch.light === "object")
      this.applyLight(id, patch.light);
    const body = this.bodies.get(id);
    if (body) {
      for (const axis of ["x", "y", "z"] as const) {
        const value = num(patch["v" + axis], -100, 100);
        if (value !== undefined) body.velocity[axis] = value;
      }
      const physicsChanged =
        typeof patch.physics === "string" &&
        ["none", "static", "dynamic"].includes(patch.physics) &&
        patch.physics !== n.physics;
      if (physicsChanged) n.physics = patch.physics;
      for (const key of ["mass", "friction", "restitution"] as const) {
        const value = num(
          patch[key],
          key === "mass" ? 0.01 : 0,
          key === "mass" ? 10000 : 1,
        );
        if (value === undefined) continue;
        n[key] = value;
        if (physicsChanged || !body) continue;
        if (key === "mass") {
          body.mass = value;
          body.updateMassProperties();
        } else if (body.material)
          (body.material as CANNON.Material)[key] = value;
      }
      if (
        typeof patch.fixedRotation === "boolean" &&
        body.fixedRotation !== patch.fixedRotation
      ) {
        body.fixedRotation = patch.fixedRotation;
        body.updateMassProperties();
      }
      if (physicsChanged || (n.physics === "none" && this.bodies.has(id))) {
        this.normalizeBody(n);
      } else if (moved) {
        this.syncBody(id);
      } else {
        body.wakeUp();
      }
    } else if (
      typeof patch.physics === "string" &&
      ["static", "dynamic"].includes(patch.physics)
    ) {
      n.physics = patch.physics;
      this.addBody(n);
      if (n.physics === "dynamic" && n.deform.type === "jelly")
        this.activateRig(n.id, "jelly");
    }
    if (moved) o.updateMatrixWorld(true);
  }
  private normalizeBody(n: Node3D) {
    if (n.physics === "none") this.dropBody(n.id);
    else {
      this.addBody(n);
      if (n.physics === "dynamic" && n.deform.type === "jelly")
        this.activateRig(n.id, "jelly");
    }
  }
  private syncBody(id: string) {
    const body = this.bodies.get(id),
      o = this.objects.get(id);
    if (!body || !o) return;
    o.updateWorldMatrix(true, false);
    const p = o.getWorldPosition(new THREE.Vector3()),
      q = o.getWorldQuaternion(new THREE.Quaternion());
    body.position.set(p.x, p.y, p.z);
    body.quaternion.set(q.x, q.y, q.z, q.w);
    body.aabbNeedsUpdate = true;
    body.wakeUp();
  }
  grounded(body: CANNON.Body) {
    return (
      (this.meshGround?.body === body &&
        this.meshGround.until >= this.elapsed &&
        body.velocity.y <= 0.5) ||
      (this.physics?.contacts.some((c) => {
        if (!c.enabled) return false;
        const sign = c.bi === body ? -1 : c.bj === body ? 1 : 0;
        if (!sign || c.ni.y * sign <= 0.5) return false;
        const support = sign < 0 ? c.bj : c.bi;
        // Contacts describe the start of the last physics step. A jump/rebound
        // can already be separating from that support: don't reuse it as ground.
        // Compare relative motion so a rising platform still supports its rider.
        const separating =
          sign *
          ((body.velocity.x - support.velocity.x) * c.ni.x +
            (body.velocity.y - support.velocity.y) * c.ni.y +
            (body.velocity.z - support.velocity.z) * c.ni.z);
        if (separating <= 0.5) return true;
        // The solver can push a slightly penetrated resting body upward. Keep
        // that real support contact, but never a fast jump/boost or a separated
        // contact point (the latter causes one-frame grounded/air pose flicker).
        const gap =
          (c.bj.position.x + c.rj.x - c.bi.position.x - c.ri.x) * c.ni.x +
          (c.bj.position.y + c.rj.y - c.bi.position.y - c.ri.y) * c.ni.y +
          (c.bj.position.z + c.rj.z - c.bi.position.z - c.ri.z) * c.ni.z;
        return separating <= 2 && gap <= 0.005;
      }) ??
        false)
    );
  }
  damage(id: string, amount: number, source = "script") {
    if (!Number.isFinite(amount) || amount < 0) return;
    const n = this.configs.find((n) => n.id === id);
    if (!n) return;
    const old = this.health.get(id) ?? n.actor.health,
      next = Math.max(0, old - Math.min(100, amount));
    this.health.set(id, next);
    if (old > 0 && next === 0) {
      this.onEvent(n.name + " ficou sem vida (" + source + ").");
      if (n.actor.humanoid && n.actor.ragdollOnDeath)
        this.activateRig(id, "ragdoll");
    }
  }
  heal(id: string, amount: number) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    const n = this.configs.find((c) => c.id === id);
    if (!n) return;
    const old = this.health.get(id) ?? n.actor.health;
    this.health.set(id, Math.min(n.actor.health, old + Math.min(100, amount)));
  }
  activateRig(id: string, type: "ragdoll" | "jelly") {
    if (!this.physics || this.physicalRigs.has(id)) return;
    const n = this.configs.find((n) => n.id === id),
      o = this.objects.get(id),
      original = this.bodies.get(id);
    if (!n || !o || n.kind === "terrain" || n.kind === "group") return;
    if (type === "jelly" && this.jellyCharacters.has(id)) return;
    if (
      this.physicalRigs.size +
        this.jellyCharacters.size -
        Number(this.jellyCharacters.has(id)) >=
      12
    ) {
      this.onEvent("Limite: 12 rigs elásticos/físicos por cena.");
      return;
    }
    this.jellyCharacters.get(id)?.dispose();
    this.jellyCharacters.delete(id);
    if (
      type === "jelly" &&
      original &&
      n.physics === "dynamic" &&
      (n.actor.humanoid || n.behavior === "player")
    ) {
      this.jellyCharacters.set(id, new JellyCharacter(n, o, original));
      return;
    }
    const used = new Set(
      [...this.physicalRigs.values()].map((r) => r.collisionGroup),
    );
    let group = 2;
    while (used.has(group)) group <<= 1;
    const rig = new PhysicalRig(
      n,
      o,
      this.physics,
      this.root,
      type,
      original,
      group,
    );
    this.physicalRigs.set(id, rig);
    this.bodies.set(id, rig.anchor);
  }
  restoreRig(id: string) {
    const rig = this.physicalRigs.get(id);
    if (!rig) {
      this.jellyCharacters.get(id)?.reset();
      return;
    }
    const pos = rig.object.getWorldPosition(new THREE.Vector3());
    rig.dispose(true);
    if (rig.original) {
      if (!rig.anchored)
        rig.original.position.set(
          pos.x,
          pos.y + rig.node.scale[1] * 0.4,
          pos.z,
        );
      else {
        const restored = new THREE.Vector3(
          rig.original.position.x,
          rig.original.position.y,
          rig.original.position.z,
        );
        if (rig.object.parent) rig.object.parent.worldToLocal(restored);
        rig.object.position.copy(restored);
      }
      rig.original.velocity.setZero();
      rig.original.angularVelocity.setZero();
      rig.original.aabbNeedsUpdate = true;
      rig.original.wakeUp();
      this.bodies.set(id, rig.original);
    } else this.bodies.delete(id);
    this.physicalRigs.delete(id);
  }
  respawn() {
    if (this.playerId) {
      this.restoreRig(this.playerId);
      const n = this.configs.find((n) => n.id === this.playerId);
      if (n) this.health.set(n.id, n.actor.health);
    }
    const body = this.playerId ? this.bodies.get(this.playerId) : null;
    if (!body) return;
    body.position.set(this.spawn.x, this.spawn.y, this.spawn.z);
    body.velocity.setZero();
    body.angularVelocity.setZero();
    body.wakeUp();
    const config = this.configs.find((n) => n.id === this.playerId);
    if (config?.deform.type === "jelly" && !this.jellyCharacters.has(config.id))
      this.activateRig(config.id, "jelly");
    if (this.playerId) this.jellyCharacters.get(this.playerId)?.reset();
    this.jumpQueuedUntil = -100;
    this.lastGelBounce = -100;
    this.meshGround = undefined;
    this.respawnRequested = false;
    this.deaths++;
    this.lastGround = -100;
    this.onEvent(
      `Retornando a ${this.checkpointName}. Tentativas: ${this.deaths + 1}`,
    );
  }
  private setAnimationPose(n: Node3D, time: number, loop = n.animation!.loop) {
    const object = this.objects.get(n.id);
    if (!object || !n.animation) return;
    const pose = sampleAnimation(n.animation, time, loop);
    object.position.fromArray(pose.position);
    object.rotation.set(
      ...(pose.rotation.map(THREE.MathUtils.degToRad) as [
        number,
        number,
        number,
      ]),
    );
    // Cannon shapes cannot be scaled every frame. Keep authored scale for physical branches.
    if (!this.physicalAnimationRoots.has(n.id) && n.physics === "none")
      object.scale.fromArray(pose.scale);
  }
  private applyAnimationPoses(time: number) {
    for (const n of this.animatedNodes) this.setAnimationPose(n, time);
    this.root.updateMatrixWorld(true);
  }
  previewAnimation(id: string | null, time: number) {
    if (this.playing) return;
    const n = this.configs.find((n) => n.id === id);
    if (n?.animation) this.setAnimationPose(n, time, false);
    this.root.updateMatrixWorld(true);
  }
  restoreAnimationPoses() {
    if (this.playing) return;
    for (const n of this.configs) {
      if (!n.animation) continue;
      const object = this.objects.get(n.id);
      if (!object) continue;
      object.position.fromArray(n.position);
      object.rotation.set(
        ...(n.rotation.map(THREE.MathUtils.degToRad) as [
          number,
          number,
          number,
        ]),
      );
      object.scale.fromArray(n.scale);
    }
    this.root.updateMatrixWorld(true);
  }
  private advanceAnimations(dt: number) {
    if (!this.animatedNodes.length) return;
    this.applyAnimationPoses(this.elapsed);
    const position = new THREE.Vector3(),
      quaternion = new THREE.Quaternion();
    for (const id of this.kinematicIds) {
      const object = this.objects.get(id),
        body = this.bodies.get(id);
      if (!object || !body) continue;
      object.getWorldPosition(position);
      object.getWorldQuaternion(quaternion);
      body.velocity.set(
        (position.x - body.position.x) / dt,
        (position.y - body.position.y) / dt,
        (position.z - body.position.z) / dt,
      );
      body.quaternion.set(
        quaternion.x,
        quaternion.y,
        quaternion.z,
        quaternion.w,
      );
      body.aabbNeedsUpdate = true;
    }
    if (this.physics) this.physics.broadphase.dirty = true;
  }
  /** Latch short keyboard/touch actions at the event, not at the next RAF. */
  queueAction(key: string) {
    if (!this.playing || !this.physics || this.completed || this.inputFrozen)
      return;
    if (key === "r") this.respawnRequested = true;
    if (
      key === " " &&
      this.playerId &&
      !this.physicalRigs.has(this.playerId) &&
      (this.health.get(this.playerId) ?? 100) > 0
    )
      this.jumpQueuedUntil = this.elapsed + 0.12;
  }
  cancelInputActions() {
    this.jumpQueuedUntil = -100;
    this.respawnRequested = false;
  }
  update(dt: number, keys: Set<string>, yaw = 0) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.advanceTweens(dt);
    this.lightingTick();
    if (!this.playing || !this.physics || this.completed) return;
    // Direct callers still get the same buffering as DOM/touch event callers.
    for (const key of [" ", "r"])
      if (keys.has(key)) {
        this.queueAction(key);
        keys.delete(key);
      }
    this.accumulator += Math.min(dt, 0.1);
    const step =
      1 /
      (this.physicalRigs.size || this.jellyCharacters.size
        ? Math.max(120, this.options.physicsHz)
        : this.options.physicsHz);
    while (this.accumulator + 1e-10 >= step && !this.completed) {
      this.accumulator -= step;
      this.stepFixed(step, keys, yaw);
    }
  }
  private stepFixed(dt: number, keys: Set<string>, yaw: number) {
    if (!this.physics) return;
    this.elapsed += dt;
    this.advanceAnimations(dt);
    let player = this.playerId ? this.bodies.get(this.playerId) : null;
    if (player && this.voxels)
      this.voxels.syncColliders(this.physics, player.position);
    if (this.inputFrozen) keys = new Set();
    if (this.respawnRequested && this.playerId) {
      this.respawnRequested = false;
      this.respawn();
      player = this.bodies.get(this.playerId)!;
    }
    if (
      player &&
      !this.physicalRigs.has(this.playerId!) &&
      (this.health.get(this.playerId!) ?? 100) > 0
    ) {
      const config = this.configs.find((n) => n.id === this.playerId)!;
      const dx =
        Number(keys.has("d") || keys.has("arrowright")) -
        Number(keys.has("a") || keys.has("arrowleft"));
      const dz =
        Number(keys.has("s") || keys.has("arrowdown")) -
        Number(keys.has("w") || keys.has("arrowup"));
      const length = Math.hypot(dx, dz) || 1;
      const speed =
        config.speed *
        this.options.moveMultiplier *
        (keys.has("shift") ? this.options.sprintMultiplier : 1);
      player.velocity.x =
        ((dx * Math.cos(yaw) + dz * Math.sin(yaw)) / length) * speed;
      player.velocity.z =
        ((-dx * Math.sin(yaw) + dz * Math.cos(yaw)) / length) * speed;
      if (this.grounded(player) && this.elapsed - this.lastJump > 0.12)
        this.lastGround = this.elapsed;
      if (dx || dz || this.jumpQueuedUntil >= this.elapsed) player.wakeUp();
      if (
        this.jumpQueuedUntil >= this.elapsed &&
        this.elapsed - this.lastGround < 0.1
      ) {
        this.jumpQueuedUntil = -100;
        this.lastGround = -100;
        this.lastJump = this.elapsed;
        player.velocity.y = this.options.jumpSpeed;
        keys.delete(" ");
      }
      if (player.position.y < -18) this.respawn();
    }

    this.bots.update(this, dt);
    for (const [id, m] of this.motions) {
      if (this.physicalRigs.has(id) || (this.health.get(id) ?? 100) <= 0)
        continue;
      const b = this.bodies.get(id),
        o = this.objects.get(id);
      if (b && b.mass) {
        b.velocity.x = m.x * m.speed;
        b.velocity.z = m.z * m.speed;
        b.wakeUp();
      } else if (o) {
        o.position.x += m.x * m.speed * dt;
        o.position.z += m.z * m.speed * dt;
        if (b) {
          o.updateWorldMatrix(true, false);
          const pos = o.getWorldPosition(new THREE.Vector3());
          b.position.set(pos.x, pos.y, pos.z);
          b.aabbNeedsUpdate = true;
        }
      }
    }

    const incomingY = player?.velocity.y ?? 0;
    for (const rig of this.physicalRigs.values()) rig.beforeStep(dt);
    this.physics.step(dt);
    for (const rig of this.physicalRigs.values()) {
      rig.afterStep();
      rig.sync(
        dt,
        this.jellyView,
        player?.position
          ? this.footProbe.set(
              player.position.x,
              player.position.y,
              player.position.z,
            )
          : undefined,
      );
    }
    if (player && this.playerId && !this.physicalRigs.has(this.playerId))
      this.resolveMeshContacts(player);
    if (
      player &&
      !this.inputFrozen &&
      (this.health.get(this.playerId!) ?? 100) > 0
    )
      this.reboundFromJelly(player, incomingY);
    if (player && player.position.y < -18) {
      this.respawn();
      player = this.playerId ? this.bodies.get(this.playerId) : undefined;
    }
    // Copy world-space physics transforms back into the local scene hierarchy.
    for (const n of this.configs) {
      const o = this.objects.get(n.id)!,
        b = this.bodies.get(n.id);
      if (this.physicalRigs.has(n.id)) continue;
      if (b && b.mass > 0) {
        const p = new THREE.Vector3(b.position.x, b.position.y, b.position.z);
        const q = new THREE.Quaternion(
          b.quaternion.x,
          b.quaternion.y,
          b.quaternion.z,
          b.quaternion.w,
        );
        if (o.parent) {
          o.parent.updateWorldMatrix(true, false);
          o.parent.worldToLocal(p);
          q.premultiply(
            o.parent.getWorldQuaternion(new THREE.Quaternion()).invert(),
          );
        }
        o.position.copy(p);
        o.quaternion.copy(q);
      } else if (!b && !n.animation?.autoplay) {
        if (n.behavior === "rotate")
          o.rotation.y =
            THREE.MathUtils.degToRad(n.rotation[1]) + this.elapsed * n.speed;
        if (n.behavior === "float")
          o.position.y =
            n.position[1] + Math.sin(this.elapsed * n.speed) * n.amplitude;
      }
      const turn = this.turns.get(n.id);
      if (turn) {
        o.rotation.y += THREE.MathUtils.degToRad(turn) * dt;
        if (b) {
          b.quaternion.set(
            o.quaternion.x,
            o.quaternion.y,
            o.quaternion.z,
            o.quaternion.w,
          );
          b.aabbNeedsUpdate = true;
          b.wakeUp();
        }
      }
      const jelly = this.jellyCharacters.get(n.id);
      jelly?.resetPose();
      if (n.actor.humanoid)
        animateHumanoid(
          o,
          n,
          dt,
          b?.velocity.x ?? 0,
          b?.velocity.z ?? 0,
          b ? this.grounded(b) : true,
          b?.velocity.y ?? 0,
        );
      if (jelly && b)
        jelly.update(
          dt,
          this.grounded(b),
          this.jellyView,
          n.id === this.playerId,
        );
      if (
        n.behavior === "collectible" &&
        this.active.has(n.id) &&
        !this.hidden.has(n.id) &&
        o.visible
      ) {
        o.rotation.y = this.elapsed * 1.5;
        o.position.y =
          n.position[1] + Math.sin(this.elapsed * 2 + n.position[0]) * 0.12;
        if (
          player &&
          o
            .getWorldPosition(new THREE.Vector3())
            .distanceTo(
              new THREE.Vector3(
                player.position.x,
                player.position.y,
                player.position.z,
              ),
            ) < 1
        ) {
          o.visible = false;
          this.hidden.add(n.id);
          this.collected++;
          this.onEvent(`Cristal coletado • ${this.collected}/${this.total}`);
          if (this.collected === this.total) {
            if (!this.configs.some((c) => c.behavior === "finish"))
              this.completed = true;
            this.onEvent(
              this.completed
                ? "Todos os cristais coletados! Cena concluída."
                : "Todos os cristais coletados! Alcance a chegada.",
            );
          }
        }
      }
    }
    if (player) {
      const p = new THREE.Vector3(
        player.position.x,
        player.position.y,
        player.position.z,
      );
      let index = -1;
      for (const n of this.configs) {
        if (n.behavior === "checkpoint") index++;
        if (
          !["checkpoint", "finish", "hazard"].includes(n.behavior) ||
          !this.active.has(n.id)
        )
          continue;
        const o = this.objects.get(n.id)!;
        const q = o.getWorldPosition(new THREE.Vector3());
        const near =
          Math.hypot(p.x - q.x, p.z - q.z) <
            Math.max(1.2, Math.min(n.scale[0], n.scale[2]) * 0.5) &&
          Math.abs(p.y - q.y) < 2;
        if (
          n.behavior === "checkpoint" &&
          near &&
          index > this.checkpointIndex &&
          this.grounded(player)
        ) {
          this.checkpointIndex = index;
          this.checkpointName = n.name;
          this.spawn.set(q.x, q.y + 1.3, q.z);
          this.onEvent(`${n.name} ativado!`);
        }
        if (
          n.behavior === "hazard" &&
          new THREE.Box3()
            .setFromObject(o)
            .expandByVector(new THREE.Vector3(0.3, 0.8, 0.3))
            .containsPoint(p)
        )
          this.respawn();
        if (n.behavior === "finish" && near && this.grounded(player)) {
          if (this.collected === this.total) {
            this.completed = true;
            player.velocity.setZero();
            this.onEvent(
              `Percurso concluído em ${this.elapsed.toFixed(1)} s • ${this.deaths} quedas.`,
            );
          } else if (this.elapsed - this.lastWarning > 3) {
            this.lastWarning = this.elapsed;
            this.onEvent(
              `Faltam ${this.total - this.collected} cristais para concluir.`,
            );
          }
        }
      }
    }
  }
  /** A limited sphere-vs-triangle narrowphase complements Cannon corner
   * particles for *free* jellies. Anchored parkour pads keep solid flat support. */
  private resolveMeshContacts(player: CANNON.Body) {
    const shape = player.shapes[0];
    if (!(shape instanceof CANNON.Box || shape instanceof CANNON.Sphere))
      return;
    const half =
      shape instanceof CANNON.Box ? shape.halfExtents.y : shape.radius;
    const radius =
      shape instanceof CANNON.Box
        ? Math.max(
            0.04,
            Math.min(shape.halfExtents.x, shape.halfExtents.z) * 0.85,
          )
        : shape.radius;
    for (const rig of this.physicalRigs.values()) {
      if (
        rig.type !== "jelly" ||
        rig.anchored ||
        rig.node.deform.surfaceCollision === false
      )
        continue;
      let deepest: ReturnType<DeformedMeshContact["query"]> = null;
      for (const offset of [-half + radius, 0, half - radius]) {
        this.footProbe.set(
          player.position.x,
          player.position.y + offset,
          player.position.z,
        );
        const contact = this.meshContact.query(
          rig.meshes[0],
          this.footProbe,
          radius,
        );
        if (contact && contact.depth > (deepest?.depth ?? 0)) deepest = contact;
      }
      if (!deepest) continue;
      const normal = deepest.normal;
      const toward =
        player.velocity.x * normal.x +
        player.velocity.y * normal.y +
        player.velocity.z * normal.z;
      if (resolveDeformedSphere(player, deepest) > 0) {
        if (normal.y > 0.5 && player.velocity.y <= 0.5)
          this.meshGround = { body: player, until: this.elapsed + 1 / 40 };
        if (toward < -0.15) {
          rig.contactImpulse(
            deepest.point,
            normal.clone().negate(),
            -toward * player.mass * 0.18,
          );
          rig.surface?.impulse(
            deepest.point,
            normal.clone().negate(),
            Math.min(6, -toward),
            radius * 2,
          );
        }
      }
    }
  }
  private reboundFromJelly(player: CANNON.Body, incomingY: number) {
    if (
      incomingY >= -1 ||
      this.elapsed - this.lastGelBounce < 0.22 ||
      !this.physics
    )
      return;
    for (const c of this.physics.contacts) {
      if (!c.enabled) continue;
      const support =
        c.bi === player && c.ni.y < -0.5
          ? c.bj
          : c.bj === player && c.ni.y > 0.5
            ? c.bi
            : null;
      if (!support) continue;
      const rig = [...this.physicalRigs.values()].find(
        (r) => r.anchored && r.original === support,
      );
      if (!rig || rig.node.restitution < 0.4) continue;
      const elasticity = rig.node.restitution;
      player.velocity.y = Math.min(
        this.options.jumpSpeed * 1.45,
        Math.max(
          this.options.jumpSpeed * (0.65 + elasticity * 0.5),
          -incomingY * elasticity,
        ),
      );
      player.wakeUp();
      this.lastGelBounce = this.lastJump = this.elapsed;
      this.lastGround = this.jumpQueuedUntil = -100;
      this.onEvent(
        "Impulso elástico! Continue na direção da próxima gelatina.",
      );
      break;
    }
  }
  applyScript(id: string, state: any) {
    if (this.physicalRigs.has(id)) return;
    const o = this.objects.get(id);
    if (!o || !state || typeof state !== "object") return;
    const num = (key: string, old: number) =>
      typeof state[key] === "number" && Number.isFinite(state[key])
        ? THREE.MathUtils.clamp(state[key], -10000, 10000)
        : old;
    o.position.set(
      num("x", o.position.x),
      num("y", o.position.y),
      num("z", o.position.z),
    );
    o.rotation.set(
      THREE.MathUtils.degToRad(
        num("rx", THREE.MathUtils.radToDeg(o.rotation.x)),
      ),
      THREE.MathUtils.degToRad(
        num("ry", THREE.MathUtils.radToDeg(o.rotation.y)),
      ),
      THREE.MathUtils.degToRad(
        num("rz", THREE.MathUtils.radToDeg(o.rotation.z)),
      ),
    );
    if (typeof state.visible === "boolean") o.visible = state.visible;
    if (
      o instanceof THREE.Mesh &&
      typeof state.color === "string" &&
      /^#[0-9a-fA-F]{6}$/.test(state.color)
    )
      (o.material as THREE.MeshStandardMaterial).color.set(state.color);
    const b = this.bodies.get(id);
    if (b) {
      for (const axis of ["x", "y", "z"] as const) {
        const value = state["v" + axis];
        if (typeof value === "number" && Number.isFinite(value))
          b.velocity[axis] = THREE.MathUtils.clamp(value, -100, 100);
      }
      if (
        ["x", "y", "z", "rx", "ry", "rz"].some(
          (k) => typeof state[k] === "number",
        )
      ) {
        o.updateWorldMatrix(true, false);
        const p = o.getWorldPosition(new THREE.Vector3()),
          q = o.getWorldQuaternion(new THREE.Quaternion());
        b.position.set(p.x, p.y, p.z);
        b.quaternion.set(q.x, q.y, q.z, q.w);
        b.aabbNeedsUpdate = true;
      }
      b.wakeUp();
    }
  }
  command(c: any) {
    if (!c || typeof c.type !== "string") return;
    if (
      c.type === "walk" &&
      typeof c.id === "string" &&
      this.objects.has(c.id) &&
      [c.x, c.z, c.speed].every(
        (v) => typeof v === "number" && Number.isFinite(v),
      ) &&
      Math.abs(c.x) <= 1000 &&
      Math.abs(c.z) <= 1000 &&
      c.speed >= 0 &&
      c.speed <= 30
    ) {
      const length = Math.hypot(c.x, c.z) || 1;
      this.motions.set(c.id, {
        x: c.x / length,
        z: c.z / length,
        speed: c.speed,
      });
      const n = this.configs.find((n) => n.id === c.id);
      if (n) n.actor.bot = "off";
    }
    if (
      c.type === "rotate" &&
      typeof c.id === "string" &&
      this.objects.has(c.id) &&
      typeof c.speed === "number" &&
      Number.isFinite(c.speed) &&
      Math.abs(c.speed) <= 720
    )
      this.turns.set(c.id, c.speed);
    if (c.type === "stop" && typeof c.id === "string") {
      this.motions.delete(c.id);
      this.turns.delete(c.id);
      const b = this.bodies.get(c.id);
      if (b) {
        b.velocity.x = 0;
        b.velocity.z = 0;
      }
      const n = this.configs.find((n) => n.id === c.id);
      if (n) n.actor.bot = "off";
    }
    if (c.type === "hand" && typeof c.kind === "string")
      this.hand = {
        kind: c.kind.slice(0, 24),
        ate: this.elapsed + (Number.isFinite(c.seconds) ? c.seconds : 0),
      };
    if (c.type === "shake" && Number.isFinite(c.amount))
      this.shake = {
        amount: Math.max(0, Math.min(3, c.amount)),
        until:
          this.elapsed +
          Math.max(
            0.05,
            Math.min(10, Number.isFinite(c.seconds) ? c.seconds : 0.4),
          ),
      };
    if (c.type === "damage" && typeof c.id === "string")
      this.damage(c.id, c.amount);
    if (c.type === "heal" && typeof c.id === "string")
      this.heal(c.id, c.amount);
    if (c.type === "ragdoll" && typeof c.id === "string") {
      if (c.enabled === false) this.restoreRig(c.id);
      else this.activateRig(c.id, "ragdoll");
    }
    if (
      c.type === "impulse" &&
      typeof c.id === "string" &&
      [c.x, c.y, c.z].every(
        (v) =>
          typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= 100,
      )
    ) {
      const rig = this.physicalRigs.get(c.id);
      if (rig) rig.impulse(c.x, c.y, c.z);
      else this.bodies.get(c.id)?.applyImpulse(new CANNON.Vec3(c.x, c.y, c.z));
    }
    if (
      c.type === "bot" &&
      typeof c.id === "string" &&
      ["off", "patrol", "follow", "attack"].includes(c.mode)
    ) {
      const n = this.configs.find((n) => n.id === c.id);
      if (n && n.id !== this.playerId) {
        const body = this.bodies.get(n.id);
        if (c.mode !== "off" && (!body || body.mass <= 0)) return;
        if (body && c.mode !== "off") {
          body.fixedRotation = true;
          body.allowSleep = false;
          body.angularVelocity.setZero();
          body.updateMassProperties();
          body.wakeUp();
        }
        this.motions.delete(c.id);
        n.actor.bot = c.mode;
        if (!this.botOrigins.has(n.id))
          this.botOrigins.set(
            n.id,
            this.objects.get(n.id)!.getWorldPosition(new THREE.Vector3()),
          );
      }
    }

    if (c.type === "set" && typeof c.id === "string")
      this.applyNodePatch(c.id, c.patch);
    if (c.type === "light" && typeof c.id === "string")
      this.applyLight(c.id, c.patch);
    if (c.type === "flicker" && typeof c.id === "string")
      this.flicker(c.id, c.duration, c.amount);
    if (c.type === "torch") this.torchCommand(c.patch, c.enabled);
    if (c.type === "sound" && typeof c.name === "string")
      this.audio.play(c.name, c.volume ?? 1, c.pitch ?? 1);
    if (c.type === "loop" && typeof c.name === "string")
      this.audio.loop(c.name, c.volume ?? 0);
    if (c.type === "volume") this.audio.setVolume(c.value);
    if (
      c.type === "move" &&
      typeof c.id === "string" &&
      c.patch &&
      typeof c.patch === "object"
    )
      this.move(c.id, c.patch, c.seconds);
    if (
      c.type === "ui" &&
      typeof c.id === "string" &&
      this.ui.some((e) => e.id === c.id) &&
      c.patch &&
      typeof c.patch === "object"
    ) {
      const patch: Record<string, unknown> = {};
      if (typeof c.patch.text === "string")
        patch.text = c.patch.text.slice(0, 1200);
      if (typeof c.patch.visible === "boolean") patch.visible = c.patch.visible;
      if (typeof c.patch.value === "number" && Number.isFinite(c.patch.value))
        patch.value = Math.max(0, Math.min(1, c.patch.value));
      for (const key of ["color", "background"])
        if (
          typeof c.patch[key] === "string" &&
          /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(c.patch[key])
        )
          patch[key] = c.patch[key];
      this.uiPatches.set(c.id, { ...this.uiPatches.get(c.id), ...patch });
    }
    if (c.type === "voxel" && Array.isArray(c.cell) && c.cell.length === 3)
      this.voxels?.set(c.cell[0], c.cell[1], c.cell[2], c.block);
    if (
      c.type === "voxelReset" &&
      this.voxels &&
      Array.isArray(c.blocks) &&
      c.blocks.length === this.voxels.data.blocks.length &&
      c.blocks.every(
        (v: unknown) =>
          Number.isInteger(v) &&
          (v as number) >= 0 &&
          (v as number) <= this.voxels!.data.palette.length,
      )
    ) {
      this.voxels.data.blocks = [...c.blocks];
      this.voxels.revision++;
      this.voxels.dirty = true;
    }
    if (c.type === "respawn") this.respawn();
    if (c.type === "freeze" && typeof c.value === "boolean")
      this.inputFrozen = c.value;
    if (c.type === "sky" && Number.isFinite(c.elevation))
      this.environment?.set(
        THREE.MathUtils.clamp(c.elevation, -20, 90),
        Number.isFinite(c.azimuth)
          ? THREE.MathUtils.clamp(c.azimuth, -180, 180)
          : undefined,
      );
    if (
      c.type === "spawn" &&
      typeof c.id === "string" &&
      c.id.length < 100 &&
      !this.objects.has(c.id) &&
      this.configs.length < 1800 &&
      c.patch &&
      typeof c.patch === "object"
    ) {
      const kind =
        Object.keys(kindNames).includes(c.patch.kind) &&
        !["terrain", "group"].includes(c.patch.kind)
          ? c.patch.kind
          : "box";
      const human = c.patch.actor && c.patch.actor.humanoid === true;
      const n = makeNode(kind, {
        id: c.id,
        name:
          typeof c.patch.name === "string" ? c.patch.name.slice(0, 100) : c.id,
        physics: "none",
        ...(human ? { actor: { ...actorDefaults, humanoid: true } } : {}),
      });
      const o = human
        ? humanoid(n)
        : new THREE.Mesh(
            advancedGeometry(n) ?? geometry(kind),
            new THREE.MeshStandardMaterial({ color: "#829c75" }),
          );
      o.userData.nodeId = n.id;
      this.root.add(o);
      this.objects.set(n.id, o);
      this.configs.push(n);
      this.applyNodePatch(n.id, c.patch);
    }
    if (
      c.type === "remove" &&
      typeof c.id === "string" &&
      c.id !== this.playerId
    ) {
      const o = this.objects.get(c.id);
      if (o) {
        this.physicalRigs.get(c.id)?.dispose();
        this.physicalRigs.delete(c.id);
        this.jellyCharacters.get(c.id)?.dispose();
        this.jellyCharacters.delete(c.id);
        this.disposeLight(c.id);
        this.flickers.delete(c.id);
        this.tweens = this.tweens.filter((t) => t.id !== c.id);
        disposeTree(o);
        this.objects.delete(c.id);
        this.motions.delete(c.id);
        this.turns.delete(c.id);
        this.health.delete(c.id);
        this.botOrigins.delete(c.id);
        const body = this.bodies.get(c.id);
        if (body) this.physics?.removeBody(body);
        this.bodies.delete(c.id);
        this.configs = this.configs.filter((n) => n.id !== c.id);
      }
    }
  }
  refresh() {
    if (this.voxels?.dirty) this.voxels.rebuild();
  }
  clear() {
    this.animatedNodes = [];
    this.kinematicIds.clear();
    this.physicalAnimationRoots.clear();
    this.motions.clear();
    this.turns.clear();
    for (const rig of this.physicalRigs.values()) rig.dispose();
    this.physicalRigs.clear();
    this.meshGround = undefined;
    for (const jelly of this.jellyCharacters.values()) jelly.dispose();
    this.jellyCharacters.clear();
    this.health.clear();
    this.botOrigins.clear();
    this.audio.stopAll();
    for (const id of [...this.lights.keys()]) this.disposeLight(id);
    this.flickers.clear();
    this.tweens.length = 0;
    this.torch = {
      ...torchDefaults,
      offset: [...torchDefaults.offset] as [number, number, number],
    };
    this.bots = new BotController();
    this.voxels?.dispose();
    this.voxels = null;
    this.environment?.dispose();
    this.environment = null;
    this.uiPatches.clear();
    this.events = [];
    this.inputFrozen = false;
    for (const child of [...this.root.children]) disposeTree(child);
    this.objects.clear();
    this.bodies.clear();
    this.physics = null;
    this.accumulator = 0;
    this.lastJump = -100;
    this.lastGelBounce = -100;
    this.jumpQueuedUntil = -100;
    this.respawnRequested = false;
    this.elapsed = 0;
    this.deaths = 0;
    this.completed = false;
    this.checkpointIndex = -1;
    this.checkpointName = "Início";
    this.lastGround = -100;
    this.lastWarning = -100;
    this.collected = 0;
    this.total = 0;
    this.hidden.clear();
    this.active.clear();
    this.playerId = null;
  }
  dispose() {
    this.clear();
    this.audio.dispose();
    this.root.removeFromParent();
  }
}
export function addLighting(scene: THREE.Scene) {
  const ambient = new THREE.HemisphereLight("#dbf3ef", "#33303c", 2);
  ambient.name = "studio-ambient";
  scene.add(ambient);
  const sun = new THREE.DirectionalLight("#fff0d2", 3);
  sun.name = "studio-sun";
  sun.position.set(5, 12, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -18;
  sun.shadow.camera.right = 18;
  sun.shadow.camera.top = 18;
  sun.shadow.camera.bottom = -18;
  sun.shadow.normalBias = 0.04;
  scene.add(sun);
  scene.add(sun.target);
  const fill = new THREE.DirectionalLight("#91baff", 1.5);
  fill.name = "studio-fill";
  fill.position.set(-8, 5, -7);
  scene.add(fill);
  return () => {
    sun.shadow.dispose();
    ambient.removeFromParent();
    sun.removeFromParent();
    sun.target.removeFromParent();
    fill.removeFromParent();
  };
}
