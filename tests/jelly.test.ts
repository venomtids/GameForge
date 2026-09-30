import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import * as CANNON from "cannon-es";
import { World } from "../src/engine/World";
import {
  createProject,
  makeNode,
  parseProject,
  type Node3D,
} from "../src/engine/model";
import { prefab, prefabNames } from "../src/engine/templates";
import { category } from "../src/engine/catalog";
import {
  jellyParkourProject,
  jellyPlatforms,
} from "../src/engine/jelly-parkour";
import { templateProject } from "../src/engine/studio08-templates";

function setup(nodes: Node3D[], hz = 120) {
  const p = createProject();
  p.scenes[0].nodes = [
    makeNode("box", {
      id: "floor",
      position: [0, -0.5, 0],
      scale: [200, 1, 200],
      physics: "static",
      restitution: 0,
    }),
    ...nodes,
  ];
  const player = nodes.find((n) => n.behavior === "player");
  if (player) p.settings.playerId = player.id;
  p.settings.physicsHz = hz;
  const w = new World(new THREE.Scene());
  w.load(p.scenes[0], p.settings, true);
  return { w, p };
}
function tick(
  w: World,
  seconds: number,
  keys = new Set<string>(),
  fps = 120,
  yaw = 0,
) {
  for (let i = 0; i < Math.round(seconds * fps); i++)
    w.update(1 / fps, new Set(keys), yaw);
}
const distance = (a: number, b: number, tolerance = 0.02) =>
  assert.ok(Math.abs(a - b) < tolerance, `${a} ≠ ${b}`);

test("jelly Toolbox entries are real player/anchored prefabs; schema7 roundtrip and optional legacy parameters", () => {
  assert.ok(prefabNames.jellyPlayer && prefabNames.jellyPlatform);
  assert.equal(category("jellyPlayer"), "Personagens e física");
  const n = prefab("jellyPlayer")[0],
    pad = prefab("jellyPlatform")[0];
  assert.equal(n.actor.humanoid, true);
  assert.equal(n.behavior, "player");
  assert.equal(n.physics, "dynamic");
  assert.equal(n.deform.type, "jelly");
  assert.equal(pad.physics, "static");
  const p = jellyParkourProject();
  assert.deepEqual(parseProject(JSON.stringify(p)), p);
  assert.equal(templateProject("jelly").settings.playerId, "jelly-player");
  const old = structuredClone(p);
  old.scenes[0].nodes.forEach((n) => {
    delete n.deform.volume;
    delete n.deform.maxStretch;
  });
  assert.ok(parseProject(JSON.stringify(old)));
  for (const [key, value] of [
    ["volume", 1.01],
    ["volume", -0.1],
    ["maxStretch", 3],
    ["maxStretch", null],
  ] as const) {
    const invalid: any = structuredClone(p);
    invalid.scenes[0].nodes[0].deform[key] = value;
    assert.throws(() => parseProject(JSON.stringify(invalid)));
  }
});

test("free jelly honors mass, preserves positive volume, clamps extreme impulses/strain and remains bounded with 60–240 Hz settings (elastic minimum 120 Hz)", () => {
  for (const [mass, hz, stiffness, damping] of [
    [0.1, 60, 180, 8],
    [4, 120, 100, 3],
    [20, 240, 20, 0.5],
  ]) {
    const n = prefab("jelly")[0];
    n.position = [0, 4, 0];
    n.mass = mass;
    n.deform = {
      type: "jelly",
      stiffness,
      damping,
      volume: 0.95,
      maxStretch: 1.4,
    };
    const { w } = setup([n], hz),
      rig = w.physicalRigs.get(n.id)!;
    distance(
      rig.bodies.reduce((sum, b) => sum + b.mass, 0),
      mass,
      1e-6,
    );
    assert.equal(rig.springs.length, 28);
    assert.ok(rig.meshes[0].geometry.getAttribute("position").count > 24);
    tick(w, 2);
    rig.bodies[7].velocity.set(10000, 10000, -10000);
    w.command({ type: "impulse", id: n.id, x: 100, y: 100, z: 100 });
    tick(w, 8);
    assert.ok(
      rig.jelly!.volumeRatio > 0.6,
      `inverted/collapsed jelly: ${rig.jelly!.volumeRatio}`,
    );
    assert.ok(rig.jelly!.volumeRatio < 1.6);
    for (const b of rig.bodies) {
      assert.ok(Number.isFinite(b.position.x + b.position.y + b.position.z));
      assert.ok(b.velocity.length() < 44);
      assert.ok(b.position.y > -0.3 && b.position.y < 30);
    }
    for (const s of rig.springs)
      assert.ok(
        s.bodyA.position.distanceTo(s.bodyB.position) <= s.restLength * 1.45,
      );
    const physics = w.physics!;
    w.clear();
    assert.equal(physics.bodies.length, 1); // Only the old world's floor remains; rigs are removed.
    assert.equal(physics.constraints.length, 0);
    assert.equal(w.root.children.length, 0);
  }
});

