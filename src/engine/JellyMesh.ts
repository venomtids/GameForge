import * as THREE from "three";
import type { Node3D } from "./model";

/** Vertex springs / pivot falloff / radius recovery / visual LOD adapted from
 * Roundy's JellyMeshVertexJob (Jelly-Mesh-System, MIT, 2025/2026).
 * Upstream: 730062288016c211c773610cf4a11bfe947ef0fa. See THIRD-PARTY-NOTICES.txt.
 * Unlike the Unity job, drive inertia with change in velocity, not dt²-scaled
 * displacement, and integrate implicitly on the engine's fixed simulation clock.
 * This layer deforms the mesh; it does NOT replace the gameplay collider. */
export class JellyMesh {
  readonly geometry: THREE.BufferGeometry;
  readonly uniqueVertices: number;
  private original: THREE.BufferGeometry;
  private rest: Float32Array;
  private first: number[] = [];
  private mapping: Uint32Array;
  private offsets: Float32Array;
  private velocities: Float32Array;
  private worldPositions: Float32Array;
  private worldVelocities: Float32Array;
  private weights: Float32Array;
  private pivot = new THREE.Vector3();
  private center = new THREE.Vector3();
  private restCenter = new THREE.Vector3();
  private size = new THREE.Vector3();
  private matrix = new THREE.Matrix4();
  private inverse = new THREE.Matrix4();
  private point = new THREE.Vector3();
  private kick = new THREE.Vector3();
  private initialized = false;
  private pivotSignature = "";
  private accumulated = 0;
  private counter = 0;
  private lod = 0;
  private normals = 0;
  private active = false;
  private bottom = 0;
  culled = false;
  updates = 0;
  peakDisplacement = 0;

  constructor(
    public mesh: THREE.Mesh,
    public node: Node3D,
    private options: {
      /** Geometry contains cage-skinned world coordinates, not rigid local ones. */
      worldSpace?: boolean;
      /** Local joint anchor for an articulated part. Custom pivot offsets it. */
      pivot?: THREE.Vector3;
      /** Don't deform a boot sole below its original geometry. */
      pinSole?: boolean;
    } = {},
  ) {
    this.original = mesh.geometry;
    this.geometry = this.original.clone();
    mesh.geometry = this.geometry;
    const source = this.geometry.getAttribute("position");
    const attribute = new THREE.Float32BufferAttribute(
      Array.from({ length: source.count * 3 }, (_, i) =>
        i % 3 === 0
          ? source.getX(Math.floor(i / 3))
          : i % 3 === 1
            ? source.getY(Math.floor(i / 3))
            : source.getZ(Math.floor(i / 3)),
      ),
      3,
    );
    attribute.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute("position", attribute);
    this.rest = new Float32Array(attribute.array);
    this.mapping = new Uint32Array(attribute.count);
    const unique = new Map<string, number>();
    for (let i = 0; i < attribute.count; i++) {
      const j = i * 3;
      const key = `${Math.round(this.rest[j] * 1e5)},${Math.round(this.rest[j + 1] * 1e5)},${Math.round(this.rest[j + 2] * 1e5)}`;
      let index = unique.get(key);
      if (index === undefined) {
        index = this.first.length;
        unique.set(key, index);
        this.first.push(j);
      }
      this.mapping[i] = index;
    }
    this.uniqueVertices = this.first.length;
    this.offsets = new Float32Array(this.uniqueVertices * 3);
    this.velocities = new Float32Array(this.offsets.length);
    this.worldPositions = new Float32Array(this.offsets.length);
    this.worldVelocities = new Float32Array(this.offsets.length);
    this.weights = new Float32Array(this.uniqueVertices);
    this.geometry.computeBoundingBox();
    this.geometry.boundingBox!.getCenter(this.restCenter);
    this.geometry.boundingBox!.getSize(this.size);
    this.bottom = this.geometry.boundingBox!.min.y;
    this.configurePivot();
  }

  private configurePivot() {
    const settings = this.node.deform;
    const p = settings.pivot ?? [0, 0, 0];
    const signature = `${p.join(",")}/${settings.distanceFalloff ?? 1.2}`;
    if (signature === this.pivotSignature) return;
    this.pivotSignature = signature;
    this.pivot.copy(this.options.pivot ?? this.restCenter);
    this.pivot.x += p[0] * this.size.x * 0.5;
    this.pivot.y += p[1] * this.size.y * 0.5;
    this.pivot.z += p[2] * this.size.z * 0.5;
    let radius = 0;
    for (const j of this.first)
      radius = Math.max(
        radius,
        this.point.fromArray(this.rest, j).distanceTo(this.pivot),
      );
    for (let i = 0; i < this.uniqueVertices; i++) {
      const distance = this.point
        .fromArray(this.rest, this.first[i])
        .distanceTo(this.pivot);
      this.weights[i] = Math.pow(
        Math.min(1, distance / Math.max(0.001, radius)),
        settings.distanceFalloff ?? 1.2,
      );
      if (this.options.pivot) {
        // Keep an articulated part's attachment cap connected to its joint.
        // A custom effect pivot may move, but must not detach shoulders/knees.
        const bottomDistance = Math.abs(this.options.pivot.y - this.bottom);
        const top = this.bottom + this.size.y;
        const topDistance = Math.abs(this.options.pivot.y - top);
        if (Math.min(bottomDistance, topDistance) < this.size.y * 0.15) {
          const face = bottomDistance < topDistance ? this.bottom : top;
          this.weights[i] *= Math.min(
            1,
            Math.abs(this.rest[this.first[i] + 1] - face) /
              Math.max(0.001, this.size.y * 0.25),
          );
        }
      }
    }
  }

