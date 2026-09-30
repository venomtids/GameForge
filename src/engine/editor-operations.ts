import * as THREE from "three";
import {
  clone,
  descendants,
  makeNode,
  uid,
  type Node3D,
  type Vec3,
} from "./model";
import type { TransformPose } from "./animation";

export function selectionRoots(nodes: Node3D[], selection: readonly string[]) {
  const ids = new Set(selection),
    byId = new Map(nodes.map((n) => [n.id, n]));
  return nodes.filter((n) => {
    if (!ids.has(n.id)) return false;
    let parent = n.parent;
    const visited = new Set<string>();
    while (parent && !visited.has(parent)) {
      if (ids.has(parent)) return false;
      visited.add(parent);
      parent = byId.get(parent)?.parent ?? null;
    }
    return true;
  });
}
export function selectedBranchIds(
  nodes: Node3D[],
  selection: readonly string[],
) {
  const ids = new Set<string>();
  for (const root of selectionRoots(nodes, selection))
    for (const id of descendants(nodes, root.id)) ids.add(id);
  return ids;
}

/** Preflight complete transactions against the same bounds as the project parser. */
function boundedPose(pose: TransformPose): TransformPose {
  const result = {} as TransformPose;
  for (const key of ["position", "rotation", "scale"] as const) {
    const min = key === "scale" ? 0.01 : -10000,
      max = key === "scale" ? 100 : 10000;
    if (
      !pose[key].every(
        (v) => Number.isFinite(v) && v >= min - 1e-8 && v <= max + 1e-8,
      )
    )
      throw new Error(
        "A transformação excede os limites do projeto. Reduza o deslocamento ou a escala.",
      );
    result[key] = pose[key].map((v) =>
      v === 0 ? 0 : Math.max(min, Math.min(max, v)),
    ) as Vec3;
  }
  return result;
}
function shifted(pose: TransformPose, delta: Vec3) {
  return boundedPose({
    ...pose,
    position: pose.position.map((v, i) => v + delta[i]) as Vec3,
  });
}
function translationPatch(n: Node3D, delta: Vec3) {
  return {
    position: shifted(n, delta).position,
    ...(n.animation
      ? {
          animation: {
            ...n.animation,
            frames: n.animation.frames.map((f) => ({
              time: f.time,
              ...shifted(f, delta),
            })),
          },
        }
      : {}),
  };
}
function applyMoves(moves: { node: Node3D; delta: Vec3 }[]) {
  const patches = moves.map(({ node, delta }) => ({
    node,
    patch: translationPatch(node, delta),
  }));
  for (const { node, patch } of patches) Object.assign(node, patch);
}

export function duplicateSelection(
  nodes: Node3D[],
  selection: readonly string[],
  offset = 1,
): Node3D[] {
  if (!Number.isFinite(offset) || Math.abs(offset) > 1000)
    throw new Error("Deslocamento inválido.");
  const roots = new Set(selectionRoots(nodes, selection).map((n) => n.id)),
    branch = selectedBranchIds(nodes, selection);
  const remap = new Map([...branch].map((id) => [id, uid()]));
  return nodes
    .filter((n) => branch.has(n.id))
    .map((node) => {
      const n = clone(node);
      n.id = remap.get(n.id)!;
      n.parent = remap.get(n.parent ?? "") ?? n.parent;
      if (roots.has(node.id)) {
        n.name = `${n.name.slice(0, 90)} cópia`;
        Object.assign(n, translationPatch(n, [offset, 0, 0]));
      }
      return n;
    });
}
function editableSiblings(
  nodes: Node3D[],
  selection: readonly string[],
  minimum = 2,
) {
  const roots = selectionRoots(nodes, selection);
  if (roots.length < minimum)
    throw new Error(`Selecione pelo menos ${minimum} objetos independentes.`);
  if (roots.some((n) => n.locked))
    throw new Error("Desbloqueie os objetos selecionados primeiro.");
  if (roots.some((n) => n.parent !== roots[0].parent))
    throw new Error(
      "Selecione objetos no mesmo nível da hierarquia para esta operação.",
    );
  return roots;
}

/** Child transforms and animation coordinates are preserved, without partial changes on failure. */
export function groupSelection(nodes: Node3D[], selection: readonly string[]) {
  const roots = editableSiblings(nodes, selection, 1);
  if (nodes.length >= 500) throw new Error("Limite de 500 nós por cena.");
  const center = roots.reduce<Vec3>(
    (v, n) => v.map((x, i) => x + n.position[i] / roots.length) as Vec3,
    [0, 0, 0],
  );
  const group = makeNode("group", {
    name: "Modelo",
    parent: roots[0].parent,
    position: center,
  });
  const delta = center.map((v) => -v) as Vec3;
  const patches = roots.map((node) => ({
    node,
    patch: translationPatch(node, delta),
  }));
  for (const { node, patch } of patches)
    Object.assign(node, patch, { parent: group.id });
  nodes.push(group);
  return group.id;
}

