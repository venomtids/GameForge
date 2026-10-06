import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { JellyMesh } from "../src/engine/JellyMesh";
import { jellyBox, jellyMaterial } from "../src/engine/jelly-material";
import { jellyPreset } from "../src/engine/jelly-presets";
import {
  createProject,
  makeNode,
  parseProject,
  type Node3D,
} from "../src/engine/model";
import { validateDeform } from "../src/engine/features06";
import { World } from "../src/engine/World";
import { prefab } from "../src/engine/templates";

function surface(
  preset: "soft" | "firm" = "soft",
  patch: Partial<Node3D["deform"]> = {},
  mass = 12,
) {
  const node = makeNode("box", {
    mass,
    deform: {
      type: "jelly",
      ...jellyPreset(preset),
      ...patch,
    } as Node3D["deform"],
  });
  const mesh = new THREE.Mesh(jellyBox(), jellyMaterial("#75e5bd"));
  const original = mesh.geometry;
  const spring = new JellyMesh(mesh, node);
  return { node, mesh, spring, original };
}
function simulate(s: ReturnType<typeof surface>, frames = 480) {
  let peak = 0;
  for (let i = 0; i < frames; i++) {
    if (i === 20) s.mesh.position.x = 0.12;
    if (i === 32) s.mesh.rotation.y = 0.28;
    s.spring.step(1 / 120);
    peak = Math.max(peak, s.spring.peakDisplacement);
  }
  return peak;
}

test("vertex spring adaptation: soft preset visibly responds more than firm, then recovers", (t) => {
  const soft = surface("soft"),
    firm = surface("firm");
  const softPeak = simulate(soft),
    firmPeak = simulate(firm);
  t.diagnostic(
    JSON.stringify({ softPeak, firmPeak, responseRatio: softPeak / firmPeak }),
  );
  assert.ok(softPeak > 0.025, `soft peak too small: ${softPeak}`);
  assert.ok(softPeak > firmPeak * 2.5, `soft=${softPeak}, firm=${firmPeak}`);
  assert.ok(soft.spring.peakDisplacement < softPeak * 0.05);
  assert.ok(
    soft.spring.uniqueVertices <
      soft.mesh.geometry.getAttribute("position").count / 2,
  );
  soft.spring.dispose();
  firm.spring.dispose();
  assert.equal(soft.mesh.geometry, soft.original);
});

test("per-vertex translation AND rotation excitation, impulse falloff and reset use real geometry", () => {
  const s = surface();
  s.spring.step(1 / 120);
  s.spring.step(1 / 120);
  s.mesh.rotation.y = 0.35;
  for (let i = 0; i < 20; i++) s.spring.step(1 / 120);
  assert.ok(
    s.spring.peakDisplacement > 0.015,
    "rotation didn't excite the mesh",
  );
  s.spring.reset();
  assert.equal(s.spring.peakDisplacement, 0);
  s.mesh.rotation.y = 0;
  s.spring.step(1 / 120);
  s.spring.impulse(
    new THREE.Vector3(0.5, 0.5, 0.5),
    new THREE.Vector3(1, 0, 0),
    2,
    0.45,
  );
  s.spring.step(1 / 120);
  s.spring.step(1 / 120);
  const a = s.mesh.geometry.getAttribute("position"),
    rest = s.original.getAttribute("position");
  let near = 0,
    far = 0;
  for (let i = 0; i < a.count; i++) {
    const distance = new THREE.Vector3(
      rest.getX(i),
      rest.getY(i),
      rest.getZ(i),
    ).distanceTo(new THREE.Vector3(0.5, 0.5, 0.5));
    const displacement = Math.abs(a.getX(i) - rest.getX(i));
    if (distance < 0.45) near = Math.max(near, displacement);
    if (distance > 1) far = Math.max(far, displacement);
  }
  assert.ok(
    near > 0.005 && far < near * 0.1,
    `localized impulse: near=${near} far=${far}`,
  );
  s.spring.dispose();
});