  /** A cage can supply a moving target; rigid/articulated meshes use bind vertices. */
  step(
    dt: number,
    view?: THREE.Vector3,
    target = this.rest,
    forceDetail = false,
    matricesCurrent = false,
    clocked = false,
  ) {
    if (!(dt > 0) || !Number.isFinite(dt)) return;
    this.configurePivot();
    if (!matricesCurrent) this.mesh.updateWorldMatrix(true, false);
    this.matrix.copy(this.mesh.matrixWorld);
    this.inverse.copy(this.matrix).invert();
    this.center.set(0, 0, 0);
    for (const j of this.first)
      this.center.add(this.point.fromArray(target, j));
    this.center.multiplyScalar(1 / this.uniqueVertices);
    const settings = this.node.deform;
    const near = settings.lodNear ?? 14,
      far = settings.lodFar ?? 80;
    const distance = view
      ? this.point.copy(this.center).applyMatrix4(this.matrix).distanceTo(view)
      : 0;
    this.lod =
      !forceDetail && settings.useLOD !== false && view
        ? THREE.MathUtils.clamp((distance - near) / (far - near), 0, 1)
        : 0;
    const intensity = settings.intensity ?? 1.2;
    let visible = this.mesh.visible;
    this.mesh.traverseAncestors((parent) => {
      if (!parent.visible) visible = false;
    });
    const culled = intensity === 0 || this.lod >= 1 || !visible;
    if (culled) {
      if (this.active || target !== this.rest) this.reset(target);
      this.culled = true;
      this.active = false;
      return;
    }
    this.culled = false;
    this.active = true;
    this.accumulated += Math.min(dt, 0.05);
    const interval = clocked
      ? 1
      : forceDetail
        ? 2
        : 2 + Math.round((settings.performance ?? 0) * 2 + this.lod * 3);
    if (++this.counter % interval !== 0 && this.initialized) return;
    const elapsed = Math.min(this.accumulated, 0.05);
    this.accumulated = 0;
    const mass = Math.max(0.2, this.node.mass / 12);
    const spring = (settings.stiffness * 0.85) / mass;
    const damping = 0.65 + settings.damping * 2;
    const influence = ((settings.movementInfluence ?? 1.25) * intensity) / mass;
    const radiusStrength =
      settings.maintainRadius === false
        ? 0
        : (settings.radiusConstraint ?? 0.3);
    const radiusBlend = 1 - Math.exp(-radiusStrength * 12 * elapsed);
    const minSize = Math.max(
      0.01,
      Math.min(this.size.x, this.size.y, this.size.z),
    );
    const limit =
      minSize *
      Math.min(
        0.3,
        0.14 * intensity * Math.min(1.4, (settings.maxStretch ?? 1.65) - 0.5),
      );
    // A moving cage pivot follows its target centroid, without changing bind weights.
    const px = this.pivot.x + this.center.x - this.restCenter.x;
    const py = this.pivot.y + this.center.y - this.restCenter.y;
    const pz = this.pivot.z + this.center.z - this.restCenter.z;
    this.peakDisplacement = 0;
    for (let i = 0; i < this.uniqueVertices; i++) {
      const j = this.first[i],
        k = i * 3;
      const tx = target[j],
        ty = target[j + 1],
        tz = target[j + 2];
      this.point.set(tx, ty, tz).applyMatrix4(this.matrix);
      const vx = this.initialized
        ? (this.point.x - this.worldPositions[k]) / elapsed
        : 0;
      const vy = this.initialized
        ? (this.point.y - this.worldPositions[k + 1]) / elapsed
        : 0;
      const vz = this.initialized
        ? (this.point.z - this.worldPositions[k + 2]) / elapsed
        : 0;
      this.kick
        .set(
          vx - this.worldVelocities[k],
          vy - this.worldVelocities[k + 1],
          vz - this.worldVelocities[k + 2],
        )
        .clampLength(0, 12);
      this.worldPositions[k] = this.point.x;
      this.worldPositions[k + 1] = this.point.y;
      this.worldPositions[k + 2] = this.point.z;
      this.worldVelocities[k] = vx;
      this.worldVelocities[k + 1] = vy;
      this.worldVelocities[k + 2] = vz;
      // Convert an acceleration impulse as a vector (never translate it).
      const m = this.inverse.elements,
        x = this.kick.x,
        y = this.kick.y,
        z = this.kick.z;
      const weight = this.weights[i];
      const stiffness = spring * (0.65 + 0.7 * weight);
      const denominator = 1 + damping * elapsed + stiffness * elapsed * elapsed;
      for (let axis = 0; axis < 3; axis++) {
        const impulse =
          -(m[axis] * x + m[axis + 4] * y + m[axis + 8] * z) *
          influence *
          weight *
          0.42;
        const velocity =
          (this.velocities[k + axis] +
            impulse -
            this.offsets[k + axis] * stiffness * elapsed) /
          denominator;
        this.velocities[k + axis] = THREE.MathUtils.clamp(velocity, -6, 6);
        this.offsets[k + axis] += this.velocities[k + axis] * elapsed;
      }
      if (radiusBlend > 0) {
        const rx = tx + this.offsets[k] - px,
          ry = ty + this.offsets[k + 1] - py,
          rz = tz + this.offsets[k + 2] - pz;
        const length = Math.hypot(rx, ry, rz),
          originalLength = Math.hypot(tx - px, ty - py, tz - pz);
        if (length > 0.001) {
          const correction = (originalLength / length - 1) * radiusBlend;
          this.offsets[k] += rx * correction;
          this.offsets[k + 1] += ry * correction;
          this.offsets[k + 2] += rz * correction;
        }
      }
      let length = Math.hypot(
        this.offsets[k],
        this.offsets[k + 1],
        this.offsets[k + 2],
      );
      if (!Number.isFinite(length)) {
        for (let a = 0; a < 3; a++)
          this.offsets[k + a] = this.velocities[k + a] = 0;
        length = 0;
      }
      if (length > limit) {
        const correction = limit / length;
        for (let a = 0; a < 3; a++) {
          this.offsets[k + a] *= correction;
          this.velocities[k + a] *= 0.6;
        }
        length = limit;
      }
      if (this.options.pinSole && ty <= this.bottom + this.size.y * 0.12) {
        this.offsets[k + 1] = Math.max(0, this.offsets[k + 1]);
        this.velocities[k + 1] = Math.max(0, this.velocities[k + 1]);
      }
      this.peakDisplacement = Math.max(this.peakDisplacement, length);
    }
    this.initialized = true;
    this.publish(target);
    this.updates++;
  }