test("independent jelly cages collide with each other, never their own particles", () => {
  const a = prefab("jelly")[0],
    b = prefab("jelly")[0];
  a.position = [0, 1.2, 0];
  b.position = [0, 3.2, 0];
  const { w } = setup([a, b]),
    ra = w.physicalRigs.get(a.id)!,
    rb = w.physicalRigs.get(b.id)!;
  assert.notEqual(ra.collisionGroup, rb.collisionGroup);
  assert.equal(ra.bodies[0].collisionFilterMask & ra.collisionGroup, 0);
  assert.notEqual(ra.bodies[0].collisionFilterMask & rb.collisionGroup, 0);
  let contacts = 0;
  for (let i = 0; i < 360; i++) {
    w.update(1 / 120, new Set());
    contacts += w.physics!.contacts.filter(
      (c) =>
        (ra.bodies.includes(c.bi) && rb.bodies.includes(c.bj)) ||
        (rb.bodies.includes(c.bi) && ra.bodies.includes(c.bj)),
    ).length;
  }
  assert.ok(contacts > 0);
  w.dispose();
});

test("anchored gelatin supports weight, visibly compresses, keeps bottom corners fixed and recovers after unloading", () => {
  const pad = prefab("jellyPlatform")[0],
    n = prefab("jellyPlayer")[0];
  const { w } = setup([pad, n]),
    rig = w.physicalRigs.get(pad.id)!,
    body = w.bodies.get(n.id)!;
  assert.equal(rig.anchored, true);
  assert.equal(rig.anchor, rig.original);
  assert.equal(rig.anchor.type, CANNON.Body.KINEMATIC);
  const rest = rig.anchor.position.y;
  tick(w, 3);
  assert.ok(w.grounded(body));
  assert.ok(rig.anchor.position.y < rest - 0.02);
  assert.ok(body.position.y > 1.5);
  for (const i of [0, 1, 4, 5]) {
    distance(rig.bodies[i].position.y, rig.rest[i].y, 1e-9);
    assert.equal(rig.bodies[i].mass, 0);
  }
  w.restoreRig(pad.id);
  distance(
    w.objects.get(pad.id)!.getWorldPosition(new THREE.Vector3()).y,
    rest,
    1e-9,
  );
  assert.equal(rig.original!.type, CANNON.Body.STATIC);
  assert.equal(w.objects.get(pad.id)!.visible, true);
  w.activateRig(pad.id, "jelly");
  tick(w, 1, new Set(["d"]));
  tick(w, 3);
  distance(rig.anchor.position.y, rest, 0.02);
  assert.ok(w.grounded(body));
  const physics = w.physics!;
  w.command({ type: "remove", id: pad.id });
  assert.equal(w.physicalRigs.size, 0);
  assert.equal(physics.bodies.length, 2);
  assert.equal(w.objects.has(pad.id), false);
  w.dispose();
});

