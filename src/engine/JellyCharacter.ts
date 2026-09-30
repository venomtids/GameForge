import * as THREE from "three";
import type * as CANNON from "cannon-es";
import type { Node3D } from "./model";
import type { Limbs } from "./Humanoid";

/** Hybrid playable soft character: keep the normal, solid controller collider;
 * fixed-step inertial mass/spring motion deforms its articulated visual rig.
 * Knees/elbows still use the locomotion poses. No per-limb collision solver,
 * no extra render pass and no loss of WASD/jump/camera/respawn controls. */
export class JellyCharacter {
  private points: {
    object: THREE.Object3D;
    rest: THREE.Vector3;
    offset: THREE.Vector3;
    velocity: THREE.Vector3;
    rotationOffset: THREE.Vector3;
    weight: number;
  }[] = [];
  private previous = new THREE.Vector3();
  private delta = new THREE.Vector3();
  private inverse = new THREE.Quaternion();
  private limbs?: Limbs;
  private target: THREE.Object3D;
  private restScale: THREE.Vector3;
  private wasGrounded = false;
  private squash = 0;
  private squashVelocity = 0;
  /** Height scale of the soft visual, never of the physical collider. */
  deformation = 1;

  constructor(
    public node: Node3D,
    public object: THREE.Object3D,
    public body: CANNON.Body,
  ) {
    this.limbs = object.userData.limbs;
    this.target = this.limbs?.lean ?? object;
    this.restScale = this.target.scale.clone();
    if (this.limbs) {
      const h = this.limbs;
      for (const [joint, weight] of [
        [h.head, 1.3],
        [h.leftArm, 1],
        [h.rightArm, 1],
        [h.leftElbow, 1.25],
        [h.rightElbow, 1.25],
        [h.leftLeg, 0.6],
        [h.rightLeg, 0.6],
        [h.leftKnee, 0.9],
        [h.rightKnee, 0.9],
      ] as const)
        this.points.push({
          object: joint,
          rest: joint.position.clone(),
          offset: new THREE.Vector3(),
          velocity: new THREE.Vector3(),
          rotationOffset: new THREE.Vector3(),
          weight,
        });
    }
    object.userData.jellyCharacter = true;
    this.reset();
  }
  /** Remove the previous secondary pose before applying the next gait pose. */
  resetPose() {
    for (const p of this.points) {
      p.object.position.copy(p.rest);
      p.object.rotation.x -= p.rotationOffset.x;
      p.object.rotation.y -= p.rotationOffset.y;
      p.object.rotation.z -= p.rotationOffset.z;
      p.rotationOffset.set(0, 0, 0);
    }
    this.target.scale.copy(this.restScale);
  }
  reset() {
    this.previous.set(
      this.body.velocity.x,
      this.body.velocity.y,
      this.body.velocity.z,
    );
    this.squash = this.squashVelocity = 0;
    this.deformation = 1;
    this.wasGrounded = false;
    for (const p of this.points) {
      p.offset.set(0, 0, 0);
      p.velocity.set(0, 0, 0);
    }
    this.resetPose();
  }
  update(dt: number, grounded: boolean) {
    const b = this.body,
      h = this.limbs;
    this.delta
      .set(b.velocity.x, b.velocity.y, b.velocity.z)
      .sub(this.previous)
      .clampLength(0, 14);
    this.object.getWorldQuaternion(this.inverse);
    if (h) this.inverse.multiply(h.visual.quaternion);
    this.delta.applyQuaternion(this.inverse.invert());
    const omega = Math.sqrt(this.node.deform.stiffness * 1.7),
      drag = omega * Math.min(1.4, this.node.deform.damping / 5),
      stretch = this.node.deform.maxStretch ?? 1.65;
    if (grounded && !this.wasGrounded && this.previous.y < -1)
      this.squashVelocity -= Math.min(10, Math.abs(this.previous.y)) * 0.65;
    else if (b.velocity.y > 2 && b.velocity.y - this.previous.y > 2)
      this.squashVelocity += Math.min(0.9, b.velocity.y * 0.11);
    this.squashVelocity +=
      (-omega * omega * this.squash - 2 * drag * this.squashVelocity) * dt;
    this.squash += this.squashVelocity * dt;
    if (this.squash < -0.28 || this.squash > 0.16) {
      this.squash = THREE.MathUtils.clamp(this.squash, -0.28, 0.16);
      this.squashVelocity *= 0.35;
    }
    this.deformation = 1 + this.squash;
    const width = Math.pow(
      this.deformation,
      -(this.node.deform.volume ?? 0.85) * 0.5,
    );
    this.target.scale.set(
      this.target.scale.x * width,
      this.target.scale.y * this.deformation,
      this.target.scale.z * width,
    );
    if (h) h.lean.position.y += this.squash * 0.5;
    for (const p of this.points) {
      // Momentum change (jump, landing, acceleration) excites each joint spring.
      p.velocity.addScaledVector(this.delta, -0.13 * p.weight);
      p.velocity
        .addScaledVector(p.offset, -omega * omega * dt)
        .multiplyScalar(Math.max(0, 1 - 2 * drag * dt))
        .clampLength(0, 3);
      p.offset
        .addScaledVector(p.velocity, dt)
        .clampLength(0, 0.095 * p.weight * (stretch - 0.5));
      // Angular lag keeps joints connected; translation lag would detach limbs.
      p.rotationOffset.set(
        p.offset.z * 2.5 + p.offset.y * 0.35,
        p.offset.y * 0.25,
        -p.offset.x * 2.5,
      );
      p.object.rotation.x += p.rotationOffset.x;
      p.object.rotation.y += p.rotationOffset.y;
      p.object.rotation.z += p.rotationOffset.z;
    }
    this.previous.set(b.velocity.x, b.velocity.y, b.velocity.z);
    this.wasGrounded = grounded;
  }
  dispose() {
    this.reset();
    delete this.object.userData.jellyCharacter;
  }
}
