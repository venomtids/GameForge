import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import * as CANNON from "cannon-es";
import {
  CUBE_TETRAHEDRA,
  signedTetraVolume,
  TetraVolume,
} from "../src/engine/TetraVolume";
import {
  DeformedMeshContact,
  resolveDeformedSphere,
} from "../src/engine/DeformedMeshContact";
import { World } from "../src/engine/World";
import { createProject, makeNode, parseProject } from "../src/engine/model";
import { prefab } from "../src/engine/templates";
import { jellyPreset } from "../src/engine/jelly-presets";

const rest = Array.from(
  { length: 8 },
  (_, i) => new THREE.Vector3(i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1),
);
const particles = (anchors = false) =>
  rest.map(
    (p, i) =>
      new CANNON.Body({
        mass: anchors && !(i & 2) ? 0 : 1,
        position: new CANNON.Vec3(p.x, p.y, p.z),
      }),
  );

test("six signed tetrahedra tile the cube; XPBD volume corrects local compression and cannot move anchored corners", () => {
  const exact = CUBE_TETRAHEDRA.map((tet) =>
    signedTetraVolume(tet.map((i) => rest[i])),
  );
  assert.equal(exact.length, 6);
  assert.ok(exact.every((v) => v > 0));
  assert.ok(Math.abs(exact.reduce((sum, v) => sum + v, 0) - 8) < 1e-10);
  for (const hz of [30, 120, 240]) {
    const b = particles(true),
      xpbd = new TetraVolume(b, rest, 2);
    b[7].position.y -= 0.7;
    const before = Math.min(
      ...CUBE_TETRAHEDRA.map(
        (tet, k) =>
          signedTetraVolume(tet.map((i) => b[i].position)) / xpbd.rest[k],
      ),
    );
    for (let i = 0; i < 16; i++) xpbd.project(1 / hz, 0.96);
    assert.ok(xpbd.minRatio > before, `${hz}: ${xpbd.minRatio} vs ${before}`);
    assert.equal(xpbd.inversions, 0);
    assert.ok(
      b.filter((_, i) => !(i & 2)).every((body) => body.position.y === -1),
    );
    assert.ok(
      b.every((body) =>
        Number.isFinite(body.position.x + body.position.y + body.position.z),
      ),
    );
  }
});

test("bounded viscous sealed drop has weaker shape pull, pressure recovery and no inverted tetrahedra", () => {
  const compare = (drop: boolean) => {
    const n = prefab("jelly")[0],
      project = createProject();
    n.position = [0, 3, 0];
    n.deform = { ...n.deform, ...jellyPreset(drop ? "drop" : "soft") };
    project.scenes[0].nodes = [
      makeNode("box", {
        id: "floor",
        physics: "static",
        scale: [15, 1, 15],
        position: [0, -0.5, 0],
      }),
      n,
    ];
    const w = new World(new THREE.Scene());
    w.load(project.scenes[0], project.settings, true);
    const rig = w.physicalRigs.get(n.id)!;
    let minRatio = 1,
      peakDistortion = 0;
    for (let i = 0; i < 480; i++) {
      if (i === 120)
        w.command({ type: "impulse", id: n.id, x: 10, y: 5, z: 0 });
      w.update(1 / 120, new Set());
      minRatio = Math.min(minRatio, rig.jelly!.tetra.minRatio);
      const center = rig.bodies
        .reduce(
          (c, b) =>
            c.add(new THREE.Vector3(b.position.x, b.position.y, b.position.z)),
          new THREE.Vector3(),
        )
        .multiplyScalar(1 / 8);
      const spans = rig.bodies.map((b) =>
        Math.hypot(
          b.position.x - center.x,
          b.position.y - center.y,
          b.position.z - center.z,
        ),
      );
      if (i >= 120)
        peakDistortion = Math.max(
          peakDistortion,
          Math.max(...spans) - Math.min(...spans),
        );
    }
    assert.ok(minRatio > 0.25, `signed tetra ratio ${minRatio}`);
    assert.equal(rig.jelly!.tetra.inversions, 0);
    assert.ok(rig.jelly!.volumeRatio > 0.6);
    const saved = parseProject(JSON.stringify(project));
    assert.equal(saved.scenes[0].nodes[1].deform.fluidity, drop ? 0.85 : 0);
    w.dispose();
    return peakDistortion;
  };
  const soft = compare(false),
    drop = compare(true);
  assert.ok(
    drop > soft * 1.25,
    `sealed drop spread ${drop} vs elastic ${soft}`,
  );
});

