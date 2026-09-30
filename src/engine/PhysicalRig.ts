import * as THREE from "three";
import * as CANNON from "cannon-es";
import type { Node3D } from "./model";
/** Bounded experimental articulated / spring-mass rig. 6 jointed bodies or 8 mass points. */
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
  constructor(
    public node: Node3D,
    public object: THREE.Object3D,
    private physics: CANNON.World,
    scene: THREE.Object3D,
    type: "ragdoll" | "jelly",
    original?: CANNON.Body,
  ) {
    this.type = type;
    this.original = original;
    if (original) physics.removeBody(original);
    object.updateWorldMatrix(true, false);
    const position = object.getWorldPosition(new THREE.Vector3()),
      rotation = object.getWorldQuaternion(new THREE.Quaternion()),
      scale = object.getWorldScale(new THREE.Vector3()).clampScalar(0.25, 8);
    object.visible = false;
    scene.add(this.visual);
    const material = new CANNON.Material({ friction: 0.45, restitution: 0.05 });
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
      if (original) b.velocity.copy(original.velocity);
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
              Math.max(1, node.mass) / 8,
            );
      for (const b of this.bodies) {
        b.collisionFilterGroup = 2;
        b.collisionFilterMask = 1;
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
      const g = new THREE.BoxGeometry(1, 1, 1),
        a = g.getAttribute("position");
      for (let i = 0; i < a.count; i++)
        this.map.push(
          (a.getX(i) > 0 ? 1 : 0) +
            (a.getY(i) > 0 ? 2 : 0) +
            (a.getZ(i) > 0 ? 4 : 0),
        );
      const mesh = new THREE.Mesh(
        g,
        new THREE.MeshStandardMaterial({
          color: node.color,
          roughness: 0.2,
          metalness: 0.05,
          transparent: true,
          opacity: 0.72,
          side: THREE.DoubleSide,
        }),
      );
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
    return this.bodies[0];
  }
  beforeStep(dt = 1 / 120) {
    for (const s of this.springs) {
      const mass = Math.min(s.bodyA.mass, s.bodyB.mass);
      s.stiffness = Math.min(this.node.deform.stiffness, mass / (14 * dt * dt));
      s.damping = Math.min(this.node.deform.damping, mass / (14 * dt));
      s.applyForce();
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
      this.map.forEach((j, i) => {
        const p = this.bodies[j].position;
        a.setXYZ(i, p.x, p.y, p.z);
      });
      a.needsUpdate = true;
      this.meshes[0].geometry.computeVertexNormals();
      this.meshes[0].geometry.computeBoundingSphere();
    }
    const p =
      this.type === "ragdoll"
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
    for (const b of this.bodies) {
      b.applyImpulse(
        new CANNON.Vec3(
          x / this.bodies.length,
          y / this.bodies.length,
          z / this.bodies.length,
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
    if (restore) {
      this.object.visible = true;
      if (this.original) this.physics.addBody(this.original);
    }
    this.springs = [];
  }
}
