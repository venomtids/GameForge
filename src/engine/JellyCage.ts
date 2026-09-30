import * as THREE from "three";
import * as CANNON from "cannon-es";
import type { Node3D } from "./model";

const signs = Array.from(
  { length: 8 },
  (_, i) => new THREE.Vector3(i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1),
);
const clamp = THREE.MathUtils.clamp;

/** Eight-point elastic cage. Springs + rotational shape recovery + bounded
 * volume/stretch projection. An anchored cage transfers contact loads from a
 * solid kinematic support collider; its bottom four corners remain fixed.
 * This is a bounded soft-body approximation, not a tetrahedral FEM solver. */
export class JellyCage {
  private center = new THREE.Vector3();
  private axes = [
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
  ];
  private frame = new THREE.Quaternion();
  private inverse = new THREE.Quaternion();
  private crossZ = new THREE.Vector3();
  private matrix = new THREE.Matrix4();
  private v = new THREE.Vector3();
  private w = new THREE.Vector3();
  private up = new THREE.Vector3();
  private restLocal: THREE.Vector3[];
  private restCenter = new THREE.Vector3();
  private restVolume: number;
  private minSize: number;
  private supportRest: CANNON.Vec3 | null;
  private gradients = signs.map(() => new THREE.Vector3());
  private dt = 1 / 120;
  /** Last signed volume / rest volume, useful to diagnose collapse/inversion. */
  volumeRatio = 1;

  constructor(
    public node: Node3D,
    public bodies: CANNON.Body[],
    public springs: CANNON.Spring[],
    private rest: THREE.Vector3[],
    private rotation: THREE.Quaternion,
    private size: THREE.Vector3,
    public support?: CANNON.Body,
  ) {
    this.restCenter
      .copy(rest.reduce((a, b) => a.add(b), new THREE.Vector3()))
      .multiplyScalar(1 / 8);
    this.inverse.copy(rotation).invert();
    this.restLocal = rest.map((p) =>
      p.clone().sub(this.restCenter).applyQuaternion(this.inverse),
    );
    this.frame.copy(rotation);
    this.restVolume = size.x * size.y * size.z;
    this.minSize = Math.min(size.x, size.y, size.z);
    this.up.set(0, 1, 0).applyQuaternion(rotation);
    this.supportRest = support?.position.clone() ?? null;
    if (support) {
      support.type = CANNON.Body.KINEMATIC;
      support.allowSleep = false;
      support.updateMassProperties();
      support.wakeUp();
    }
  }

  private measure() {
    this.center.set(0, 0, 0);
    this.axes.forEach((a) => a.set(0, 0, 0));
    this.bodies.forEach((b, i) => {
      this.v.set(b.position.x, b.position.y, b.position.z);
      this.center.add(this.v);
      for (let axis = 0; axis < 3; axis++)
        this.axes[axis].addScaledVector(
          this.v,
          signs[i].getComponent(axis) * 0.25,
        );
    });
    this.center.multiplyScalar(1 / 8);
    this.volumeRatio =
      this.axes[0].dot(this.v.crossVectors(this.axes[1], this.axes[2])) /
      this.restVolume;
  }

  beforeStep(dt: number, world: CANNON.World) {
    this.dt = dt;
    // Clamp BEFORE evaluating springs: an impulse must not poison every neighbor.
    for (let i = 0; i < 8; i++) {
      const b = this.bodies[i];
      if (
        !Number.isFinite(
          b.position.x +
            b.position.y +
            b.position.z +
            b.velocity.x +
            b.velocity.y +
            b.velocity.z,
        )
      ) {
        b.position.set(this.rest[i].x, this.rest[i].y, this.rest[i].z);
        b.velocity.setZero();
        b.force.setZero();
      }
      for (const key of ["x", "y", "z"] as const)
        b.velocity[key] = clamp(b.velocity[key], -25, 25);
      if (this.support && b.mass) {
        // Anchored gel has a rest shape, not a permanent sag from particle weight.
        b.force.x -= world.gravity.x * b.mass;
        b.force.y -= world.gravity.y * b.mass;
        b.force.z -= world.gravity.z * b.mass;
      }
    }
    for (const s of this.springs) {
      const mass = Math.min(s.bodyA.mass || Infinity, s.bodyB.mass || Infinity);
      if (!Number.isFinite(mass)) continue;
      s.stiffness = Math.min(this.node.deform.stiffness, mass / (14 * dt * dt));
      s.damping = Math.min(this.node.deform.damping, mass / (14 * dt));
      s.applyForce();
    }
    this.measure();
    if (!this.support && this.volumeRatio > 0.05) {
      const x = this.axes[0],
        y = this.axes[1],
        z = this.axes[2];
      this.v.copy(x).normalize();
      this.w.copy(y).addScaledVector(this.v, -y.dot(this.v)).normalize();
      const third = this.gradients[0].crossVectors(this.v, this.w);
      if (third.dot(z) > 0 && this.w.lengthSq() > 0.5) {
        this.matrix.makeBasis(this.v, this.w, third);
        this.frame.setFromRotationMatrix(this.matrix);
      }
    }
    const recovery = this.node.deform.volume ?? 0.85;
    for (let i = 0; i < 8; i++) {
      const b = this.bodies[i];
      if (!b.mass) continue;
      const k = Math.min(
        this.node.deform.stiffness * recovery * 0.9,
        b.mass / (14 * dt * dt),
      );
      this.v
        .copy(this.restLocal[i])
        .applyQuaternion(this.support ? this.rotation : this.frame)
        .add(this.support ? this.restCenter : this.center);
      b.force.x += (this.v.x - b.position.x) * k;
      b.force.y += (this.v.y - b.position.y) * k;
      b.force.z += (this.v.z - b.position.z) * k;
    }
    if (this.support && this.supportRest) {
      this.transferContactLoads(world);
      // Stable flat support surface, following mean top-corner compression.
      let compression = 0;
      for (const i of [2, 3, 6, 7])
        compression +=
          this.v
            .set(
              this.bodies[i].position.x,
              this.bodies[i].position.y,
              this.bodies[i].position.z,
            )
            .sub(this.rest[i])
            .dot(this.up) * 0.25;
      compression = clamp(compression, -this.size.y * 0.3, this.size.y * 0.08);
      this.support.velocity.set(
        (this.supportRest.x +
          this.up.x * compression -
          this.support.position.x) /
          dt,
        (this.supportRest.y +
          this.up.y * compression -
          this.support.position.y) /
          dt,
        (this.supportRest.z +
          this.up.z * compression -
          this.support.position.z) /
          dt,
      );
      this.support.aabbNeedsUpdate = true;
    }
  }

