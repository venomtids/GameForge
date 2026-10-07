import * as THREE from "three";
import * as CANNON from "cannon-es";
import type { VoxelConfig, PixelTexture } from "./studio-model";
import { pixelTexture } from "./surfaces";
const faces = [
  {
    d: [1, 0, 0],
    v: [
      [1, 0, 1],
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
    ],
  },
  {
    d: [-1, 0, 0],
    v: [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
    ],
  },
  {
    d: [0, 1, 0],
    v: [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
      [0, 1, 0],
    ],
  },
  {
    d: [0, -1, 0],
    v: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
  },
  {
    d: [0, 0, 1],
    v: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ],
  },
  {
    d: [0, 0, -1],
    v: [
      [1, 0, 0],
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
    ],
  },
];
export function cellIndex(x: number, y: number, z: number, size: number) {
  return x + size * (z + size * y);
}
/** Generic finite editable volume. No survival rules or game inventory live here. */
export class VoxelVolume {
  group = new THREE.Group();
  meshes: THREE.Mesh[] = [];
  bodies: CANNON.Body[] = [];
  revision = 0;
  signature = "";
  dirty = true;
  constructor(
    public data: VoxelConfig,
    private textures: PixelTexture[],
  ) {
    this.data = structuredClone(data);
    this.group.name = "Volume de blocos";
    this.rebuild();
  }
  get(x: number, y: number, z: number) {
    const s = this.data.size;
    if (x < 0 || x >= s || y < 0 || y >= 24 || z < 0 || z >= s) return 0;
    return this.data.blocks[cellIndex(x, y, z, s)] ?? 0;
  }
  set(x: number, y: number, z: number, type: number) {
    if (
      ![x, y, z, type].every(Number.isInteger) ||
      x < 0 ||
      z < 0 ||
      y < 0 ||
      x >= this.data.size ||
      z >= this.data.size ||
      y >= 24 ||
      type < 0 ||
      type > this.data.palette.length
    )
      return false;
    this.data.blocks[cellIndex(x, y, z, this.data.size)] = type;
    this.revision++;
    this.dirty = true;
    return true;
  }
  solid(x: number, y: number, z: number) {
    const type = this.get(x, y, z);
    return type > 0 && this.data.palette[type - 1]?.solid;
  }
  rebuild() {
    for (const m of this.meshes) {
      m.geometry.dispose();
      (m.material as THREE.MeshStandardMaterial).map?.dispose();
      (m.material as THREE.Material).dispose();
      m.removeFromParent();
    }
    this.meshes = [];
    const buckets = this.data.palette.map(() => ({
      positions: [] as number[],
      normals: [] as number[],
      uvs: [] as number[],
    }));
    const size = this.data.size;
    for (let y = 0; y < 24; y++)
      for (let z = 0; z < size; z++)
        for (let x = 0; x < size; x++) {
          const type = this.get(x, y, z);
          if (!type) continue;
          const b = buckets[type - 1];
          for (const f of faces) {
            const neighbor = this.get(x + f.d[0], y + f.d[1], z + f.d[2]);
            if (
              neighbor &&
              (this.data.palette[neighbor - 1].solid || neighbor === type)
            )
              continue;
            const uv = [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 1],
            ];
            for (const i of [0, 1, 2, 0, 2, 3]) {
              b.positions.push(x + f.v[i][0], y + f.v[i][1], z + f.v[i][2]);
              b.normals.push(...f.d);
              b.uvs.push(...uv[i]);
            }
          }
        }
    buckets.forEach((b, i) => {
      if (!b.positions.length) return;
      const g = new THREE.BufferGeometry();
      g.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(b.positions, 3),
      );
      g.setAttribute("normal", new THREE.Float32BufferAttribute(b.normals, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(b.uvs, 2));
      g.computeBoundingSphere();
      const m = this.data.palette[i],
        texture = this.textures.find((t) => t.id === m.textureId);
      const material = new THREE.MeshStandardMaterial({
        color: texture ? "#ffffff" : m.color,
        map: texture ? pixelTexture(texture) : null,
        roughness: 0.95,
        transparent: !m.solid,
        opacity: m.solid ? 1 : 0.65,
      });
      const mesh = new THREE.Mesh(g, material);
      mesh.receiveShadow = true;
      mesh.castShadow = m.solid;
      mesh.userData.voxel = true;
      this.meshes.push(mesh);
      this.group.add(mesh);
    });
    this.dirty = false;
  }
  syncColliders(physics: CANNON.World, position: CANNON.Vec3) {
    const x = Math.floor(position.x),
      y = Math.floor(position.y),
      z = Math.floor(position.z),
      sig = `${x},${y},${z},${this.revision}`;
    if (sig === this.signature) return;
    this.signature = sig;
    for (const b of this.bodies) physics.removeBody(b);
    this.bodies = [];
    for (let xx = x - 3; xx <= x + 3; xx++)
      for (let zz = z - 3; zz <= z + 3; zz++)
        for (let yy = y - 3; yy <= y + 3; yy++)
          if (this.solid(xx, yy, zz)) {
            const b = new CANNON.Body({
              mass: 0,
              shape: new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5)),
              position: new CANNON.Vec3(xx + 0.5, yy + 0.5, zz + 0.5),
              material: new CANNON.Material({ friction: 0.3, restitution: 0 }),
            });
            this.bodies.push(b);
            physics.addBody(b);
          }
  }
  hit(ray: THREE.Raycaster) {
    const hit = ray.intersectObjects(this.meshes, false)[0];
    if (!hit || !hit.face) return null;
    const n = hit.face.normal,
      p = hit.point.clone().addScaledVector(n, -0.001);
    const cell: [number, number, number] = [
      Math.floor(p.x),
      Math.floor(p.y),
      Math.floor(p.z),
    ];
    return {
      cell,
      normal: n.toArray(),
      type: this.get(...cell),
      distance: hit.distance,
    };
  }
  dispose() {
    for (const m of this.meshes) {
      m.geometry.dispose();
      (m.material as THREE.MeshStandardMaterial).map?.dispose();
      (m.material as THREE.Material).dispose();
    }
    this.group.removeFromParent();
    this.bodies = [];
  }
}