test("gel player keeps solid controller, animated elbows/knees, sprint and physical spring deformation", () => {
  const n = prefab("jellyPlayer")[0],
    { w } = setup([n]),
    body = w.bodies.get(n.id)!;
  assert.equal(w.physicalRigs.has(n.id), false);
  assert.equal(w.jellyCharacters.size, 1);
  tick(w, 1);
  const h = w.objects.get(n.id)!.userData.limbs;
  assert.ok(
    h.leftKnee.parent === h.leftLeg && h.leftElbow.parent === h.leftArm,
  );
  assert.ok(h.materials.some((m: THREE.Material) => m.userData.jelly));
  const z = body.position.z;
  tick(w, 0.4, new Set(["w"]));
  distance(z - body.position.z, n.speed * 0.4, 0.03);
  assert.ok(Math.abs(h.leftLeg.rotation.x) > 0.03);
  assert.ok(Math.abs(h.leftArm.rotation.x) > 0.03);
  const runZ = body.position.z;
  tick(w, 0.4, new Set(["w", "shift"]));
  assert.ok(runZ - body.position.z > n.speed * 0.4 * 1.25);
  tick(w, 0.5);
  const start = body.position.y,
    soft = w.jellyCharacters.get(n.id)!;
  // A one-frame jump at 240 FPS must survive the no-fixed-step frame.
  w.update(1 / 240, new Set([" "]));
  let maxY = start,
    minScale = 1,
    maxScale = 1;
  for (let i = 0; i < 480; i++) {
    w.update(1 / 240, new Set());
    maxY = Math.max(maxY, body.position.y);
    minScale = Math.min(minScale, soft.deformation);
    maxScale = Math.max(maxScale, soft.deformation);
  }
  assert.ok(maxY > start + 1.5, `jump peak: ${maxY}`);
  assert.ok(
    minScale < 0.97 && maxScale > 1.005,
    `no squash/stretch: ${minScale}, ${maxScale}`,
  );
  assert.equal(w.bodies.get(n.id), body);
  assert.ok(w.grounded(body));
  w.dispose();
});

test("short event actions survive keyup/no-step frames; pause/freeze cancel queued actions", () => {
  const n = prefab("jellyPlayer")[0],
    { w } = setup([n]),
    b = w.bodies.get(n.id)!;
  tick(w, 1);
  w.queueAction(" "); // The key was already released before the next RAF.
  w.update(1 / 240, new Set());
  tick(w, 0.05, new Set(), 240);
  assert.ok(b.velocity.y > 4);
  w.queueAction("r");
  w.update(1 / 240, new Set());
  tick(w, 0.05, new Set(), 240);
  assert.equal(w.deaths, 1);
  tick(w, 1);
  w.queueAction(" ");
  w.queueAction("r");
  w.cancelInputActions();
  tick(w, 0.1);
  assert.equal(w.deaths, 1);
  assert.ok(b.velocity.y < 1);
  w.inputFrozen = true;
  w.queueAction("r");
  w.queueAction(" ");
  w.inputFrozen = false;
  tick(w, 0.1);
  assert.equal(w.deaths, 1);
  assert.ok(b.velocity.y < 1);
  w.dispose();
});

test("gel player's death, R, checkpoint respawn, freeze and repeated lifecycle preserve playability and authored data", () => {
  const n = prefab("jellyPlayer")[0],
    { w, p } = setup([n]);
  const original = JSON.stringify(p),
    controller = w.bodies.get(n.id)!;
  tick(w, 1);
  for (let cycle = 0; cycle < 3; cycle++) {
    w.damage(n.id, 100);
    assert.equal(w.jellyCharacters.size, 0);
    assert.equal(w.physicalRigs.get(n.id)?.constraints.length, 5);
    tick(w, 0.2);
    w.update(1 / 240, new Set(["r"]));
    tick(w, 0.1);
    assert.equal(w.health.get(n.id), 100);
    assert.equal(w.bodies.get(n.id), controller);
    assert.equal(w.physicalRigs.size, 0);
    assert.equal(w.jellyCharacters.size, 1);
    assert.equal(w.physics!.constraints.length, 0);
    tick(w, 0.6);
  }
  w.spawn.set(3, 2, -4);
  w.checkpointName = "Gel safe";
  w.respawn();
  distance(controller.position.x, 3);
  distance(controller.position.z, -4);
  w.inputFrozen = true;
  tick(w, 0.5, new Set(["w", " "]));
  distance(controller.position.z, -4);
  w.inputFrozen = false;
  tick(w, 0.3, new Set(["w"]));
  assert.ok(controller.position.z < -5);
  const physics = w.physics!;
  w.load(p.scenes[0], p.settings, false);
  assert.equal(physics.constraints.length, 0);
  assert.equal(w.jellyCharacters.size, 0);
  assert.equal(w.physics, null);
  assert.equal(w.objects.get(n.id)!.position.y, n.position[1]);
  assert.equal(JSON.stringify(p), original);
  w.dispose();
});