  private transferContactLoads(world: CANNON.World) {
    if (!this.support) return;
    for (const c of world.contacts) {
      if (!c.enabled || (c.bi !== this.support && c.bj !== this.support))
        continue;
      const normal =
        c.ni.x * this.up.x + c.ni.y * this.up.y + c.ni.z * this.up.z;
      if ((c.bi === this.support ? normal : -normal) < 0.45) continue;
      const f = clamp(c.multiplier, 0, Math.max(1, this.node.mass) * 150);
      if (!Number.isFinite(f)) continue;
      const r = c.bi === this.support ? c.ri : c.rj;
      this.v.set(r.x, r.y, r.z).applyQuaternion(this.inverse);
      const x = clamp(this.v.x / this.size.x + 0.5, 0, 1),
        z = clamp(this.v.z / this.size.z + 0.5, 0, 1);
      for (const i of [2, 3, 6, 7]) {
        const weight = (i & 1 ? x : 1 - x) * (i & 4 ? z : 1 - z);
        const b = this.bodies[i];
        b.force.x -= this.up.x * f * weight;
        b.force.y -= this.up.y * f * weight;
        b.force.z -= this.up.z * f * weight;
      }
    }
  }

  afterStep() {
    const maxStretch = this.node.deform.maxStretch ?? 1.65;
    // Emergency strain limiter, not rigid distance joints: retain soft motion.
    for (let pass = 0; pass < 2; pass++)
      for (const s of this.springs) {
        const a = s.bodyA,
          b = s.bodyB;
        this.v.set(
          b.position.x - a.position.x,
          b.position.y - a.position.y,
          b.position.z - a.position.z,
        );
        const length = this.v.length(),
          max = s.restLength * maxStretch;
        const weight = a.invMass + b.invMass;
        if (length <= max || weight === 0) continue;
        this.v.multiplyScalar((length - max) / length);
        a.position.x += (this.v.x * a.invMass) / weight;
        a.position.y += (this.v.y * a.invMass) / weight;
        a.position.z += (this.v.z * a.invMass) / weight;
        b.position.x -= (this.v.x * b.invMass) / weight;
        b.position.y -= (this.v.y * b.invMass) / weight;
        b.position.z -= (this.v.z * b.invMass) / weight;
        a.aabbNeedsUpdate = b.aabbNeedsUpdate = true;
      }
    this.measure();
    const recovery = this.node.deform.volume ?? 0.85;
    if (recovery <= 0) return;
    const ratio = clamp(
      this.volumeRatio,
      0.65 + recovery * 0.3,
      1.4 - recovery * 0.3,
    );
    if (ratio === this.volumeRatio) return;
    // Gradient of det(mean opposite-face axes). One bounded XPBD projection.
    const [x, y, z] = this.axes;
    const gx = this.v.crossVectors(y, z),
      gy = this.w.crossVectors(z, x);
    const gz = this.crossZ.crossVectors(x, y);
    let denominator = ((1 - recovery) * 0.0005) / (this.dt * this.dt) + 0.01;
    for (let i = 0; i < 8; i++) {
      this.gradients[i]
        .copy(gx)
        .multiplyScalar(signs[i].x * 0.25)
        .addScaledVector(gy, signs[i].y * 0.25)
        .addScaledVector(gz, signs[i].z * 0.25);
      denominator += this.bodies[i].invMass * this.gradients[i].lengthSq();
    }
    const lambda = ((ratio - this.volumeRatio) * this.restVolume) / denominator;
    for (let i = 0; i < 8; i++) {
      const b = this.bodies[i];
      if (!b.mass) continue;
      this.v
        .copy(this.gradients[i])
        .multiplyScalar(lambda * b.invMass)
        .clampLength(0, this.minSize * 0.035);
      b.position.x += this.v.x;
      b.position.y += this.v.y;
      b.position.z += this.v.z;
      b.velocity.x += (this.v.x / this.dt) * 0.08;
      b.velocity.y += (this.v.y / this.dt) * 0.08;
      b.velocity.z += (this.v.z / this.dt) * 0.08;
      b.aabbNeedsUpdate = true;
    }
    this.measure();
  }
}
