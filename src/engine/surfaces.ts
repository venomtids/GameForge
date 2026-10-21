import * as THREE from "three";
import * as CANNON from "cannon-es";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Node3D, Vec3 } from "./model";
import type { PixelTexture, Surface } from "./studio-model";
import type { Brush } from "./design";
export function pixelTexture(t: PixelTexture): THREE.DataTexture {
  const data = new Uint8Array(t.size * t.size * 4);
  t.pixels.forEach((c, i) => {
    data[i * 4] = parseInt(c.slice(1, 3), 16);
    data[i * 4 + 1] = parseInt(c.slice(3, 5), 16);
    data[i * 4 + 2] = parseInt(c.slice(5, 7), 16);
    data[i * 4 + 3] = c.length === 9 ? parseInt(c.slice(7, 9), 16) : 255;
  });
  const texture = new THREE.DataTexture(data, t.size, t.size, THREE.RGBAFormat);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = true;
  texture.needsUpdate = true;
  return texture;
}
export function surfaceGeometry(s: Surface) {
  const g = new THREE.PlaneGeometry(
    s.size,
    s.size,
    s.resolution - 1,
    s.resolution - 1,
  );
  g.rotateX(-Math.PI / 2);
  const pos = g.getAttribute("position");
  const colors: number[] = [];
  s.heights.forEach((h, i) => {
    pos.setY(i, h);
    const c = new THREE.Color(s.colors[i]);
    colors.push(c.r, c.g, c.b);
  });
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}
export function sculptSurface(s: Surface, p: Vec3, b: Brush) {
  const old = [...s.heights],
    r = s.resolution,
    step = s.size / (r - 1);
  for (let z = 0; z < r; z++)
    for (let x = 0; x < r; x++) {
      const i = z * r + x,
        dx = x * step - s.size / 2 - p[0],
        dz = z * step - s.size / 2 - p[2],
        d =
          b.shape === "square"
            ? Math.max(Math.abs(dx), Math.abs(dz))
            : Math.hypot(dx, dz);
      if (d > b.radius) continue;
      const hardness = b.hardness ?? 0,
        falloff = Math.max(
          0,
          Math.min(1, (1 - d / b.radius) / Math.max(0.001, 1 - hardness)),
        ),
        weight = falloff * falloff * (3 - 2 * falloff);
      if (b.mode === "terrainPaint")
        s.colors[i] =
          "#" +
          new THREE.Color(s.colors[i])
            .lerp(new THREE.Color(b.color), Math.min(1, b.strength * weight))
            .getHexString();
      if (b.mode === "noise") {
        const noise =
          Math.sin(x * 127.1 + z * 311.7 + (b.seed ?? 1) * 17.37) * 43758.5453;
        s.heights[i] +=
          (noise - Math.floor(noise) - 0.5) * 2 * b.strength * weight;
      }
      if (b.mode === "terrace") {
        const t = b.terraceStep ?? 1;
        s.heights[i] +=
          (Math.round(old[i] / t) * t - old[i]) *
          Math.min(1, b.strength * weight);
      }
      if (b.mode === "raise") s.heights[i] += b.strength * weight;
      if (b.mode === "lower") s.heights[i] -= b.strength * weight;
      if (b.mode === "flatten")
        s.heights[i] +=
          (b.height - s.heights[i]) * Math.min(1, b.strength * weight);
      if (b.mode === "smooth") {
        let sum = 0,
          count = 0;
        for (let dz = -1; dz <= 1; dz++)
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx,
              zz = z + dz;
            if (xx >= 0 && xx < r && zz >= 0 && zz < r) {
              sum += old[zz * r + xx];
              count++;
            }
          }
        s.heights[i] +=
          (sum / count - old[i]) * Math.min(1, b.strength * weight);
      }
      s.heights[i] = Math.max(
        b.minHeight ?? -20,
        Math.min(b.maxHeight ?? 40, s.heights[i]),
      );
    }
}
export function advancedGeometry(n: Node3D): THREE.BufferGeometry | null {
  switch (n.kind) {
    case "terrain":
      return n.surface ? surfaceGeometry(n.surface) : null;
    case "capsule":
      return new THREE.CapsuleGeometry(0.3, 0.7, 8, 16);
    case "torus":
      return new THREE.TorusGeometry(0.65, 0.18, 12, 32);
    case "rock":
      return new THREE.IcosahedronGeometry(0.65, 0);
    case "wedge": {
      const s = new THREE.Shape();
      s.moveTo(-0.5, -0.5);
      s.lineTo(0.5, -0.5);
      s.lineTo(0.5, 0.5);
      s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false });
      g.translate(0, 0, -0.5);
      return g;
    }
    case "star": {
      const s = new THREE.Shape();
      for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI) / 5 - Math.PI / 2,
          r = i % 2 ? 0.28 : 0.65;
        if (!i) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      s.closePath();
      const g = new THREE.ExtrudeGeometry(s, {
        depth: 0.3,
        bevelEnabled: true,
        bevelSize: 0.025,
        bevelThickness: 0.025,
        bevelSegments: 2,
        steps: 1,
      });
      g.translate(0, 0, -0.15);
      return g;
    }
    case "arch": {
      const parts: THREE.BufferGeometry[] = [];
      for (let i = 0; i < 16; i++) {
        const a = ((i + 0.5) * Math.PI) / 16;
        const g = new THREE.BoxGeometry(0.26, 0.3, 0.4);
        g.rotateZ(a - Math.PI / 2);
        g.translate(Math.cos(a), Math.sin(a), 0);
        parts.push(g);
      }
      for (const x of [-1, 1]) {
        const g = new THREE.BoxGeometry(0.3, 1, 0.4);
        g.translate(x, -0.5, 0);
        parts.push(g);
      }
      const merged = mergeGeometries(parts);
      parts.forEach((g) => g.dispose());
      return merged;
    }
    default:
      return null;
  }
}
export function configureAdvancedBody(
  body: CANNON.Body,
  n: Node3D,
  s: THREE.Vector3,
  q: THREE.Quaternion,
) {
  if (n.kind === "terrain" && n.surface) {
    body.shapes.slice().forEach((shape) => body.removeShape(shape));
    body.mass = 0;
    const t = n.surface,
      r = t.resolution;
    const data = Array.from({ length: r }, (_, x) =>
      Array.from({ length: r }, (_, z) => t.heights[(r - 1 - z) * r + x] * s.y),
    );
    const shape = new CANNON.Heightfield(data, {
      elementSize: (t.size * s.x) / (r - 1),
    });
    const offset = new THREE.Vector3(
      (-t.size * s.x) / 2,
      0,
      (t.size * s.x) / 2,
    ).applyQuaternion(q);
    body.position.vadd(
      new CANNON.Vec3(offset.x, offset.y, offset.z),
      body.position,
    );
    body.addShape(
      shape,
      new CANNON.Vec3(),
      new CANNON.Quaternion().setFromEuler(-Math.PI / 2, 0, 0),
    );
  } else if (n.kind === "torus" || n.kind === "arch" || n.kind === "capsule") {
    body.shapes.slice().forEach((shape) => body.removeShape(shape));
    if (n.kind === "capsule") {
      const radius = 0.3 * Math.max(s.x, s.z);
      body.addShape(new CANNON.Cylinder(radius, radius, 0.7 * s.y, 12));
      for (const y of [-0.35, 0.35])
        body.addShape(
          new CANNON.Sphere(radius),
          new CANNON.Vec3(0, y * s.y, 0),
        );
    } else {
      const count = n.kind === "torus" ? 20 : 16;
      for (let i = 0; i < count; i++) {
        const a =
            ((i + 0.5) * (n.kind === "torus" ? 2 * Math.PI : Math.PI)) / count,
          r = n.kind === "torus" ? 0.65 : 1;
        if (n.kind === "torus")
          body.addShape(
            new CANNON.Sphere(0.19 * Math.max(s.x, s.y, s.z)),
            new CANNON.Vec3(Math.cos(a) * r * s.x, Math.sin(a) * r * s.y, 0),
          );
        else
          body.addShape(
            new CANNON.Box(new CANNON.Vec3(0.13 * s.x, 0.15 * s.y, 0.2 * s.z)),
            new CANNON.Vec3(Math.cos(a) * s.x, Math.sin(a) * s.y, 0),
            new CANNON.Quaternion().setFromEuler(0, 0, a - Math.PI / 2),
          );
      }
      if (n.kind === "arch")
        for (const x of [-1, 1])
          body.addShape(
            new CANNON.Box(new CANNON.Vec3(0.15 * s.x, 0.5 * s.y, 0.2 * s.z)),
            new CANNON.Vec3(x * s.x, -0.5 * s.y, 0),
          );
    }
  } else if (n.kind === "wedge") {
    body.shapes.slice().forEach((shape) => body.removeShape(shape));
    const vertices = [
      [-0.5, -0.5, -0.5],
      [0.5, -0.5, -0.5],
      [0.5, 0.5, -0.5],
      [-0.5, -0.5, 0.5],
      [0.5, -0.5, 0.5],
      [0.5, 0.5, 0.5],
    ].map((v) => new CANNON.Vec3(v[0] * s.x, v[1] * s.y, v[2] * s.z));
    body.addShape(
      new CANNON.ConvexPolyhedron({
        vertices,
        faces: [
          [2, 1, 0],
          [3, 4, 5],
          [0, 1, 4, 3],
          [1, 2, 5, 4],
          [2, 0, 3, 5],
        ],
      }),
    );
  }
  body.updateMassProperties();
}
