import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  animateHumanoid,
  humanoid,
  fpsArms,
  styleArms,
  animateArms,
  type Limbs,
} from "../src/engine/Humanoid";
import { prefab } from "../src/engine/templates";

test("articulated walking/jump elbows flex forward, not behind the character", () => {
  const n = prefab("jellyPlayer")[0],
    o = humanoid(n),
    h = o.userData.limbs as Limbs;
  for (let i = 0; i < 300; i++) {
    animateHumanoid(o, n, 1 / 120, 0, -n.speed, true);
    assert.ok(
      h.leftElbow.rotation.x >= 0.08 && h.rightElbow.rotation.x >= 0.08,
    );
  }
  for (let i = 0; i < 60; i++)
    animateHumanoid(o, n, 1 / 120, 0, -n.speed, false, 5);
  assert.ok(h.leftArm.rotation.x > 0.4 && h.rightArm.rotation.x > 0.4);
});
test("first-person sway has no half-frequency discontinuity at phase wrap", () => {
  const arms = fpsArms();
  let last = arms.position.x,
    max = 0;
  for (let i = 0; i < 800; i++) {
    animateArms(arms, 1 / 120, 6, true);
    max = Math.max(max, Math.abs(arms.position.x - last));
    last = arms.position.x;
  }
  assert.ok(max < 0.002, `viewmodel step ${max}`);
});
test("first-person gel uses coherent self depth, not transparent overdraw through its own hands", () => {
  const arms = fpsArms(),
    n = prefab("jellyPlayer")[0];
  styleArms(arms, n, 0.7);
  for (const side of [arms.userData.esquerda, arms.userData.direita]) {
    for (const mesh of [side.mao, side.antebraco]) {
      const m = mesh.material as THREE.MeshStandardMaterial;
      assert.ok(m.depthTest && m.depthWrite);
      assert.equal(m.transparent, false);
    }
    assert.ok(side.braco.scale.y >= 0.65 && side.braco.scale.y <= 0.95);
  }
});

test("gel runner keeps shoulders and elbows forward without intermittent backwards flips, even while jumping", async () => {
  const { World } = await import("../src/engine/World");
  const { createProject, makeNode } = await import("../src/engine/model");
  const p = createProject(),
    player = prefab("jellyPlayer")[0];
  p.settings.playerId = player.id;
  p.scenes[0].nodes = [
    makeNode("box", {
      physics: "static",
      scale: [30, 1, 30],
      position: [0, -0.5, 0],
    }),
    player,
  ];
  const world = new World(new THREE.Scene());
  world.load(p.scenes[0], p.settings, true);
  const body = world.bodies.get(player.id)!,
    h = world.objects.get(player.id)!.userData.limbs as Limbs;
  let flips = 0,
    maxJump = 0,
    previous = h.leftArm.rotation.x;
  for (let step = 0; step < 1000; step++) {
    if (step % 170 === 1) world.queueAction(" ");
    world.update(1 / 120, new Set(step % 180 < 150 ? ["w", "shift"] : []));
    for (const elbow of [h.leftElbow, h.rightElbow])
      assert.ok(elbow.rotation.x >= 0.079 && elbow.rotation.x <= 1.36);
    for (const arm of [h.leftArm, h.rightArm])
      assert.ok(arm.rotation.x >= -0.701 && arm.rotation.x <= 1.36);
    if (step > 1 && Math.abs(h.leftArm.rotation.x - previous) > 0.35) flips++;
    if (body.velocity.y > 3) maxJump = Math.max(maxJump, h.leftArm.rotation.x);
    previous = h.leftArm.rotation.x;
  }
  assert.equal(flips, 0, "frame-to-frame shoulder flicker");
  assert.ok(maxJump > 0.35, "arms no longer move behind the head on launch");
  world.dispose();
});
