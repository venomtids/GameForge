import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import * as CANNON from "cannon-es";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import {
  makeNode,
  createProject,
  parseProject,
  clone,
} from "../src/engine/model";
import {
  flatSurface,
  validateVoxel,
  validateTextures,
  validateUI,
} from "../src/engine/studio-model";
import {
  advancedGeometry,
  sculptSurface,
  surfaceGeometry,
} from "../src/engine/surfaces";
import { defaultBrush } from "../src/engine/design";
import { World } from "../src/engine/World";
import { VoxelVolume, cellIndex } from "../src/engine/VoxelVolume";
import { baseMap } from "../src/engine/maps";
import { diagnose } from "../src/engine/diagnostics";
const project = () =>
  parseProject(
    readFileSync(
      "examples/bosque-vivo/Bosque-Vivo-v0.5.gameforge.json",
      "utf8",
    ),
  );
test("v5 roundtrip game: code/UI/textures/voxel authored in project", () => {
  const p = project();
  assert.equal(p.version, 7);
  assert.equal(p.scenes[0].ui!.length, 35);
  assert.equal(p.scenes[0].nodes[0].script.language, "javascript");
  assert.ok(p.scenes[0].nodes[0].script.source.includes("function craft"));
  assert.deepEqual(parseProject(JSON.stringify(p)), p);
  assert.equal(
    diagnose(p.scenes[0].nodes[0].script.source, "javascript").length,
    0,
  );
});
test("v4 migration preserves old geometry/scripts", () => {
  const old: any = createProject();
  old.version = 4;
  for (const n of old.scenes[0].nodes) {
    delete n.textureId;
    delete n.surface;
  }
  const p = parseProject(JSON.stringify(old));
  assert.equal(p.version, 7);
  assert.equal(p.scenes[0].nodes[0].textureId, null);
  assert.equal(p.scenes[0].nodes[0].surface, null);
});
test("new fields reject invalid volume, textures and UI dimensions", () => {
  const p = project();
  p.scenes[0].voxel!.blocks[0] = 99;
  assert.throws(() => parseProject(JSON.stringify(p)));
  assert.throws(() =>
    validateTextures([{ id: "a", name: "a", size: 32, pixels: [] }]),
  );
  assert.throws(() => validateUI([{ ...project().scenes[0].ui![0], w: 1000 }]));
});
test("continuous terrain sculpt, vertex paint, smoothing and geometry match", () => {
  const s = flatSurface();
  const center = 16 * 33 + 16;
  sculptSurface(s, [0, 0, 0], { ...defaultBrush, mode: "raise", strength: 2 });
  assert.equal(s.heights[center], 2);
  sculptSurface(s, [0, 0, 0], {
    ...defaultBrush,
    mode: "terrainPaint",
    strength: 1,
    color: "#ffaa00",
  });
  assert.equal(s.colors[center], "#ffaa00");
  sculptSurface(s, [0, 0, 0], { ...defaultBrush, mode: "smooth", strength: 1 });
  assert.ok(s.heights[center] < 2);
  const g = surfaceGeometry(s);
  assert.equal(g.getAttribute("position").count, 1089);
  assert.ok(
    Math.abs(g.getAttribute("position").getY(center) - s.heights[center]) <
      1e-6,
  );
  g.dispose();
});
test("heightfield supports a falling box at known elevation", () => {
  const terrain = makeNode("terrain", {
    position: [0, 0, 0],
    physics: "static",
  });
  terrain.surface!.heights.fill(2);
  const box = makeNode("box", {
    physics: "dynamic",
    position: [1, 6, 1],
    restitution: 0,
  });
  const w = new World(new THREE.Scene());
  w.load(
    { id: "t", name: "t", nodes: [terrain, box] },
    { background: "#000000", gravity: -9.81 },
    true,
  );
  assert.ok(w.bodies.get(terrain.id)!.shapes[0] instanceof CANNON.Heightfield);
  for (let i = 0; i < 240; i++) w.update(1 / 60, new Set());
  assert.ok(Math.abs(w.bodies.get(box.id)!.position.y - 2.5) < 0.08);
  w.dispose();
});
test("six advanced forms and base maps validate and render geometry", () => {
  for (const kind of [
    "wedge",
    "capsule",
    "torus",
    "arch",
    "rock",
    "star",
  ] as const) {
    const g = advancedGeometry(makeNode(kind));
    assert.ok(g);
    assert.ok(g!.getAttribute("position").count > 0);
    g!.dispose();
  }
  for (const kind of ["grass", "hills", "shapes"] as const)
    parseProject(JSON.stringify(baseMap(kind)));
});
test("generic voxel mesh culls hidden faces and bounds edits", () => {
  const v = clone(project().scenes[0].voxel!);
  v.blocks.fill(0);
  v.blocks[cellIndex(1, 1, 1, 32)] = 1;
  v.blocks[cellIndex(2, 1, 1, 32)] = 1;
  const volume = new VoxelVolume(v, []);
  assert.equal(volume.meshes[0].geometry.getAttribute("position").count, 60);
  assert.equal(volume.set(-1, 0, 0, 1), false);
  assert.equal(volume.set(3, 1, 1, 2), true);
  assert.equal(volume.get(3, 1, 1), 2);
  assert.ok(validateVoxel(volume.data));
  volume.dispose();
});
test("voxel collision supports the actual project player", () => {
  const p = project(),
    w = new World(new THREE.Scene());
  w.load(p.scenes[0], p.settings, true);
  for (let i = 0; i < 120; i++) w.update(1 / 60, new Set());
  const b = w.bodies.get("survivor")!;
  assert.ok(b.position.y > 6.7 && b.position.y < 7.1, b.position.y + "");
  assert.ok(w.grounded(b));
  w.dispose();
});
function gameHarness() {
  const p = project(),
    volume = clone(p.scenes[0].voxel!),
    ui = new Map<string, any>(),
    nodes = new Map<string, any>([
      ["survivor", { x: 16.5, y: 7, z: 18.5, vy: 0, grounded: true }],
    ]);
  let stored: any = null;
  let frozen = false;
  let respawns = 0;
  const idx = (x: number, y: number, z: number) =>
    cellIndex(x, y, z, volume.size);
  const engine = {
    saved: null,
    log: () => {},
    clamp: (v: number, a: number, b: number) => Math.max(a, Math.min(b, v)),
    get: (id: string) => nodes.get(id),
    set: (id: string, patch: any) => {
      Object.assign(nodes.get(id) ?? {}, patch);
    },
    spawn: (id: string, patch: any) => nodes.set(id, { ...patch }),
    remove: (id: string) => nodes.delete(id),
    ui: (id: string, patch: any) => ui.set(id, { ...ui.get(id), ...patch }),
    freeze: (v: boolean) => (frozen = v),
    sky: () => {},
    respawn: () => {
      respawns++;
      nodes.set("survivor", { x: 16.5, y: 7, z: 18.5, vy: 0, grounded: true });
    },
    store: (s: any) => (stored = structuredClone(s)),
    voxel: {
      size: 32,
      get: (x: number, y: number, z: number) =>
        x >= 0 && x < 32 && z >= 0 && z < 32 && y >= 0 && y < 24
          ? volume.blocks[idx(x, y, z)]
          : 0,
      set: (x: number, y: number, z: number, t: number) => {
        volume.blocks[idx(x, y, z)] = t;
        return true;
      },
      snapshot: () => [...volume.blocks],
      replace: (blocks: number[]) => (volume.blocks = [...blocks]),
    },
  };
  const context = vm.createContext({ engine, self: {} });
  vm.runInContext(p.scenes[0].nodes[0].script.source, context, {
    timeout: 1000,
  });
  vm.runInContext("start()", context);
  const run = (input: any = {}, dt = 0.1) => {
    context.input = { pressed: {}, released: {}, events: [], ...input };
    context.dt = dt;
    vm.runInContext("update(dt,0,input)", context, { timeout: 1000 });
  };
  const event = (id: string) => run({ events: [id] });
  const evaluate = (text: string) => vm.runInContext(text, context);
  const mine = (type: number) => {
    const i = volume.blocks.findIndex(
      (v, i) => v === type && Math.floor(i / (32 * 32)) > 0,
    );
    assert.ok(i >= 0, "missing block " + type);
    const y = Math.floor(i / 1024),
      z = Math.floor((i % 1024) / 32),
      x = i % 32;
    for (let j = 0; j < 20 && volume.blocks[i]; j++)
      run({
        mouse0: true,
        ray: { cell: [x, y, z], type, distance: 2, normal: [0, 1, 0] },
      });
    assert.equal(volume.blocks[i], 0, "mined " + type);
  };
  return {
    run,
    event,
    evaluate,
    mine,
    ui,
    nodes,
    volume,
    get stored() {
      return stored;
    },
    get frozen() {
      return frozen;
    },
    get respawns() {
      return respawns;
    },
  };
}
test("game SCRIPT progression: mine, craft tools, ore, crystal, beacon and win", () => {
  const g = gameHarness();
  assert.equal(g.frozen, true);
  g.event("begin");
  assert.equal(g.frozen, false);
  for (let i = 0; i < 3; i++) g.mine(5);
  for (let i = 0; i < 3; i++) g.event("craft-0");
  g.event("craft-1");
  g.event("craft-2");
  assert.equal(g.evaluate('count("pickaxe")'), 1);
  g.event("craft-1");
  for (let i = 0; i < 5; i++) g.mine(11);
  g.event("craft-4");
  assert.equal(g.evaluate('count("ironpick")'), 1);
  g.mine(12);
  for (let i = 0; i < 6; i++) g.mine(4);
  g.event("craft-6");
  assert.equal(g.evaluate('count("beacon")'), 1);
  g.run({ pressed: { "8": true } });
  const cell: [number, number, number] = [16, 5, 15];
  g.run({
    pressed: { mouse2: true },
    ray: { cell, normal: [0, 1, 0], distance: 3 },
  });
  assert.equal(g.evaluate("won"), true);
  assert.equal(g.volume.blocks[cellIndex(16, 6, 15, 32)], 14);
  assert.equal(g.stored.won, true);
});
test("game SCRIPT hunger, food, fall damage, enemies, death/respawn and save/load", () => {
  const g = gameHarness();
  g.event("begin");
  g.evaluate("hunger=10");
  g.run({ pressed: { f: true } });
  assert.ok(g.evaluate("hunger") > 14);
  assert.equal(g.evaluate('count("berry")'), 7);
  g.evaluate("hunger=0;damageTimer=-1");
  g.run();
  assert.equal(g.evaluate("health"), 19);
  g.evaluate("health=20;hunger=20;falling=-14;damageTimer=-1");
  g.run();
  assert.ok(g.evaluate("health") < 20);
  g.evaluate(
    "health=20;clock=CONFIG.daySeconds*.75;damageTimer=-1;mobs[0].x=16.5;mobs[0].y=7;mobs[0].z=18.5",
  );
  g.run();
  assert.equal(g.evaluate("health"), 17);
  g.evaluate("inventory.sword=1");
  for (let i = 0; i < 12; i++)
    g.run({ mouse0: true, target: { id: "forest-creature-0", distance: 2 } });
  assert.equal(g.nodes.has("forest-creature-0"), false);
  g.event("save");
  assert.equal(g.stored.format, "bosque-vivo");
  g.evaluate("inventory.berry=0");
  g.event("load");
  assert.ok(g.evaluate('count("berry")') > 0);
  g.nodes.get("survivor").y = -6;
  g.run();
  assert.equal(g.evaluate("health"), 0);
  assert.equal(g.frozen, true);
  g.event("begin");
  assert.equal(g.evaluate("health"), 20);
  assert.equal(g.respawns, 1);
});
