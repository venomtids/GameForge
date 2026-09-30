import { validateAnimation, type AnimationClip } from "./animation";
import {
  flatSurface,
  validateSurface,
  validateTextures,
  validateUI,
  validateVoxel,
  validateSky,
  type PixelTexture,
  type Surface,
  type UIElement,
  type VoxelConfig,
  type SkyConfig,
} from "./studio-model";
import {
  actorDefaults,
  deformDefaults,
  validateActor,
  validateDeform,
  validateShadows,
  type ActorSettings,
  type DeformSettings,
  type ShadowSettings,
} from "./features06";
import {
  lightDefaults,
  validateLight,
  validateTorch,
  type LightSettings,
  type TorchSettings,
} from "./features07";
export type Vec3 = [number, number, number];
export type Kind =
  | "box"
  | "sphere"
  | "cylinder"
  | "cone"
  | "group"
  | "wedge"
  | "capsule"
  | "torus"
  | "arch"
  | "rock"
  | "star"
  | "terrain";
export type Behavior =
  | "none"
  | "rotate"
  | "float"
  | "player"
  | "collectible"
  | "checkpoint"
  | "finish"
  | "hazard";
export type ScriptLanguage = "none" | "lua" | "javascript";
export type CameraMode =
  | "perspective"
  | "first"
  | "third"
  | "free"
  | "iso"
  | "top"
  | "bottom"
  | "front"
  | "back"
  | "left"
  | "right";
