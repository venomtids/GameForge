import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { World } from "../src/engine/World";
import { parkourProject } from "../src/engine/templates";
import { platforms } from "../src/engine/parkour-level";
import { activeScene, parseProject } from "../src/engine/model";
test("percurso parkour inteiro: saltos reais, três checkpoints, oito cristais e chegada", () => {
  const p = parkourProject();
  parseProject(JSON.stringify(p));
  const world = new World(new THREE.Scene());
  world.load(activeScene(p), p.settings, true);
  const body = world.bodies.get("parkour-player")!;
  for (let i = 0; i < 80; i++) world.update(1 / 60, new Set());
  for (let target = 1; target < platforms.length; target++) {
    const dest = platforms[target];
    let landed = false,
      jumped = false;
    for (let frame = 0; frame < 240; frame++) {
      const dx = dest.x - body.position.x,
        dz = dest.z - body.position.z,
        dist = Math.hypot(dx, dz),
        keys = new Set<string>();
      if (dist > 0.1) keys.add("w");
      if (!jumped && world.grounded(body)) {
        keys.add(" ");
        jumped = true;
      }
      const yaw = Math.atan2(-dx, -dz);
      world.update(1 / 60, keys, yaw);
      if (world.completed && world.grounded(body)) {
        landed = true;
        break;
      }
      if (
        frame > 10 &&
        dist < 0.3 &&
        Math.abs(body.position.y - (dest.y + 0.85)) < 0.16 &&
        world.grounded(body)
      ) {
        landed = true;
        break;
      }
      if (world.deaths) break;
    }
    assert.ok(landed, `Plataforma ${target + 1} não alcançada`);
  }
  assert.equal(world.collected, 8);
  assert.equal(world.checkpointIndex, 2);
  const dest = platforms[platforms.length - 1];
  for (let i = 0; i < 90 && !world.completed; i++) {
    world.update(1 / 60, new Set(["w"]), 0);
  }
  assert.equal(world.completed, true);
  assert.equal(world.deaths, 0);
  assert.ok(body.position.z < dest.z + 0.2);
  world.dispose();
});
