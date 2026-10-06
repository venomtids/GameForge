import * as THREE from "three";
import type * as CANNON from "cannon-es";
import type { Node3D } from "./model";
import type { Limbs } from "./Humanoid";
import { JellyMesh } from "./JellyMesh";

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
    angleLimit: number;
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
  private positionOffset = new THREE.Vector3();
  private bounds = new THREE.Box3();
  private worldInverse = new THREE.Matrix4();
  private linearInverse = new THREE.Matrix3();
  private correction = new THREE.Vector3();
  readonly surfaces: JellyMesh[] = [];
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
      for (const [joint, weight, angleLimit] of [
        [h.head, 1.3, 0.45],
        [h.leftArm, 1, 0.55],
        [h.rightArm, 1, 0.55],
        [h.leftElbow, 1.25, 0.65],
        [h.rightElbow, 1.25, 0.65],
        [h.leftLeg, 0.6, 0.12],
        [h.rightLeg, 0.6, 0.12],
        [h.leftKnee, 0.9, 0.18],
        [h.rightKnee, 0.9, 0.18],
      ] as const)
        this.points.push({
          object: joint,
          rest: joint.position.clone(),
          offset: new THREE.Vector3(),
          velocity: new THREE.Vector3(),
          rotationOffset: new THREE.Vector3(),
          weight,
          angleLimit,
        });
    }
    object.traverse((part) => {
      if (
        !(part instanceof THREE.Mesh) ||
        Array.isArray(part.material) ||
        !part.material.userData.jelly
      )
        return;
      part.geometry.computeBoundingBox();
      // Anchor each part at its existing joint, preserving connected elbows/knees.
      const anchor = part.position
        .clone()
        .negate()
        .clamp(part.geometry.boundingBox!.min, part.geometry.boundingBox!.max);
      const boot =
        part.geometry.boundingBox!.getSize(new THREE.Vector3()).y < 0.12 &&
        part.position.y < -0.2;
      this.surfaces.push(
        new JellyMesh(part, node, { pivot: anchor, pinSole: boot }),
      );
    });
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
    // Air poses retain the previous gait translation. Remove only OUR previous
    // squash offset before animating again, or it accumulates every physics step.
    if (this.limbs) this.limbs.lean.position.sub(this.positionOffset);
    this.positionOffset.set(0, 0, 0);
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
    for (const surface of this.surfaces) surface.reset();
  }
  update(dt: number, grounded: boolean, view?: THREE.Vector3, primary = false) {
    const b = this.body,
      h = this.limbs;
    this.delta
      .set(b.velocity.x, b.velocity.y, b.velocity.z)
      .sub(this.previous)
      .clampLength(0, 14);
    this.object.getWorldQuaternion(this.inverse);
    if (h) this.inverse.multiply(h.visual.quaternion);
    this.delta.applyQuaternion(this.inverse.invert());
    const mass = Math.max(0.25, this.node.mass / 12),
      omega = Math.sqrt((this.node.deform.stiffness * 0.85) / mass),
      drag = 0.6 + this.node.deform.damping * 1.2,
      stretch = this.node.deform.maxStretch ?? 1.65,
      response =
        (this.node.deform.intensity ?? 1.2) *
        (this.node.deform.movementInfluence ?? 1.25);

    if (grounded && !this.wasGrounded && this.previous.y < -1)
      this.squashVelocity -=
        Math.min(10, Math.abs(this.previous.y)) * 0.8 * response;
    else if (b.velocity.y > 2 && b.velocity.y - this.previous.y > 2)
      this.squashVelocity += Math.min(2.6, b.velocity.y * 0.18 * response);
    this.squashVelocity =
      (this.squashVelocity - omega * omega * this.squash * dt) /
      (1 + 2 * drag * dt + omega * omega * dt * dt);
    this.squash += this.squashVelocity * dt;
    if (response === 0) this.squash = this.squashVelocity = 0;
    if (this.squash < -0.3 || this.squash > 0.25) {
      this.squash = THREE.MathUtils.clamp(this.squash, -0.3, 0.25);
      this.squashVelocity *= 0.3;
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
    if (h) {
      // Scale around the feet of the fitted avatar, not around its body center.
      this.positionOffset.set(0, this.squash * 0.5, 0);
      h.lean.position.add(this.positionOffset);
    }
    for (const p of this.points) {
      // Momentum change (jump, landing, acceleration) excites each joint spring.
      p.velocity.addScaledVector(
        this.delta,
        (-0.22 * p.weight * response) / mass,
      );
      p.velocity
        .addScaledVector(p.offset, -omega * omega * dt)
        .multiplyScalar(1 / (1 + 2 * drag * dt + omega * omega * dt * dt))
        .clampLength(0, 3);
      p.offset
        .addScaledVector(p.velocity, dt)
        .clampLength(0, 0.16 * p.weight * (stretch - 0.5));
      // Angular lag keeps joints connected; translation lag would detach limbs.
      p.rotationOffset.set(
        THREE.MathUtils.clamp(
          p.offset.z * 3 + p.offset.y * 0.45,
          -p.angleLimit,
          p.angleLimit,
        ),
        THREE.MathUtils.clamp(p.offset.y * 0.35, -p.angleLimit, p.angleLimit),
        THREE.MathUtils.clamp(-p.offset.x * 3, -p.angleLimit, p.angleLimit),
      );
      p.object.rotation.x += p.rotationOffset.x;
      p.object.rotation.y += p.rotationOffset.y;
      p.object.rotation.z += p.rotationOffset.z;
    }
    this.object.updateWorldMatrix(true, true);
    for (const surface of this.surfaces)
      surface.step(dt, view, undefined, primary, true);
    if (h && this.surfaces.some((surface) => !surface.culled)) {
      // Stronger wobble must never put the visual boots through the controller.
      this.object.updateWorldMatrix(true, true);
      this.bounds.setFromObject(this.object, false);
      if (b.aabbNeedsUpdate) b.updateAABB();
      const lift = b.aabb.lowerBound.y - 0.025 - this.bounds.min.y;
      if (lift > 0 && Number.isFinite(lift)) {
        this.linearInverse.setFromMatrix4(
          this.worldInverse.copy(this.object.matrixWorld).invert(),
        );
        this.correction
          .set(0, Math.min(lift, 0.35), 0)
          .applyMatrix3(this.linearInverse);
        h.lean.position.add(this.correction);
        this.positionOffset.add(this.correction);
      }
    }
    this.previous.set(b.velocity.x, b.velocity.y, b.velocity.z);
    this.wasGrounded = grounded;
  }
  dispose() {
    this.reset();
    for (const surface of this.surfaces) surface.dispose();
    this.surfaces.length = 0;
    delete this.object.userData.jellyCharacter;
  }
}