export const cameraModes: Record<CameraMode, string> = {
  perspective: "Perspectiva",
  first: "Primeira pessoa",
  third: "Terceira pessoa",
  free: "Livre (orbital)",
  iso: "Isométrica",
  top: "Superior",
  bottom: "Inferior",
  front: "Frontal",
  back: "Traseira",
  left: "Esquerda",
  right: "Direita",
};
export interface Node3D {
  animation: AnimationClip | null;
  actor: ActorSettings;
  deform: DeformSettings;
  light: LightSettings;
  castShadow: boolean;
  receiveShadow: boolean;
  textureId: string | null;
  surface: Surface | null;
  friction: number;
  terrain: boolean;
  locked: boolean;
  script: { language: ScriptLanguage; source: string; enabled: boolean };
  id: string;
  name: string;
  kind: Kind;
  parent: string | null;
  visible: boolean;
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  color: string;
  roughness: number;
  metalness: number;
  physics: "none" | "static" | "dynamic";
  mass: number;
  restitution: number;
  behavior: Behavior;
  speed: number;
  amplitude: number;
}
export interface SceneData {
  ui?: UIElement[];
  voxel?: VoxelConfig;
  id: string;
  name: string;
  nodes: Node3D[];
}
export interface Project {
  format: "gameforge";
  version: 7;
  name: string;
  activeScene: string;
  scenes: SceneData[];
  settings: {
    background: string;
    gravity: number;
    gameCamera?: CameraMode;
    textures?: PixelTexture[];
    sky?: SkyConfig;
    shadows?: ShadowSettings;
    torch?: TorchSettings;
    volume?: number;
    /** metros cobertos por um tile de textura (padrão 1,5 m) */
    textureTile?: number;
    playerId?: string;
  } & Partial<ControlSettings>;
}
export const controlDefaults = {
  moveMultiplier: 1,
  sprintMultiplier: 1.5,
  jumpSpeed: 6.5,
  mouseSensitivity: 1.5,
  orbitSpeed: 1.5,
  panSpeed: 2.5,
  flySpeed: 12,
  editorLook: 1.5,
  zoomSpeed: 1.5,
  followSpeed: 8,
  fov: 78,
  physicsHz: 120,
  solverIterations: 15,
};
export type ControlSettings = typeof controlDefaults;
export const controlFields: [
  keyof ControlSettings,
  string,
  number,
  number,
  number,
][] = [
  ["moveMultiplier", "Velocidade do personagem (multiplicador)", 0.1, 5, 0.1],
  ["sprintMultiplier", "Corrida (multiplicador)", 1, 4, 0.1],
  ["jumpSpeed", "Impulso do pulo (m/s)", 1, 25, 0.1],
  ["mouseSensitivity", "Sensibilidade do mouse FPS", 0.1, 5, 0.1],
  ["orbitSpeed", "Velocidade orbital", 0.1, 5, 0.1],
  ["panSpeed", "Velocidade de deslocamento da câmera", 0.1, 5, 0.1],
  ["flySpeed", "Velocidade de voo no editor", 1, 80, 1],
  ["editorLook", "Sensibilidade do botão direito", 0.1, 5, 0.1],
  ["zoomSpeed", "Velocidade do zoom", 0.1, 5, 0.1],
  ["followSpeed", "Resposta da câmera em terceira pessoa", 1, 25, 1],
  ["fov", "Campo de visão FPS (graus)", 45, 110, 1],
  ["physicsHz", "Física (passos por segundo)", 60, 240, 30],
  ["solverIterations", "Iterações do solver", 5, 30, 1],
];
export function controls(settings: Partial<ControlSettings>): ControlSettings {
  return {
    ...controlDefaults,
    ...Object.fromEntries(
      controlFields.map(([k]) => [k, settings[k] ?? controlDefaults[k]]),
    ),
  };
}
export const kindNames: Record<Kind, string> = {
  box: "Cubo",
  sphere: "Esfera",
  cylinder: "Cilindro",
  cone: "Cone",
  group: "Grupo",
  wedge: "Cunha",
  capsule: "Cápsula",
  torus: "Anel",
  arch: "Arco curvo",
  rock: "Rocha facetada",
  star: "Estrela extrudada",
  terrain: "Terreno contínuo",
};
export const behaviorNames: Record<Behavior, string> = {
  none: "Nenhum",
  rotate: "Rotação",
  float: "Flutuação",
  player: "Jogador WASD",
  collectible: "Coletável",
  checkpoint: "Checkpoint",
  finish: "Chegada",
  hazard: "Zona de dano",
};
export const uid = () => crypto.randomUUID();
export const clone = <T>(data: T): T => structuredClone(data);
export function makeNode(kind: Kind, patch: Partial<Node3D> = {}): Node3D {
  const node: Node3D = {
    animation: null,
    actor: { ...actorDefaults },
    deform: { ...deformDefaults },
    light: { ...lightDefaults },
    castShadow: true,
    receiveShadow: true,
    textureId: null,
    surface: kind === "terrain" ? flatSurface() : null,
    friction: 0.3,
    terrain: false,
    locked: false,
    script: { language: "none", source: "", enabled: false },
    id: uid(),
    name: kindNames[kind],
    kind,
    parent: null,
    visible: true,
    position: [0, 1, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    color: "#6dd6b0",
    roughness: 0.6,
    metalness: 0.08,
    physics: "none",
    mass: 1,
    restitution: 0.15,
    behavior: "none",
    speed: 1,
    amplitude: 0.4,
    ...patch,
  };
  // patches parciais nunca deixam campos soltos no ator, na deformação ou na luz
  node.actor = { ...actorDefaults, ...(patch.actor ?? {}) };
  node.deform = { ...deformDefaults, ...(patch.deform ?? {}) };
  node.light = { ...lightDefaults, ...(patch.light ?? {}) };
  return node;
}
export function createProject(): Project {
  const nodes: Node3D[] = [
    makeNode("box", {
      name: "Base da ilha",
      position: [0, -0.65, 0],
      scale: [12, 1.3, 10],
      color: "#344b4b",
      physics: "static",
    }),
    makeNode("box", {
      name: "Gramado",
      position: [0, 0.06, 0],
      scale: [12, 0.15, 10],
      color: "#648e72",
      physics: "static",
    }),
    makeNode("box", {
      name: "Jogador",
      position: [0, 1, 2.8],
      scale: [0.7, 1.1, 0.7],
      color: "#f2dd97",
      physics: "dynamic",
      behavior: "player",
      speed: 5,
    }),
    makeNode("box", {
      name: "Plataforma 01",
      position: [-2.7, 0.38, -0.5],
      scale: [2.1, 0.6, 2.1],
      color: "#9eaa9d",
      physics: "static",
    }),
    makeNode("box", {
      name: "Plataforma 02",
      position: [0, 0.68, -2.2],
      scale: [2.1, 1.2, 2.1],
      color: "#9eaa9d",
      physics: "static",
    }),
    makeNode("box", {
      name: "Plataforma 03",
      position: [2.8, 1, -2.2],
      scale: [2.1, 1.85, 2.1],
      color: "#9eaa9d",
      physics: "static",
    }),
  ];
  [
    [-2.7, 1.5, -0.5],
    [0, 2.1, -2.2],
    [2.8, 2.8, -2.2],
  ].forEach((p, i) =>
    nodes.push(
      makeNode("sphere", {
        name: `Cristal 0${i + 1}`,
        position: p as Vec3,
        scale: [0.46, 0.66, 0.46],
        color: "#8ae8cf",
        metalness: 0.65,
        roughness: 0.2,
        behavior: "collectible",
      }),
    ),
  );
  [
    [-4.4, 0, -3.4],
    [4.4, 0, 2.8],
    [4.8, 0, -3.7],
    [-4.7, 0, 2.6],
  ].forEach((p, i) => {
    const group = makeNode("group", {
      name: `Pinheiro 0${i + 1}`,
      position: p as Vec3,
    });
    nodes.push(group);
    nodes.push(
      makeNode("cylinder", {
        name: "Tronco",
        parent: group.id,
        position: [0, 0.65, 0],
        scale: [0.23, 1.3, 0.23],
        color: "#766656",
      }),
    );
    nodes.push(
      makeNode("cone", {
        name: "Copa",
        parent: group.id,
        position: [0, 1.9, 0],
        scale: [1.45, 2.3, 1.45],
        color: i % 2 ? "#3d7c65" : "#4a9176",
      }),
    );
  });
  const scene: SceneData = { id: uid(), name: "Ilha dos cristais", nodes };
  return {
    format: "gameforge",
    version: 7,
    name: "Meu primeiro mundo",
    activeScene: scene.id,
    scenes: [scene],
    settings: { ...controlDefaults, background: "#202a30", gravity: -9.81 },
  };
}
export function activeScene(p: Project) {
  return p.scenes.find((s) => s.id === p.activeScene)!;
}
export function descendants(nodes: Node3D[], id: string): Set<string> {
  const result = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of nodes)
      if (n.parent && result.has(n.parent) && !result.has(n.id)) {
        result.add(n.id);
        changed = true;
      }
  }
  return result;
}
export function canParent(nodes: Node3D[], id: string, parent: string | null) {
  return (
    parent === null ||
    (nodes.some((n) => n.id === parent) && !descendants(nodes, id).has(parent))
  );
}
export function duplicateBranch(nodes: Node3D[], id: string): Node3D[] {
  const branch = descendants(nodes, id),
    ids = new Map([...branch].map((id) => [id, uid()]));
  return nodes
    .filter((n) => branch.has(n.id))
    .map((n) => ({
      ...clone(n),
      id: ids.get(n.id)!,
      name: n.id === id ? `${n.name} cópia` : n.name,
      parent: ids.get(n.parent ?? "") ?? n.parent,
      position:
        n.id === id
          ? ([n.position[0] + 1, ...n.position.slice(1)] as Vec3)
          : clone(n.position),
    }));
}
function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
const finite = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const color = (v: unknown) =>
  typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