test("radius preservation and custom pivot change the response without detaching duplicate seam vertices", () => {
  const loose = surface("soft", { radiusConstraint: 0 }),
    bound = surface("soft", { radiusConstraint: 1 });
  const radiusError = (s: ReturnType<typeof surface>) => {
    s.spring.step(1 / 120);
    s.spring.step(1 / 120);
    s.spring.impulse(
      new THREE.Vector3(0.45, 0.45, 0.45),
      new THREE.Vector3(1, 1, 1).normalize(),
      3,
      2,
    );
    for (let i = 0; i < 100; i++) s.spring.step(1 / 120);
    const a = s.mesh.geometry.getAttribute("position"),
      r = s.original.getAttribute("position");
    let error = 0;
    for (let i = 0; i < a.count; i++)
      error = Math.max(
        error,
        Math.abs(
          Math.hypot(a.getX(i), a.getY(i), a.getZ(i)) -
            Math.hypot(r.getX(i), r.getY(i), r.getZ(i)),
        ),
      );
    return error;
  };
  assert.ok(radiusError(bound) < radiusError(loose));
  const before = bound.spring.peakDisplacement;
  bound.node.deform.pivot = [0, 1, 0];
  bound.mesh.position.z = 0.2;
  for (let i = 0; i < 12; i++) bound.spring.step(1 / 120);
  assert.ok(bound.spring.peakDisplacement > before);
  const seen = new Map<string, number[]>(),
    p = bound.mesh.geometry.getAttribute("position"),
    r = bound.original.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const key = `${Math.round(r.getX(i) * 1e5)},${Math.round(r.getY(i) * 1e5)},${Math.round(r.getZ(i) * 1e5)}`;
    const point = [p.getX(i), p.getY(i), p.getZ(i)],
      old = seen.get(key);
    if (old) assert.ok(point.every((v, j) => Math.abs(v - old[j]) < 1e-5));
    else seen.set(key, point);
  }
  loose.spring.dispose();
  bound.spring.dispose();
});

test("vertex mass, intensity=0, bounds and implicit integration remain finite at extreme settings", () => {
  for (const mass of [0.1, 12, 120]) {
    const s = surface(
      "soft",
      {
        stiffness: 5,
        damping: 0.1,
        intensity: 3,
        movementInfluence: 4,
        maxStretch: 2.5,
        pivot: [-2, 2, 2],
      },
      mass,
    );
    for (let i = 0; i < 360; i++) {
      s.mesh.position.x = Math.sin(i * 0.06) * 2;
      s.mesh.rotation.y = i * 0.12;
      s.spring.step(1 / 120);
      const a = s.mesh.geometry.getAttribute("position");
      assert.ok(Number.isFinite(a.getX(0) + a.getY(0) + a.getZ(0)));
      assert.ok(s.spring.peakDisplacement <= 0.31);
    }
    s.node.deform.intensity = 0;
    s.spring.step(1 / 120);
    assert.equal(s.spring.peakDisplacement, 0);
    assert.deepEqual(
      Array.from(s.mesh.geometry.getAttribute("position").array),
      Array.from(s.original.getAttribute("position").array),
    );
    s.spring.dispose();
  }
});

test("visual LOD reduces work, resets at long distance and re-enters without a stale motion kick", () => {
  const s = surface("soft", { lodNear: 5, lodFar: 20 });
  simulate(s, 80);
  s.spring.step(1 / 120, new THREE.Vector3(100, 0, 0));
  assert.ok(s.spring.culled);
  assert.equal(s.spring.peakDisplacement, 0);
  const count = s.spring.updates;
  for (let i = 0; i < 80; i++) {
    s.mesh.position.x += 0.02;
    s.spring.step(1 / 120, new THREE.Vector3(100, 0, 0));
  }
  assert.equal(s.spring.updates, count);
  s.spring.step(1 / 120, s.mesh.position.clone());
  assert.equal(s.spring.culled, false);
  assert.equal(s.spring.peakDisplacement, 0);
  s.spring.dispose();
});

