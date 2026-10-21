import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  createProject,
  makeNode,
  parseProject,
  clone,
  type Node3D,
} from "../src/engine/model";
import { prefab06 } from "../src/engine/prefabs06";
import { World, addLighting } from "../src/engine/World";
import { shadowDefaults } from "../src/engine/features06";
import { configureLighting } from "../src/engine/Lighting";
import { generateTerrain, terrainDefaults } from "../src/engine/terrain06";
import { sculptSurface } from "../src/engine/surfaces";
import { defaultBrush } from "../src/engine/design";
import { commandNames, commandTemplate } from "../src/engine/commands06";
import { diagnose } from "../src/engine/diagnostics";
function setup(nodes: Node3D[], hz = 120) {
  const p = createProject();
  p.scenes[0].nodes = [
    makeNode("box", {
      id: "floor",
      position: [0, -0.5, 0],
      scale: [100, 1, 100],
      physics: "static",
      restitution: 0,
    }),
    ...nodes,
  ];
  p.settings.physicsHz = hz;
  const w = new World(new THREE.Scene());
  w.load(p.scenes[0], p.settings, true);
  return { w, p };
}
function tick(w: World, seconds: number, keys = new Set<string>()) {
  for (let i = 0; i < seconds * 120; i++) w.update(1 / 120, keys, 0);
}
test("schema6 validates actors/deformation/shadows; roundtrip, old defaults", () => {
  const p = createProject();
  p.settings.shadows = { ...shadowDefaults };
  p.scenes[0].nodes.push(...prefab06("humanoidPlayer"), ...prefab06("jelly"));
  assert.deepEqual(parseProject(JSON.stringify(p)), p);
  for (const edit of [
    (q: any) => (q.settings.shadows.resolution = 500),
    (q: any) => (q.scenes[0].nodes[0].actor.health = 0),
    (q: any) => (q.scenes[0].nodes[0].deform.stiffness = 999),
    (q: any) => (q.settings.shadows.bias = NaN),
  ]) {
    const q = clone(p);
    edit(q);
    assert.throws(() => parseProject(JSON.stringify(q)));
  }
  const old: any = clone(p);
  old.version = 5;
  delete old.settings.shadows;
  for (const n of old.scenes[0].nodes) {
    delete n.actor;
    delete n.deform;
    delete n.castShadow;
    delete n.receiveShadow;
  }
  const next = parseProject(JSON.stringify(old));
  assert.equal(next.version, 7);
  assert.equal(next.scenes[0].nodes[0].actor.bot, "off");
});
test("configurable shadows set real map/filter/camera/intensities", () => {
  const scene = new THREE.Scene(),
    dispose = addLighting(scene),
    p = createProject();
  p.settings.shadows = {
    ...shadowDefaults,
    resolution: 1024,
    filter: "vsm",
    coverage: 80,
    softness: 5,
    bias: -0.002,
    normalBias: 0.08,
    intensity: 0.6,
  };
  const renderer: any = {
    capabilities: { maxTextureSize: 4096 },
    shadowMap: {},
  };
  configureLighting(scene, renderer, p.settings, new THREE.Vector3(20, 0, 10));
  const sun = scene.getObjectByName("studio-sun") as THREE.DirectionalLight;
  assert.equal(renderer.shadowMap.type, THREE.VSMShadowMap);
  assert.equal(sun.shadow.camera.left, -40);
  assert.equal(sun.shadow.radius, 5);
  assert.equal(sun.shadow.mapSize.x, 1024);
  assert.equal(sun.shadow.intensity, 0.6);
  assert.ok(sun.target.position.distanceTo(new THREE.Vector3(20, 0, 10)) < 0.1);
  p.settings.shadows.enabled = false;
  configureLighting(scene, renderer, p.settings);
  assert.equal(sun.castShadow, false);
  dispose();
  assert.equal(scene.children.length, 0);
});
test("new humanoid is separate, pivoted limbs animate and old player remains", () => {
  const old = makeNode("box", {
    id: "old",
    behavior: "player",
    physics: "dynamic",
    position: [9, 2, 9],
  });
  const n = prefab06("humanoidPlayer")[0];
  const { w, p } = setup([old, n]);
  w.dispose();
  p.settings.playerId = n.id;
  w.load(p.scenes[0], p.settings, true);
  assert.equal(w.playerId, n.id);
  assert.ok(w.objects.get(old.id) instanceof THREE.Mesh);
  const limbs = w.objects.get(n.id)!.userData.limbs;
  assert.ok(limbs.leftLeg && limbs.rightArm);
  tick(w, 2);
  tick(w, 0.25, new Set(["w"]));
  assert.ok(Math.abs(limbs.leftLeg.rotation.x) > 0.05);
  assert.ok(
    Math.abs(limbs.leftLeg.rotation.x + limbs.rightLeg.rotation.x) < 0.001,
  );
  w.dispose();
});
test("ragdoll uses 6 bodies and 5 joint constraints; settles, restores and disposes", () => {
  const n = prefab06("ragdoll")[0],
    { w } = setup([n]);
  const rig = w.physicalRigs.get(n.id)!;
  assert.equal(rig.bodies.length, 6);
  assert.equal(rig.constraints.length, 5);
  tick(w, 10);
  for (const b of rig.bodies) {
    assert.ok(Number.isFinite(b.position.y));
    assert.ok(b.position.y > -0.15 && b.position.y < 2);
    assert.ok(b.velocity.length() < 1);
  }
  const world = w.physics!;
  w.clear();
  assert.equal(world.constraints.length, 0);
  assert.equal(w.physicalRigs.size, 0);
  assert.equal(w.root.children.length, 0);
});
test("jelly is 8 particles / 28 springs; bounded extreme mass/settings at 60–240 Hz", () => {
  for (const [mass, hz, stiffness, damping] of [
    [0.1, 60, 180, 8],
    [4, 120, 80, 3],
    [10, 240, 20, 0.5],
  ]) {
    const n = prefab06("jelly")[0];
    n.mass = mass;
    n.deform.stiffness = stiffness;
    n.deform.damping = damping;
    const { w } = setup([n], hz),
      rig = w.physicalRigs.get(n.id)!;
    assert.equal(rig.bodies.length, 8);
    assert.equal(rig.springs.length, 28);
    tick(w, 1);
    w.command({ type: "impulse", id: n.id, x: 3, y: 4, z: 1 });
    tick(w, 8);
    for (const b of rig.bodies) {
      assert.ok(
        [b.position.x, b.position.y, b.position.z].every(Number.isFinite),
      );
      assert.ok(b.position.y > -0.3 && b.position.y < 12);
      assert.ok(b.position.distanceTo(rig.anchor.position) < 8);
    }
    assert.ok(rig.meshes[0].geometry.getAttribute("position").getY(0) < 3);
    w.dispose();
  }
});
test("death activates physical ragdoll; R restores real controller; stop retains authored scene", () => {
  const n = prefab06("humanoidPlayer")[0],
    { w, p } = setup([n]);
  tick(w, 1);
  w.command({ type: "damage", id: n.id, amount: 100 });
  assert.equal(w.health.get(n.id), 0);
  assert.ok(w.physicalRigs.has(n.id));
  tick(w, 1);
  w.update(1 / 60, new Set(["r"]), 0);
  assert.equal(w.health.get(n.id), 100);
  assert.equal(w.physicalRigs.size, 0);
  assert.ok(w.bodies.get(n.id)!.mass > 0);
  w.load(p.scenes[0], p.settings, false);
  assert.equal(w.objects.get(n.id)!.position.y, 2);
  assert.equal(w.physicalRigs.size, 0);
  w.dispose();
});
test("bot patrol moves, follow approaches, attack damages with cooldown and respects wall", () => {
  const player = prefab06("humanoidPlayer")[0];
  player.position = [0, 2, 0];
  const bot = prefab06("botPatrol")[0];
  bot.position = [6, 2, 0];
  const { w } = setup([player, bot]);
  tick(w, 2);
  assert.ok(
    w.bodies
      .get(bot.id)!
      .position.distanceTo(new THREE.Vector3(6, 2, 0) as any) > 1,
  );
  w.command({ type: "bot", id: bot.id, mode: "follow" });
  tick(w, 6);
  const b = w.bodies.get(bot.id)!;
  assert.ok(Math.hypot(b.position.x, b.position.z) < 2.2);
  w.command({ type: "bot", id: bot.id, mode: "attack" });
  tick(w, 2);
  assert.ok((w.health.get(player.id) ?? 100) < 100);
  assert.ok((w.health.get(player.id) ?? 0) >= 68);
  w.dispose();
  const wall = makeNode("box", {
    physics: "static",
    position: [0.55, 1, 0],
    scale: [0.2, 2, 8],
  });
  bot.position = [1.2, 2, 0];
  bot.actor.bot = "attack";
  const blocked = setup([player, bot, wall]).w;
  tick(blocked, 2);
  assert.equal(blocked.health.get(player.id), 100);
  blocked.dispose();
});
test("walk/rotate/stop commands actually move; invalid commands rejected", () => {
  const n = makeNode("box", { position: [0, 2, 0] }),
    { w } = setup([n]);
  w.command({ type: "walk", id: n.id, x: 1, z: 0, speed: 2 });
  w.command({ type: "rotate", id: n.id, speed: 90 });
  tick(w, 1);
  assert.ok(Math.abs(w.objects.get(n.id)!.position.x - 2) < 0.01);
  assert.ok(Math.abs(w.objects.get(n.id)!.rotation.y - Math.PI / 2) < 0.01);
  w.command({ type: "stop", id: n.id });
  const x = w.objects.get(n.id)!.position.x;
  tick(w, 1);
  assert.equal(w.objects.get(n.id)!.position.x, x);
  w.command({ type: "walk", id: n.id, x: Infinity, z: 0, speed: 2 });
  assert.equal(w.motions.size, 0);
  w.dispose();
});
test("all command templates diagnose cleanly in JavaScript and Lua", () => {
  for (const key of Object.keys(commandNames) as (keyof typeof commandNames)[])
    for (const language of ["javascript", "lua"] as const)
      assert.deepEqual(diagnose(commandTemplate(key, language), language), []);
});
test("terrain65: deterministic generation, square brush, opacity, clamps, terraces", () => {
  const o = { ...terrainDefaults, resolution: 65 as const };
  const s = generateTerrain(o);
  assert.deepEqual(s, generateTerrain(o));
  assert.notDeepEqual(s.heights, generateTerrain({ ...o, seed: 8 }).heights);
  const center = 32 * 65 + 32;
  s.heights.fill(0);
  sculptSurface(s, [0, 0, 0], {
    ...defaultBrush,
    mode: "raise",
    shape: "square",
    hardness: 1,
    radius: 2,
    strength: 3,
    maxHeight: 1,
  });
  assert.equal(s.heights[center], 1);
  assert.equal(s.heights[(32 + 3) * 65 + 32 + 3], 1);
  s.heights[center] = 1.4;
  sculptSurface(s, [0, 0, 0], {
    ...defaultBrush,
    mode: "terrace",
    strength: 1,
    terraceStep: 1,
  });
  assert.equal(s.heights[center], 1);
  const before = s.colors[center];
  sculptSurface(s, [0, 0, 0], {
    ...defaultBrush,
    mode: "terrainPaint",
    strength: 0.5,
    color: "#ff0000",
  });
  assert.notEqual(s.colors[center], before);
  assert.notEqual(s.colors[center], "#ff0000");
  const p = createProject();
  p.scenes[0].nodes.push(makeNode("terrain", { surface: s }));
  assert.equal(
    parseProject(JSON.stringify(p)).scenes[0].nodes.at(-1)!.surface!.resolution,
    65,
  );
});
test("rig cap and repeated runtime lifecycle leave no orphan constraints", () => {
  const nodes = Array.from({ length: 15 }, () => prefab06("ragdoll")[0]),
    { w, p } = setup(nodes);
  assert.equal(w.physicalRigs.size, 12);
  for (let i = 0; i < 3; i++) {
    const phys = w.physics!;
    tick(w, 0.1);
    w.load(p.scenes[0], p.settings, true);
    assert.equal(phys.constraints.length, 0);
    assert.equal(w.physicalRigs.size, 12);
  }
  w.dispose();
});
test("script-enabled bots acquire upright body and never attack themselves", () => {
  const n = makeNode("box", { physics: "dynamic", position: [4, 2, 0] }),
    player = prefab06("humanoidPlayer")[0],
    { w } = setup([n, player]);
  assert.equal(w.bodies.get(n.id)!.fixedRotation, false);
  w.command({ type: "bot", id: n.id, mode: "patrol" });
  assert.equal(w.bodies.get(n.id)!.fixedRotation, true);
  w.command({ type: "bot", id: player.id, mode: "attack" });
  tick(w, 1);
  assert.equal(w.health.get(player.id), 100);
  w.dispose();
});
test("script ragdoll on a visual-only node restores visibility and removes all joints", () => {
  const n = makeNode("box", { physics: "none" }),
    { w } = setup([n]);
  w.command({ type: "ragdoll", id: n.id });
  assert.equal(w.objects.get(n.id)!.visible, false);
  assert.equal(w.physics!.constraints.length, 5);
  w.command({ type: "ragdoll", id: n.id, enabled: false });
  assert.equal(w.objects.get(n.id)!.visible, true);
  assert.equal(w.physics!.constraints.length, 0);
  w.dispose();
});
