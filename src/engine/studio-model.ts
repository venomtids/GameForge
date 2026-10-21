export interface PixelTexture {
  id: string;
  name: string;
  size: 16 | 32 | 64;
  pixels: string[];
}
export interface Surface {
  resolution: 17 | 33 | 65;
  size: number;
  heights: number[];
  colors: string[];
}
export interface UIElement {
  id: string;
  name: string;
  kind: "panel" | "text" | "button" | "image" | "bar";
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  background: string;
  fontSize: number;
  textureId: string | null;
  binding: "none" | "health" | "hunger";
  action: "none" | "resume" | "pause" | "respawn" | "event" | "hide";
  screen: "always" | "playing" | "paused";
  visible: boolean;
}
export type BlockEdit = [number, number, number, number];
export interface VoxelMaterial {
  name: string;
  color: string;
  textureId: string | null;
  solid: boolean;
}
export interface VoxelConfig {
  size: 32 | 48;
  height: 24;
  blocks: number[];
  palette: VoxelMaterial[];
}
export interface SkyConfig {
  enabled: boolean;
  sunElevation: number;
  sunAzimuth: number;
  clouds: boolean;
}
const validColor = (c: unknown) =>
  typeof c === "string" && /^#[\da-f]{6}([\da-f]{2})?$/i.test(c);
const num = (v: unknown, a: number, b: number) =>
  typeof v === "number" && Number.isFinite(v) && v >= a && v <= b;
function check(ok: unknown, msg: string): asserts ok {
  if (!ok) throw new Error(msg);
}
export function validateTextures(raw: any): PixelTexture[] {
  if (raw === undefined) return [];
  check(Array.isArray(raw) && raw.length <= 48, "Limite: 48 texturas.");
  const ids = new Set();
  return raw.map((t) => {
    check(
      t &&
        typeof t.id === "string" &&
        t.id.length <= 100 &&
        !ids.has(t.id) &&
        typeof t.name === "string" &&
        t.name.length <= 80 &&
        [16, 32, 64].includes(t.size) &&
        Array.isArray(t.pixels) &&
        t.pixels.length === t.size * t.size &&
        t.pixels.every(validColor),
      "Textura pixel inválida.",
    );
    ids.add(t.id);
    return { id: t.id, name: t.name, size: t.size, pixels: [...t.pixels] };
  });
}
export function validateSurface(s: any): Surface | null {
  if (s == null) return null;
  check(
    [17, 33, 65].includes(s.resolution) &&
      num(s.size, 4, 100) &&
      Array.isArray(s.heights) &&
      s.heights.length === s.resolution ** 2 &&
      s.heights.every((v: any) => num(v, -20, 40)) &&
      Array.isArray(s.colors) &&
      s.colors.length === s.heights.length &&
      s.colors.every(validColor),
    "Terreno contínuo inválido.",
  );
  return {
    resolution: s.resolution,
    size: s.size,
    heights: [...s.heights],
    colors: [...s.colors],
  };
}
export function validateUI(raw: any): UIElement[] {
  if (raw === undefined) return [];
  check(Array.isArray(raw) && raw.length <= 64, "Limite: 64 elementos 2D.");
  const ids = new Set();
  return raw.map((e) => {
    check(
      e &&
        typeof e.id === "string" &&
        e.id.length <= 100 &&
        !ids.has(e.id) &&
        typeof e.name === "string" &&
        e.name.length <= 80 &&
        typeof e.text === "string" &&
        e.text.length <= 1200 &&
        ["panel", "text", "button", "image", "bar"].includes(e.kind) &&
        ["none", "health", "hunger"].includes(e.binding) &&
        ["none", "resume", "pause", "respawn", "event", "hide"].includes(
          e.action,
        ) &&
        ["always", "playing", "paused"].includes(e.screen) &&
        typeof e.visible === "boolean" &&
        num(e.x, 0, 100) &&
        num(e.y, 0, 100) &&
        num(e.w, 1, 100) &&
        num(e.h, 1, 100) &&
        num(e.fontSize, 8, 72) &&
        validColor(e.color) &&
        validColor(e.background) &&
        (e.textureId === null || typeof e.textureId === "string"),
      "Elemento 2D inválido.",
    );
    ids.add(e.id);
    return Object.fromEntries(
      [
        "id",
        "name",
        "kind",
        "text",
        "x",
        "y",
        "w",
        "h",
        "color",
        "background",
        "fontSize",
        "textureId",
        "binding",
        "action",
        "screen",
        "visible",
      ].map((k) => [k, e[k]]),
    ) as unknown as UIElement;
  });
}
export function validateVoxel(v: any): VoxelConfig | undefined {
  if (v === undefined) return undefined;
  check(
    v &&
      [32, 48].includes(v.size) &&
      v.height === 24 &&
      Array.isArray(v.palette) &&
      v.palette.length >= 1 &&
      v.palette.length <= 16 &&
      Array.isArray(v.blocks) &&
      v.blocks.length === v.size * v.size * v.height,
    "Volume voxel inválido.",
  );
  const palette = v.palette.map((m: any) => {
    check(
      m &&
        typeof m.name === "string" &&
        m.name.length <= 80 &&
        validColor(m.color) &&
        typeof m.solid === "boolean" &&
        (m.textureId === null || typeof m.textureId === "string"),
      "Material voxel inválido.",
    );
    return {
      name: m.name,
      color: m.color,
      textureId: m.textureId,
      solid: m.solid,
    };
  });
  check(
    v.blocks.every(
      (b: any) => Number.isInteger(b) && num(b, 0, palette.length),
    ),
    "Índice voxel inválido.",
  );
  return { size: v.size, height: 24, blocks: [...v.blocks], palette };
}
export function validateSky(s: any): SkyConfig | undefined {
  if (s === undefined) return undefined;
  check(
    s &&
      typeof s.enabled === "boolean" &&
      typeof s.clouds === "boolean" &&
      num(s.sunElevation, 0, 90) &&
      num(s.sunAzimuth, -180, 180),
    "Céu inválido.",
  );
  return {
    enabled: s.enabled,
    clouds: s.clouds,
    sunElevation: s.sunElevation,
    sunAzimuth: s.sunAzimuth,
  };
}
export function flatSurface(resolution: 17 | 33 | 65 = 33, size = 32): Surface {
  return {
    resolution,
    size,
    heights: Array(resolution ** 2).fill(0),
    colors: Array(resolution ** 2).fill("#6b984e"),
  };
}