test("new jelly settings roundtrip, validate all bounds, omit optional legacy fields and clone pivots", () => {
  const a = makeNode("box"),
    b = makeNode("box");
  a.deform.pivot![0] = 1;
  assert.equal(b.deform.pivot![0], 0);
  const project = createProject();
  project.scenes[0].nodes = [a];
  assert.deepEqual(parseProject(JSON.stringify(project)), project);
  const legacy = { type: "jelly", stiffness: 100, damping: 3 };
  assert.deepEqual(validateDeform(legacy), legacy);
  for (const bad of [
    { intensity: 4 },
    { movementInfluence: NaN },
    { maintainRadius: 1 },
    { pivot: [0, 0] },
    { pivot: [3, 0, 0] },
    { lodNear: 30, lodFar: 20 },
    { performance: -1 },
    { radiusConstraint: null },
  ])
    assert.throws(() => validateDeform({ ...a.deform, ...bad }));
});

test("soft-body cage preserves a sphere's authored topology, and LOD never removes its collisions", () => {
  const project = createProject(),
    sphere = makeNode("sphere", {
      id: "soft-sphere",
      position: [0, 3, 0],
      physics: "dynamic",
      mass: 12,
      deform: { type: "jelly", ...jellyPreset("soft") } as Node3D["deform"],
    });
  project.scenes[0].nodes = [
    makeNode("box", {
      position: [0, -0.5, 0],
      scale: [20, 1, 20],
      physics: "static",
    }),
    sphere,
  ];
  const w = new World(new THREE.Scene());
  w.load(project.scenes[0], project.settings, true);
  const original = w.objects.get(sphere.id) as THREE.Mesh,
    rig = w.physicalRigs.get(sphere.id)!;
  assert.equal(
    rig.meshes[0].geometry.getAttribute("position").count,
    original.geometry.getAttribute("position").count,
  );
  assert.equal(
    rig.meshes[0].geometry.index!.count,
    original.geometry.index!.count,
  );
  w.setJellyView(new THREE.Vector3(200, 0, 0));
  for (let i = 0; i < 360; i++) w.update(1 / 120, new Set());
  assert.ok(rig.surface!.culled);
  assert.equal(rig.bodies.length, 8);
  assert.ok(rig.bodies.every((b) => b.position.y > -0.3));
  assert.ok(rig.jelly!.volumeRatio > 0.6);
  w.dispose();
});

test("much softer playable avatar has more squash, per-vertex response, and keeps feet on its solid controller", (t) => {
  const probe = (preset: "soft" | "firm") => {
    const project = createProject(),
      p = prefab("jellyPlayer")[0];
    p.deform = { ...p.deform, ...jellyPreset(preset) };
    project.scenes[0].nodes = [
      makeNode("box", {
        position: [0, -0.5, 0],
        scale: [30, 1, 30],
        physics: "static",
      }),
      p,
    ];
    project.settings.playerId = p.id;
    const w = new World(new THREE.Scene());
    w.load(project.scenes[0], project.settings, true);
    for (let i = 0; i < 120; i++) w.update(1 / 120, new Set());
    w.queueAction(" ");
    const soft = w.jellyCharacters.get(p.id)!,
      body = w.bodies.get(p.id)!,
      object = w.objects.get(p.id)!,
      box = new THREE.Box3();
    let peak = 0,
      vertex = 0;
    for (let i = 0; i < 260; i++) {
      w.update(1 / 120, new Set());
      peak = Math.max(peak, Math.abs(soft.deformation - 1));
      vertex = Math.max(
        vertex,
        ...soft.surfaces.map((m) => m.peakDisplacement),
      );
      object.updateWorldMatrix(true, true);
      box.setFromObject(object, true);
      assert.ok(box.min.y >= body.position.y - 0.9 - 0.05);
    }
    assert.ok(soft.surfaces.length >= 12 && vertex > 0.001);
    w.dispose();
    return peak;
  };
  const soft = probe("soft"),
    firm = probe("firm");
  t.diagnostic(
    JSON.stringify({
      softSquash: soft,
      firmSquash: firm,
      responseRatio: soft / firm,
    }),
  );
  assert.ok(
    soft > 0.12 && soft > firm * 3,
    `squash response soft=${soft}, firm=${firm}`,
  );
});

