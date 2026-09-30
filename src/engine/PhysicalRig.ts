import * as THREE from "three";
import * as CANNON from "cannon-es";
import type { Node3D } from "./model";
import { JellyCage } from "./JellyCage";
import { jellyBox, jellyMaterial } from "./jelly-material";
/** Bounded articulated / elastic cage rig. 6 jointed bodies or 8 mass points. */
export class PhysicalRig {
  bodies: CANNON.Body[] = [];
  constraints: CANNON.Constraint[] = [];
  springs: CANNON.Spring[] = [];
  visual = new THREE.Group();
  meshes: THREE.Mesh[] = [];
  map: number[] = [];
  type: "ragdoll" | "jelly";
  original: CANNON.Body | undefined;
  rest: THREE.Vector3[] = [];
  jelly?: JellyCage;
  anchored = false;
  private weights: number[] = [];
  private originalType: CANNON.Body["type"] = CANNON.Body.STATIC;
  private originalPosition?: CANNON.Vec3;
  private p = new THREE.Vector3();
  constructor(
    public node: Node3D,
    public object: THREE.Object3D,
    private physics: CANNON.World,
    scene: THREE.Object3D,
    type: "ragdoll" | "jelly",
    original?: CANNON.Body,
    public collisionGroup = 2,
  ) {
    this.type = type;
    this.original = original;
    this.anchored = type === "jelly" && node.physics === "static" && !!original;
    if (original) {
      this.originalType = original.type;
      this.originalPosition = original.position.clone();
      if (!this.anchored) physics.removeBody(original);
    }
    object.updateWorldMatrix(true, false);
    const position = object.getWorldPosition(new THREE.Vector3()),
      rotation = object.getWorldQuaternion(new THREE.Quaternion()),
      scale = object
        .getWorldScale(new THREE.Vector3())
        .clampScalar(0.25, this.anchored ? 200 : 8);
    object.visible = false;
    scene.add(this.visual);
    const material = new CANNON.Material({
      friction: node.friction,
      restitution: node.restitution,
    });
    const body = (offset: THREE.Vector3, shape: CANNON.Shape, mass: number) => {
      const p = offset.clone().applyQuaternion(rotation).add(position);
      const b = new CANNON.Body({
        mass,
        shape,
        position: new CANNON.Vec3(p.x, p.y, p.z),
        quaternion: new CANNON.Quaternion(
          rotation.x,
          rotation.y,
          rotation.z,
          rotation.w,
        ),
        material,
        linearDamping: 0.12,
        angularDamping: 0.3,
        allowSleep: false,
      });
      if (original && !this.anchored) b.velocity.copy(original.velocity);
      this.bodies.push(b);
      this.rest.push(p.clone());
      physics.addBody(b);
      return b;
    };
    if (type === "ragdoll") {
      const parts = [
        { p: [0, 0.1, 0], s: [0.58, 0.36, 0.7], c: node.color },
        { p: [0, 0.4, 0], s: [0.38, 0.26, 0.55], c: node.actor.skin },
        { p: [-0.41, 0.02, 0], s: [0.18, 0.44, 0.6], c: node.color },
        { p: [0.41, 0.02, 0], s: [0.18, 0.44, 0.6], c: node.color },
        { p: [-0.17, -0.29, 0], s: [0.23, 0.42, 0.6], c: "#425463" },
        { p: [0.17, -0.29, 0], s: [0.23, 0.42, 0.6], c: "#425463" },
      ];
      parts.forEach((part) => {
        const s = new THREE.Vector3(
            ...(part.s as [number, number, number]),
          ).multiply(scale),
          p = new THREE.Vector3(
            ...(part.p as [number, number, number]),
          ).multiply(scale);
        body(
          p,
          new CANNON.Box(new CANNON.Vec3(s.x / 2, s.y / 2, s.z / 2)),
          Math.max(1, node.mass) / 6,
        );
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(s.x, s.y, s.z),
          new THREE.MeshStandardMaterial({ color: part.c, roughness: 0.8 }),
        );
        this.meshes.push(mesh);
        this.visual.add(mesh);
      });
      for (const [index, pivot, angle] of [
        [1, [0, 0.28, 0], 0.4],
        [2, [-0.41, 0.24, 0], 1.1],
        [3, [0.41, 0.24, 0], 1.1],
        [4, [-0.17, -0.08, 0], 0.65],
        [5, [0.17, -0.08, 0], 0.65],
      ] as [number, number[], number][]) {
        const pivotA = new CANNON.Vec3(
            (pivot[0] - parts[0].p[0]) * scale.x,
            (pivot[1] - parts[0].p[1]) * scale.y,
            (pivot[2] - parts[0].p[2]) * scale.z,
          ),
          pivotB = new CANNON.Vec3(
            (pivot[0] - parts[index].p[0]) * scale.x,
            (pivot[1] - parts[index].p[1]) * scale.y,
            (pivot[2] - parts[index].p[2]) * scale.z,
          );
        const constraint = new CANNON.ConeTwistConstraint(
          this.bodies[0],
          this.bodies[index],
          {
            pivotA,
            pivotB,
            axisA: new CANNON.Vec3(0, 1, 0),
            axisB: new CANNON.Vec3(0, 1, 0),
            angle,
            twistAngle: 0.25,
            maxForce: 1e5,
            collideConnected: false,
          },
        );
        this.constraints.push(constraint);
        physics.addConstraint(constraint);
      }
    } else {
      for (let z = -1; z <= 1; z += 2)
        for (let y = -1; y <= 1; y += 2)
          for (let x = -1; x <= 1; x += 2)
            body(
              new THREE.Vector3(
                x * scale.x * 0.5,
                y * scale.y * 0.5,
                z * scale.z * 0.5,
              ),
              new CANNON.Sphere(Math.min(scale.x, scale.y, scale.z) * 0.1),
              this.anchored && y < 0
                ? 0
                : Math.max(0.1, node.mass) / (this.anchored ? 4 : 8),
            );
      for (const b of this.bodies) {
        b.collisionFilterGroup = collisionGroup;
        b.collisionFilterMask = this.anchored ? 0 : ~collisionGroup;
        b.fixedRotation = true;
        b.updateMassProperties();
      }
      for (let i = 0; i < 8; i++)
        for (let j = i + 1; j < 8; j++)
          this.springs.push(
            new CANNON.Spring(this.bodies[i], this.bodies[j], {
              restLength: this.bodies[i].position.distanceTo(
                this.bodies[j].position,
              ),
              stiffness: node.deform.stiffness,
              damping: node.deform.damping,
            }),
          );
      this.jelly = new JellyCage(
        node,
        this.bodies,
        this.springs,
        this.rest,
        rotation,
        scale,
        this.anchored ? original : undefined,
      );
      const g = jellyBox(),
        a = g.getAttribute("position");
      // Trilinear cage skinning: rounded/subdivided faces, not eight snapped vertices.
      for (let i = 0; i < a.count; i++) {
        const x = a.getX(i) + 0.5,
          y = a.getY(i) + 0.5,
          z = a.getZ(i) + 0.5;
        for (let corner = 0; corner < 8; corner++)
          this.weights.push(
            (corner & 1 ? x : 1 - x) *
              (corner & 2 ? y : 1 - y) *
              (corner & 4 ? z : 1 - z),
          );
      }
      const mesh = new THREE.Mesh(g, jellyMaterial(node.color));
      this.meshes.push(mesh);
      this.visual.add(mesh);
    }
    this.visual.traverse((o) => {
      o.userData.nodeId = node.id;
      o.castShadow = node.castShadow;
      o.receiveShadow = node.receiveShadow;
    });
    this.sync();
  }
  get anchor() {
    return this.anchored ? this.original! : this.bodies[0];
  }
  beforeStep(dt = 1 / 120) {
    if (this.jelly) {
      this.jelly.beforeStep(dt, this.physics);
      return;
    }
    for (const b of this.bodies) {
      for (const k of ["x", "y", "z"] as const) {
        b.velocity[k] = THREE.MathUtils.clamp(b.velocity[k], -25, 25);
        b.angularVelocity[k] = THREE.MathUtils.clamp(
          b.angularVelocity[k],
          -20,
          20,
        );
      }
    }
  }
  afterStep() {
    this.jelly?.afterStep();
  }
  sync() {
    if (this.type === "ragdoll")
      this.meshes.forEach((m, i) => {
        const b = this.bodies[i];
        m.position.set(b.position.x, b.position.y, b.position.z);
        m.quaternion.set(
          b.quaternion.x,
          b.quaternion.y,
          b.quaternion.z,
          b.quaternion.w,
        );
      });
    else {
      const a = this.meshes[0].geometry.getAttribute("position");
      for (let i = 0; i < a.count; i++) {
        this.p.set(0, 0, 0);
        for (let j = 0; j < 8; j++) {
          const b = this.bodies[j].position,
            w = this.weights[i * 8 + j];
          this.p.x += b.x * w;
          this.p.y += b.y * w;
          this.p.z += b.z * w;
        }
        a.setXYZ(i, this.p.x, this.p.y, this.p.z);
      }
      a.needsUpdate = true;
      this.meshes[0].geometry.computeVertexNormals();
      this.meshes[0].geometry.computeBoundingSphere();
    }
    const p =
      this.type === "ragdoll" || this.anchored
        ? new THREE.Vector3(
            this.anchor.position.x,
            this.anchor.position.y,
            this.anchor.position.z,
          )
        : this.bodies
            .reduce(
              (sum, b) =>
                sum.add(
                  new THREE.Vector3(b.position.x, b.position.y, b.position.z),
                ),
              new THREE.Vector3(),
            )
            .multiplyScalar(1 / 8);
    if (this.object.parent) this.object.parent.worldToLocal(p);
    this.object.position.copy(p);
  }
  impulse(x: number, y: number, z: number) {
    const totalMass = this.bodies.reduce((sum, b) => sum + b.mass, 0);
    const bounded =
      this.type === "jelly"
        ? Math.min(1, (totalMass * 12) / (Math.hypot(x, y, z) || 1))
        : 1;
    const dynamic = this.bodies.filter((b) => b.mass > 0);
    for (const b of dynamic) {
      b.applyImpulse(
        new CANNON.Vec3(
          (x * bounded) / dynamic.length,
          (y * bounded) / dynamic.length,
          (z * bounded) / dynamic.length,
        ),
      );
      b.wakeUp();
    }
  }
  dispose(restore = false) {
    for (const c of this.constraints) this.physics.removeConstraint(c);
    for (const b of this.bodies) this.physics.removeBody(b);
    for (const m of this.meshes) {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
    this.visual.removeFromParent();
    if (this.anchored && this.original) {
      this.original.type = this.originalType;
      if (this.originalPosition)
        this.original.position.copy(this.originalPosition);
      this.original.velocity.setZero();
      this.original.updateMassProperties();
      this.original.aabbNeedsUpdate = true;
      if (!restore) this.physics.removeBody(this.original);
    }
    if (restore) {
      this.object.visible = true;
      if (this.original && !this.anchored) this.physics.addBody(this.original);
    }
    this.springs = [];
  }
}