test("current deformed triangle positions (indexed or not) drive closest point and controller correction", () => {
  const geom = new THREE.BoxGeometry(2, 2, 2, 2, 2, 2);
  const mesh = new THREE.Mesh(geom);
  const narrow = new DeformedMeshContact();
  assert.equal(narrow.query(mesh, new THREE.Vector3(0, 4, 0), 0.3), null);
  assert.equal(narrow.trianglesTested, 0, "AABB must reject remote mesh");
  const flat = narrow.query(mesh, new THREE.Vector3(0, 1.2, 0), 0.3)!;
  assert.ok(Math.abs(flat.point.y - 1) < 1e-6);
  assert.ok(Math.abs(flat.depth - 0.1) < 1e-6);
  assert.ok(flat.normal.y > 0.99);
  // Make one exact triangle higher than its old box/corner proxy.
  const a = geom.getAttribute("position");
  for (let i = 0; i < a.count; i++)
    if (a.getY(i) > 0.99 && a.getX(i) > 0.49 && a.getZ(i) > 0.49)
      a.setY(i, 1.4);
  a.needsUpdate = true;
  geom.computeBoundingBox();
  const changed = narrow.query(mesh, new THREE.Vector3(0.7, 1.35, 0.7), 0.3)!;
  assert.ok(
    changed.point.y > flat.point.y + 0.15,
    `${changed.point.y} vs ${flat.point.y}`,
  );
  const body = new CANNON.Body({
    mass: 12,
    position: new CANNON.Vec3(0.7, 1.35, 0.7),
  });
  body.velocity.y = -4;
  const before = body.position.y;
  assert.ok(resolveDeformedSphere(body, changed) > 0.01);
  assert.ok(body.position.y > before);
  assert.ok(
    body.velocity.x * changed.normal.x +
      body.velocity.y * changed.normal.y +
      body.velocity.z * changed.normal.z >=
      -1e-6,
  );
  // Starting slightly inside a closed surface must push OUTWARD, not deeper.
  const inside = new THREE.Vector3(0, 0.9, 0);
  const back = narrow.query(
    new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2)),
    inside,
    0.3,
  )!;
  assert.ok(back.normal.y > 0.9 && back.depth > 0.3);
  mesh.geometry.dispose();
  const indexed = new THREE.BufferGeometry();
  indexed.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([-1, 0, -1, -1, 0, 1, 1, 0, -1], 3),
  );
  indexed.setIndex([0, 1, 2]);
  indexed.computeBoundingBox();
  const transformed = new THREE.Mesh(indexed);
  transformed.position.y = 2;
  transformed.rotation.y = 0.4;
  const hit = narrow.query(
    transformed,
    new THREE.Vector3(-0.25, 2.2, -0.25),
    0.5,
  )!;
  assert.ok(
    hit?.point && Math.abs(hit.point.y - 2) < 1e-6 && hit.normal.y > 0.9,
  );
  transformed.geometry.dispose();
});

test("world applies deformable-triangle correction to a player beside a free jelly, but supports remain solid", () => {
  const project = createProject(),
    block = prefab("jelly")[0],
    player = prefab("jellyPlayer")[0];
  block.position = [3, 2, 0];
  block.scale = [2, 2, 2];
  player.position = [4.2, 2, 0];
  project.scenes[0].nodes = [player, block];
  project.settings.playerId = player.id;
  const w = new World(new THREE.Scene());
  w.load(project.scenes[0], project.settings, true);
  w.physics!.gravity.set(0, 0, 0);
  const body = w.bodies.get(player.id)!;
  for (let i = 0; i < 5; i++) w.update(1 / 120, new Set());
  assert.ok(
    body.position.x > 4.25,
    `player should be pushed from the actual triangle: ${body.position.x}`,
  );
  assert.ok(w.physicalRigs.get(block.id)!.surface);
  const withSurface = body.position.x;
  w.dispose();
  block.deform.surfaceCollision = false;
  const without = new World(new THREE.Scene());
  without.load(project.scenes[0], project.settings, true);
  without.physics!.gravity.set(0, 0, 0);
  for (let i = 0; i < 5; i++) without.update(1 / 120, new Set());
  assert.ok(
    withSurface - without.bodies.get(player.id)!.position.x > 0.04,
    "setting must actually affect contact",
  );
  without.dispose();
});

test("triangle support enables grounded/jump, expires on launch and is cleared by respawn", () => {
  const project = createProject(),
    block = prefab("jelly")[0],
    player = prefab("jellyPlayer")[0];
  block.position = [3, 2, 0];
  block.scale = [2, 2, 2];
  player.position = [3, 3.8, 0];
  project.scenes[0].nodes = [player, block];
  project.settings.playerId = player.id;
  const w = new World(new THREE.Scene());
  w.load(project.scenes[0], project.settings, true);
  w.physics!.gravity.set(0, 0, 0);
  const body = w.bodies.get(player.id)!;
  for (let i = 0; i < 6; i++) w.update(1 / 120, new Set());
  assert.ok(
    w.grounded(body),
    "deformed surface should support a stationary player",
  );
  w.queueAction(" ");
  w.update(1 / 120, new Set());
  assert.ok(body.velocity.y > 3, "mesh-supported player should jump");
  assert.equal(
    w.grounded(body),
    false,
    "launch cannot inherit stale mesh contact",
  );
  w.respawn();
  assert.equal(
    w.grounded(body),
    false,
    "respawn resets temporary support state",
  );
  w.dispose();
});