  private publish(target: Float32Array) {
    const position = this.geometry.getAttribute("position");
    for (let i = 0; i < position.count; i++) {
      const j = i * 3,
        k = this.mapping[i] * 3;
      position.setXYZ(
        i,
        target[j] + this.offsets[k],
        target[j + 1] + this.offsets[k + 1],
        target[j + 2] + this.offsets[k + 2],
      );
    }
    position.needsUpdate = true;
    if (
      this.normals++ %
        (2 +
          Math.round(
            this.lod * 5 + (this.node.deform.performance ?? 0) * 3,
          )) ===
      0
    )
      this.geometry.computeVertexNormals();
    this.geometry.computeBoundingBox();
    this.geometry.computeBoundingSphere();
  }

  /** Spatial impact response, in world coordinates. Applied once per contact onset. */
  impulse(
    point: THREE.Vector3,
    direction: THREE.Vector3,
    speed: number,
    radius: number,
  ) {
    this.mesh.updateWorldMatrix(true, false);
    this.inverse.copy(this.mesh.matrixWorld).invert();
    const localPoint = this.point.copy(point).applyMatrix4(this.inverse);
    const p = localPoint.clone();
    const m = this.inverse.elements,
      x = direction.x,
      y = direction.y,
      z = direction.z;
    this.kick.set(
      m[0] * x + m[4] * y + m[8] * z,
      m[1] * x + m[5] * y + m[9] * z,
      m[2] * x + m[6] * y + m[10] * z,
    );
    const radiusSquared = Math.max(0.001, radius * radius);
    const gain =
      (Math.min(6, Math.max(0, speed)) * (this.node.deform.intensity ?? 1.2)) /
      Math.max(0.5, this.node.mass / 12);
    for (let i = 0; i < this.uniqueVertices; i++) {
      const k = i * 3;
      const distance = this.initialized
        ? this.point.fromArray(this.worldPositions, k).distanceToSquared(point)
        : this.point.fromArray(this.rest, this.first[i]).distanceToSquared(p);
      const weight =
        Math.max(0, 1 - distance / radiusSquared) ** 2 * this.weights[i] * gain;
      this.velocities[k] += this.kick.x * weight;
      this.velocities[k + 1] += this.kick.y * weight;
      this.velocities[k + 2] += this.kick.z * weight;
    }
  }

  reset(target = this.rest) {
    this.offsets.fill(0);
    this.velocities.fill(0);
    this.worldVelocities.fill(0);
    this.initialized = false;
    this.accumulated = this.counter = this.peakDisplacement = 0;
    this.publish(target);
  }

  dispose() {
    this.mesh.geometry = this.original;
    this.geometry.dispose();
  }
}
