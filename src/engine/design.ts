import { makeNode, type Node3D, type Vec3 } from "./model";
export const materials = {
  grass: { name: "Grama", color: "#628c61", roughness: 0.95, metalness: 0 },
  sand: { name: "Areia", color: "#d8be84", roughness: 1, metalness: 0 },
  stone: { name: "Pedra", color: "#899397", roughness: 0.85, metalness: 0 },
  wood: { name: "Madeira", color: "#98704e", roughness: 0.75, metalness: 0 },
  metal: { name: "Metal", color: "#9badb9", roughness: 0.22, metalness: 0.85 },
  snow: { name: "Neve", color: "#ecf3f4", roughness: 0.9, metalness: 0 },
  clay: { name: "Argila", color: "#b7755a", roughness: 0.9, metalness: 0 },
  water: {
    name: "Água decorativa",
    color: "#5aafcb",
    roughness: 0.08,
    metalness: 0.25,
  },
};
export type BrushMode =
  | "select"
  | "paint"
  | "eyedropper"
  | "raise"
  | "lower"
  | "smooth"
  | "flatten"
  | "terrainPaint"
  | "noise"
  | "terrace";
export interface Brush {
  mode: BrushMode;
  color: string;
  roughness: number;
  metalness: number;
  radius: number;
  strength: number;
  height: number;
  shape?: "circle" | "square";
  hardness?: number;
  minHeight?: number;
  maxHeight?: number;
  terraceStep?: number;
  seed?: number;
}
export const defaultBrush: Brush = {
  mode: "select",
  color: "#628c61",
  roughness: 0.95,
  metalness: 0,
  radius: 3,
  strength: 0.5,
  height: 1,
};
export function terrainPatch(): Node3D[] {
  const group = makeNode("group", {
    name: "Terreno · 8 × 8 blocos",
    position: [0, 0, 0],
  });
  const nodes = [group];
  for (let x = 0; x < 8; x++)
    for (let z = 0; z < 8; z++)
      nodes.push(
        makeNode("box", {
          name: `Solo ${x + 1},${z + 1}`,
          parent: group.id,
          position: [(x - 3.5) * 2, 0.5, (z - 3.5) * 2],
          scale: [2, 1, 2],
          color: materials.grass.color,
          roughness: 0.95,
          metalness: 0,
          physics: "static",
          restitution: 0,
          terrain: true,
        }),
      );
  return nodes;
}
// Point is in the terrain group's local space; one click equals one undo step.
export function brushTerrain(
  nodes: Node3D[],
  id: string,
  point: Vec3,
  brush: Brush,
) {
  const target = nodes.find((n) => n.id === id);
  if (!target?.terrain || target.locked) return false;
  const parent = nodes.find((n) => n.id === target.parent);
  if (parent?.locked) return false;
  const tiles = nodes.filter((n) => n.terrain && n.parent === target.parent);
  const old = tiles.map((n) => ({
    id: n.id,
    x: n.position[0],
    z: n.position[2],
    h: n.scale[1],
  }));
  let changed = false;
  for (const n of tiles) {
    const d = Math.hypot(n.position[0] - point[0], n.position[2] - point[2]);
    if (d > brush.radius || n.locked) continue;
    if (brush.mode === "terrainPaint") {
      n.color = brush.color;
      n.roughness = brush.roughness;
      n.metalness = brush.metalness;
      changed = true;
      continue;
    }
    let h = n.scale[1],
      weight = Math.max(0.15, 1 - d / brush.radius);
    if (brush.mode === "raise") h += brush.strength * weight;
    if (brush.mode === "lower") h -= brush.strength * weight;
    if (brush.mode === "flatten") h = brush.height;
    if (brush.mode === "smooth") {
      const neighbors = old.filter(
        (t) => Math.hypot(t.x - n.position[0], t.z - n.position[2]) <= 2.9,
      );
      const mean = neighbors.reduce((a, t) => a + t.h, 0) / neighbors.length;
      h += (mean - h) * Math.min(1, brush.strength) * weight;
    }
    h = Math.max(0.1, Math.min(30, h));
    const bottom = n.position[1] - n.scale[1] / 2;
    n.scale[1] = h;
    n.position[1] = bottom + h / 2;
    changed = true;
  }
  return changed;
}
export function arrangeChildren(
  nodes: Node3D[],
  id: string,
  axis: 0 | 1 | 2,
  distribute: boolean,
) {
  const root = nodes.find((n) => n.id === id);
  if (!root || root.locked) return;
  const children = nodes
    .filter((n) => n.parent === id && !n.locked)
    .sort((a, b) => a.position[axis] - b.position[axis]);
  if (children.length < 2) return;
  const lo = children[0].position[axis],
    hi = children[children.length - 1].position[axis];
  children.forEach(
    (n, i) =>
      (n.position[axis] = distribute
        ? lo + ((hi - lo) * i) / (children.length - 1)
        : (lo + hi) / 2),
  );
}