test("gel character follows script body replacement/removal and can resume normal movement", () => {
  const n = prefab("jellyPlayer")[0],
    { w } = setup([n]);
  tick(w, 0.5);
  w.applyNodePatch(n.id, { physics: "static" });
  assert.equal(w.jellyCharacters.size, 0);
  assert.equal(w.bodies.get(n.id)!.mass, 0);
  w.applyNodePatch(n.id, { physics: "dynamic" });
  assert.equal(w.jellyCharacters.get(n.id)!.body, w.bodies.get(n.id));
  const z = w.bodies.get(n.id)!.position.z;
  tick(w, 0.2, new Set(["w"]));
  assert.ok(w.bodies.get(n.id)!.position.z < z - 0.9);
  w.applyNodePatch(n.id, { physics: "none" });
  assert.equal(w.jellyCharacters.size, 0);
  assert.equal(w.bodies.has(n.id), false);
  w.applyNodePatch(n.id, { physics: "dynamic" });
  assert.equal(w.jellyCharacters.get(n.id)!.body, w.bodies.get(n.id));
  w.dispose();
});

test("only high-restitution anchored jelly pads provide landing boost (normal and gel players)", () => {
  for (const jelly of [false, true]) {
    const pad = prefab("jellyPlatform")[0],
      n = prefab(jelly ? "jellyPlayer" : "humanoidPlayer")[0];
    pad.restitution = 0.85;
    n.position = [0, 4, 0];
    const { w } = setup([pad, n]),
      b = w.bodies.get(n.id)!;
    let rebounded = false;
    for (let i = 0; i < 180; i++) {
      w.update(1 / 120, new Set());
      if (b.velocity.y >= 6.9) rebounded = true;
    }
    assert.ok(rebounded);
    w.dispose();
  }
});

for (const fps of [30, 60, 144])
  test(`Jelly Jump entire real-input parkour at ${fps} FPS: 11 gel surfaces, 2 checkpoints, 5 crystals, boost and finish`, () => {
    const p = jellyParkourProject(),
      original = JSON.stringify(p),
      w = new World(new THREE.Scene());
    w.load(p.scenes[0], p.settings, true);
    const body = w.bodies.get("jelly-player")!;
    assert.equal(w.physicalRigs.size, 11);
    assert.equal(w.jellyCharacters.size, 1);
    let boosts = 0;
    w.onEvent = (event) => {
      if (event.startsWith("Impulso elástico")) boosts++;
    };
    tick(w, 1.5, new Set(), fps);
    for (let target = 1; target < jellyPlatforms.length; target++) {
      const dest = jellyPlatforms[target];
      let landed = false,
        jumped = !w.grounded(body) && body.velocity.y > 1,
        high = body.position.y;
      for (let frame = 0; frame < fps * 5; frame++) {
        const dx = dest.x - body.position.x,
          dz = dest.z - body.position.z,
          distance = Math.hypot(dx, dz),
          keys = new Set<string>();
        if (distance > 0.09) keys.add("w");
        if (!jumped && w.grounded(body)) {
          keys.add(" ");
          jumped = true;
        }
        w.update(1 / fps, keys, Math.atan2(-dx, -dz));
        high = Math.max(high, body.position.y);
        if (
          Math.hypot(dest.x - body.position.x, dest.z - body.position.z) <
            0.4 &&
          ((w.grounded(body) && body.position.y < dest.y + 1.25) ||
            (dest.boost && body.velocity.y > 6 && boosts > 0))
        ) {
          landed = true;
          break;
        }
        if (w.deaths) break;
      }
      assert.ok(landed, `unreachable stage ${target + 1} at ${fps} FPS`);
      assert.ok(
        high > dest.y + 1.4,
        `stage ${target + 1} wasn't reached by a real jump`,
      );
    }
    assert.equal(w.collected, 5);
    assert.equal(w.checkpointIndex, 1);
    assert.equal(w.completed, true);
    assert.equal(w.deaths, 0);
    assert.ok(boosts > 0);
    assert.equal(JSON.stringify(p), original);
    w.dispose();
  });