test("engine.set tunes intensity/pivot/preset at runtime for an anchored pad and avatar, without changing rig type", () => {
  const project = createProject(),
    pad = prefab("jellyPlatform")[0],
    player = prefab("jellyPlayer")[0];
  project.scenes[0].nodes = [pad, player];
  project.settings.playerId = player.id;
  const w = new World(new THREE.Scene());
  w.load(project.scenes[0], project.settings, true);
  const surface = w.physicalRigs.get(pad.id)!.surface!,
    character = w.jellyCharacters.get(player.id)!;
  w.applyNodePatch(pad.id, {
    deform: { ...jellyPreset("firm"), pivot: [0, 1, 0] },
  });
  assert.equal(surface.node.deform.stiffness, 145);
  assert.deepEqual(surface.node.deform.pivot, [0, 1, 0]);
  w.applyNodePatch(player.id, { deform: { intensity: 0, type: "ragdoll" } });
  for (let i = 0; i < 12; i++) w.update(1 / 120, new Set());
  assert.equal(character.node.deform.type, "jelly");
  assert.ok(character.surfaces.every((s) => s.peakDisplacement === 0));
  assert.throws(() =>
    w.applyNodePatch(pad.id, { deform: { lodNear: 50, lodFar: 10 } }),
  );
  w.dispose();
});

test("hidden first-person mesh skips detail and returns without inheriting stale motion", () => {
  const s = surface();
  const parent = new THREE.Group();
  parent.add(s.mesh);
  simulate(s, 80);
  parent.visible = false;
  s.spring.step(1 / 120);
  assert.ok(s.spring.culled);
  const updates = s.spring.updates;
  for (let i = 0; i < 60; i++) {
    s.mesh.rotation.y += 0.1;
    s.spring.step(1 / 120);
  }
  assert.equal(s.spring.updates, updates);
  parent.visible = true;
  s.spring.step(1 / 120);
  assert.equal(s.spring.peakDisplacement, 0);
  s.spring.dispose();
});

test("reactive platform's visible top follows its solid support; waves cannot swallow or suspend the rider", () => {
  const project = createProject(),
    pad = prefab("jellyPlatform")[0],
    player = prefab("jellyPlayer")[0];
  player.position = [0, 4, 0];
  project.scenes[0].nodes = [pad, player];
  project.settings.playerId = player.id;
  const w = new World(new THREE.Scene());
  w.load(project.scenes[0], project.settings, true);
  const rig = w.physicalRigs.get(pad.id)!,
    source = (w.objects.get(pad.id) as THREE.Mesh).geometry.getAttribute(
      "position",
    ),
    a = rig.meshes[0].geometry.getAttribute("position");
  let peak = 0;
  for (let i = 0; i < 300; i++) {
    w.update(1 / 120, new Set());
    peak = Math.max(peak, rig.surface!.peakDisplacement);
    const plane = rig.anchor.position.y + pad.scale[1] / 2;
    for (let j = 0; j < a.count; j++) {
      assert.ok(a.getY(j) <= plane + 1e-6);
      if (source.getY(j) > 0.499) assert.ok(Math.abs(a.getY(j) - plane) < 1e-6);
    }
  }
  assert.ok(peak > 0.01, "platform had no reactive surface motion");
  w.dispose();
});