export function ungroupSelection(
  nodes: Node3D[],
  selection: readonly string[],
) {
  const roots = selectionRoots(nodes, selection).filter(
    (n) => n.kind === "group",
  );
  if (!roots.length) throw new Error("Selecione um grupo para desagrupar.");
  const removed = new Set<string>(),
    selected: string[] = [];
  const patches: { node: Node3D; patch: Partial<Node3D> }[] = [];
  for (const group of roots) {
    const children = nodes.filter((n) => n.parent === group.id);
    if (group.locked || children.some((n) => n.locked))
      throw new Error("Desbloqueie o grupo e seus filhos primeiro.");
    if (group.animation)
      throw new Error("Remova a animação do grupo antes de desagrupar.");
    const rotated = group.rotation.some((v) => Math.abs(v % 360) > 1e-8);
    const uniform =
      Math.abs(group.scale[0] - group.scale[1]) < 1e-8 &&
      Math.abs(group.scale[1] - group.scale[2]) < 1e-8;
    const parentMatrix = new THREE.Matrix4().compose(
      new THREE.Vector3(...group.position),
      new THREE.Quaternion().setFromEuler(
        new THREE.Euler(
          ...(group.rotation.map(THREE.MathUtils.degToRad) as Vec3),
        ),
      ),
      new THREE.Vector3(...group.scale),
    );
    for (const child of children) {
      if (
        child.animation &&
        (rotated || !uniform) &&
        child.animation.frames.some((f) =>
          f.rotation.some(
            (v, i) =>
              Math.abs(v - child.animation!.frames[0].rotation[i]) > 1e-8,
          ),
        )
      )
        throw new Error(
          "A animação de rotação depende da transformação do grupo. Preserve o grupo ou remova a animação antes de desagrupar.",
        );
      const convert = (pose: TransformPose) => {
        const local = new THREE.Matrix4().compose(
          new THREE.Vector3(...pose.position),
          new THREE.Quaternion().setFromEuler(
            new THREE.Euler(
              ...(pose.rotation.map(THREE.MathUtils.degToRad) as Vec3),
            ),
          ),
          new THREE.Vector3(...pose.scale),
        );
        const result = parentMatrix.clone().multiply(local),
          position = new THREE.Vector3(),
          rotation = new THREE.Quaternion(),
          scale = new THREE.Vector3();
        result.decompose(position, rotation, scale);
        const rebuilt = new THREE.Matrix4().compose(position, rotation, scale);
        if (
          result.elements.some(
            (v, i) => Math.abs(v - rebuilt.elements[i]) > 0.0001,
          )
        )
          throw new Error(
            "Este grupo combina rotação e escala não uniforme. Uniformize a escala antes de desagrupar.",
          );
        const e = new THREE.Euler().setFromQuaternion(rotation);
        return boundedPose({
          position: position.toArray() as Vec3,
          // Euler winding (e.g. a full 360° turn) must not collapse to 0°.
          rotation: !rotated
            ? [...pose.rotation]
            : ([e.x, e.y, e.z].map((v) =>
                Math.abs(v) < 1e-10 ? 0 : THREE.MathUtils.radToDeg(v),
              ) as Vec3),
          scale: scale.toArray() as Vec3,
        });
      };
      const patch = {
        ...convert(child),
        parent: group.parent,
        ...(child.animation
          ? {
              animation: {
                ...child.animation,
                frames: child.animation.frames.map((f) => ({
                  time: f.time,
                  ...convert(f),
                })),
              },
            }
          : {}),
      };
      patches.push({ node: child, patch });
      selected.push(child.id);
    }
    removed.add(group.id);
  }
  for (const { node, patch } of patches) Object.assign(node, patch);
  return { nodes: nodes.filter((n) => !removed.has(n.id)), selected };
}

export function translateSelection(
  nodes: Node3D[],
  selection: readonly string[],
  delta: Vec3,
) {
  if (!delta.every((v) => Number.isFinite(v) && Math.abs(v) <= 1000))
    throw new Error("Deslocamento inválido.");
  const roots = selectionRoots(nodes, selection);
  if (roots.some((n) => n.locked))
    throw new Error("Desbloqueie os objetos selecionados primeiro.");
  applyMoves(roots.map((node) => ({ node, delta })));
}
function validateAxis(axis: number) {
  if (![0, 1, 2].includes(axis)) throw new Error("Eixo inválido.");
}
export function alignSelection(
  nodes: Node3D[],
  selection: readonly string[],
  axis: 0 | 1 | 2,
  mode: "min" | "center" | "max",
) {
  validateAxis(axis);
  if (!["min", "center", "max"].includes(mode))
    throw new Error("Alinhamento inválido.");
  const roots = editableSiblings(nodes, selection),
    values = roots.map((n) => n.position[axis]);
  const target =
    mode === "min"
      ? Math.min(...values)
      : mode === "max"
        ? Math.max(...values)
        : values.reduce((a, b) => a + b, 0) / values.length;
  applyMoves(
    roots.map((node) => {
      const delta: Vec3 = [0, 0, 0];
      delta[axis] = target - node.position[axis];
      return { node, delta };
    }),
  );
  for (const node of roots) node.position[axis] = target;
}
export function distributeSelection(
  nodes: Node3D[],
  selection: readonly string[],
  axis: 0 | 1 | 2,
) {
  validateAxis(axis);
  const roots = editableSiblings(nodes, selection, 3).sort(
    (a, b) => a.position[axis] - b.position[axis],
  );
  const first = roots[0].position[axis],
    distance =
      (roots[roots.length - 1].position[axis] - first) / (roots.length - 1);
  applyMoves(
    roots.map((node, i) => {
      const delta: Vec3 = [0, 0, 0];
      delta[axis] = first + distance * i - node.position[axis];
      return { node, delta };
    }),
  );
}