export function parseProject(text: string): Project {
  assert(
    text.length <= 8_000_000 &&
      new TextEncoder().encode(text).byteLength <= 8_000_000,
    "Projeto excede o limite de 8 MB.",
  );
  let p = JSON.parse(text);
  // Migração do formato original enviado pelo usuário. Os templates de texto antigos não eram executáveis.
  if (p && Array.isArray(p.sceneObjects) && !p.format) {
    const scene = {
      id: uid(),
      name: "Cena importada",
      nodes: p.sceneObjects.map((o: any) =>
        makeNode(
          o.kind === "esfera" ? "sphere" : o.kind === "cone" ? "cone" : "box",
          {
            id: String(o.id),
            name: String(o.name),
            color: o.color,
            position: [o.x, o.y, o.z],
            scale: [o.scale, o.scale, o.scale],
            physics: o.rigidBody ? "dynamic" : "none",
            behavior:
              o.scriptMode === "pulsar"
                ? "float"
                : o.rotationSpeed
                  ? "rotate"
                  : "none",
            speed:
              typeof o.rotationSpeed === "number" ? o.rotationSpeed * 60 : 1,
          },
        ),
      ),
    };
    p = {
      format: "gameforge",
      version: 7,
      name: "Projeto importado",
      activeScene: scene.id,
      scenes: [scene],
      settings: { ...controlDefaults, background: "#202a30", gravity: -9.81 },
    };
  }
  assert(
    p && p.format === "gameforge" && [2, 3, 4, 5, 6, 7].includes(p.version),
    "Formato incompatível. Use um projeto GameForge v2/v3/v4/v5/v6/v7 ou o JSON do editor original.",
  );
  assert(
    typeof p.name === "string" && p.name.length <= 100,
    "Nome de projeto inválido.",
  );
  assert(
    Array.isArray(p.scenes) && p.scenes.length > 0 && p.scenes.length <= 20,
    "O projeto deve ter entre 1 e 20 cenas.",
  );
  assert(
    p.settings &&
      color(p.settings.background) &&
      finite(p.settings.gravity, -100, 100),
    "Configurações de mundo inválidas.",
  );
  if (p.settings.gameCamera !== undefined)
    assert(
      Object.keys(cameraModes).includes(p.settings.gameCamera),
      "Modo de câmera inválido.",
    );
  for (const [key, , min, max] of controlFields) {
    if (p.settings[key] !== undefined)
      assert(
        finite(p.settings[key], min, max),
        `Configuração ${key} inválida.`,
      );
  }
  const textures = validateTextures(p.settings.textures),
    sky = validateSky(p.settings.sky),
    torch = validateTorch(p.settings.torch);
  if (p.settings.volume !== undefined)
    assert(
      typeof p.settings.volume === "number" &&
        Number.isFinite(p.settings.volume) &&
        p.settings.volume >= 0 &&
        p.settings.volume <= 1,
      "Volume inválido.",
    );
  if (p.settings.textureTile !== undefined)
    assert(
      typeof p.settings.textureTile === "number" &&
        Number.isFinite(p.settings.textureTile) &&
        p.settings.textureTile >= 0.25 &&
        p.settings.textureTile <= 8,
      "Escala de textura inválida.",
    );
  if (p.settings.playerId !== undefined)
    assert(
      typeof p.settings.playerId === "string" &&
        p.settings.playerId.length <= 100,
      "Jogador principal inválido.",
    );
  const sceneIds = new Set<string>();
  for (const s of p.scenes) {
    assert(
      s &&
        typeof s.id === "string" &&
        !sceneIds.has(s.id) &&
        typeof s.name === "string" &&
        s.name.length <= 100,
      "Cena inválida ou repetida.",
    );
    sceneIds.add(s.id);
    if (s.ui !== undefined) s.ui = validateUI(s.ui);
    if (s.voxel !== undefined) s.voxel = validateVoxel(s.voxel);
    assert(
      Array.isArray(s.nodes) && s.nodes.length <= 500,
      "Limite: 500 nós por cena.",
    );
    const ids = new Set<string>();
    if (p.version < 6)
      for (const n of s.nodes) {
        n.actor = { ...actorDefaults };
        n.deform = { ...deformDefaults };
        n.castShadow = true;
        n.receiveShadow = true;
      }
    if (p.version < 7) for (const n of s.nodes) n.light = { ...lightDefaults };
    for (const n of s.nodes) {
      assert(
        n && typeof n.id === "string" && n.id.length <= 100 && !ids.has(n.id),
        "ID de nó inválido ou repetido.",
      );
      ids.add(n.id);
      if (p.version === 2) {
        n.locked = false;
        n.script = { language: "none", source: "", enabled: false };
      }
      if (p.version < 4) {
        n.friction = 0.3;
        n.terrain = false;
      }
      assert(
        finite(n.friction, 0, 1) && typeof n.terrain === "boolean",
        "Material físico/terreno inválido.",
      );
      if (p.version < 5) {
        n.textureId = null;
        n.surface = null;
      }
      assert(
        n.textureId === null ||
          (typeof n.textureId === "string" &&
            textures.some((t) => t.id === n.textureId)),
        "Referência de textura inválida.",
      );
      n.animation = validateAnimation(n.animation);
      n.surface = validateSurface(n.surface);
      assert(n.kind !== "terrain" || n.surface, "Terreno sem superfície.");
      n.actor = validateActor(n.actor);
      n.deform = validateDeform(n.deform);
      n.light = validateLight(n.light);
      assert(
        typeof n.castShadow === "boolean" &&
          typeof n.receiveShadow === "boolean",
        "Dado de sombra inválido.",
      );
      assert(typeof n.locked === "boolean", "Bloqueio de nó inválido.");
      assert(
        n.script &&
          ["none", "lua", "javascript"].includes(n.script.language) &&
          typeof n.script.source === "string" &&
          n.script.source.length <= 128000 &&
          typeof n.script.enabled === "boolean",
        "Script inválido (limite 128.000 caracteres).",
      );
      n.script = {
        language: n.script.language,
        source: n.script.source,
        enabled: n.script.enabled,
      };
      assert(
        typeof n.name === "string" && n.name.length <= 100,
        "Nome de nó inválido.",
      );
      assert(Object.keys(kindNames).includes(n.kind), "Tipo de nó inválido.");
      assert(
        n.parent === null || typeof n.parent === "string",
        "Pai inválido.",
      );
      assert(
        typeof n.visible === "boolean" && color(n.color),
        "Visibilidade ou cor inválida.",
      );
      for (const key of ["position", "rotation", "scale"])
        assert(
          Array.isArray(n[key]) &&
            n[key].length === 3 &&
            n[key].every((v: unknown) =>
              finite(
                v,
                key === "scale" ? 0.01 : -10000,
                key === "scale" ? 100 : 10000,
              ),
            ),
          `Transformação ${key} inválida.`,
        );
      assert(
        ["none", "static", "dynamic"].includes(n.physics) &&
          Object.keys(behaviorNames).includes(n.behavior),
        "Componente inválido.",
      );
      for (const key of ["roughness", "metalness", "restitution"])
        assert(finite(n[key], 0, 1), `${key} inválido.`);
      assert(
        finite(n.mass, 0.01, 10000) &&
          finite(n.speed, 0, 100) &&
          finite(n.amplitude, 0, 100),
        "Parâmetros inválidos.",
      );
    }
    const byId = new Map<string, Node3D>(
      s.nodes.map((node: Node3D) => [node.id, node]),
    );
    for (const n of s.nodes) {
      const seen = new Set([n.id]);
      let parent = n.parent;
      while (parent !== null) {
        assert(
          ids.has(parent) && !seen.has(parent),
          "Hierarquia contém ciclo ou pai inexistente.",
        );
        seen.add(parent);
        parent = byId.get(parent)!.parent;
      }
    }
  }
  assert(sceneIds.has(p.activeScene), "Cena ativa inexistente.");
  // Rebuild known fields to avoid persisting unknown imported payloads.
  return {
    format: "gameforge",
    version: 7,
    name: p.name,
    activeScene: p.activeScene,
    settings: {
      ...controls(p.settings),
      ...(p.settings.textures !== undefined ? { textures } : {}),
      ...(sky ? { sky } : {}),
      ...(p.settings.playerId ? { playerId: p.settings.playerId } : {}),
      ...(p.settings.shadows !== undefined
        ? { shadows: validateShadows(p.settings.shadows) }
        : {}),
      ...(torch ? { torch } : {}),
      ...(p.settings.volume !== undefined ? { volume: p.settings.volume } : {}),
      ...(p.settings.textureTile !== undefined
        ? { textureTile: p.settings.textureTile }
        : {}),
      background: p.settings.background,
      gravity: p.settings.gravity,
      ...(p.settings.gameCamera ? { gameCamera: p.settings.gameCamera } : {}),
    },
    scenes: p.scenes.map((s: SceneData) => ({
      id: s.id,
      name: s.name,
      ...(s.ui ? { ui: s.ui } : {}),
      ...(s.voxel ? { voxel: s.voxel } : {}),
      nodes: s.nodes.map(
        (n) =>
          Object.fromEntries(
            Object.keys(makeNode("box")).map((k) => [k, n[k as keyof Node3D]]),
          ) as unknown as Node3D,
      ),
    })),
  };
}
/** Count- and byte-bounded snapshots. A big terrain must not allocate 60 entire projects. */
export class History<T> {
  past: T[] = [];
  future: T[] = [];
  private sizes = new WeakMap<object, number>();
  private serialized: string;
  constructor(
    public current: T,
    public limit = 60,
    public maxBytes = 32_000_000,
  ) {
    this.serialized = JSON.stringify(current);
    this.rememberSize(current, this.serialized.length * 2);
  }
  private rememberSize(value: T, size: number) {
    if (value !== null && typeof value === "object")
      this.sizes.set(value, size);
  }
  private size(value: T): number {
    return value !== null && typeof value === "object"
      ? (this.sizes.get(value) ?? JSON.stringify(value).length * 2)
      : JSON.stringify(value).length * 2;
  }
  get bytes() {
    return [...this.past, ...this.future].reduce(
      (sum, value) => sum + this.size(value),
      0,
    );
  }
  private trim() {
    while (this.past.length > this.limit) this.past.shift();
    while (this.bytes > this.maxBytes && this.past.length) this.past.shift();
    while (this.bytes > this.maxBytes && this.future.length)
      this.future.shift();
  }
  commit(next: T) {
    if (next === this.current) return;
    const serialized = JSON.stringify(next);
    if (serialized === this.serialized) return;
    this.rememberSize(next, serialized.length * 2);
    this.past.push(this.current);
    this.current = next;
    this.serialized = serialized;
    this.future = [];
    this.trim();
  }
  undo() {
    if (this.past.length) {
      const next = this.past.pop()!;
      this.future.push(this.current);
      this.current = next;
      this.serialized = JSON.stringify(next);
      this.trim();
    }
    return this.current;
  }
  redo() {
    if (this.future.length) {
      const next = this.future.pop()!;
      this.past.push(this.current);
      this.current = next;
      this.serialized = JSON.stringify(next);
      this.trim();
    }
    return this.current;
  }
}
