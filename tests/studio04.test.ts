import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import * as CANNON from "cannon-es";
import {
  createProject,
  parseProject,
  makeNode,
  clone,
  controlDefaults,
  History,
} from "../src/engine/model";
import { extraNames } from "../src/engine/catalog";
import { prefabNames, prefab, type Prefab } from "../src/engine/templates";
import {
  terrainPatch,
  brushTerrain,
  defaultBrush,
  arrangeChildren,
} from "../src/engine/design";
import { diagnose } from "../src/engine/diagnostics";
import { World } from "../src/engine/World";
test("40 modelos originais / 60 totais, hierarquias e colisores válidos", () => {
  assert.equal(Object.keys(extraNames).length, 40);
  assert.equal(Object.keys(prefabNames).length, 60);
  for (const k of Object.keys(prefabNames)) {
    const p = createProject();
    p.scenes[0].nodes = prefab(k as Prefab);
    assert.ok(p.scenes[0].nodes.length);
    const parsed = parseProject(JSON.stringify(p));
    const w = new World(new THREE.Scene());
    w.load(parsed.scenes[0], p.settings, true);
    for (let i = 0; i < 10; i++) w.update(1 / 60, new Set());
    for (const b of w.bodies.values())
      assert.ok(Number.isFinite(b.position.y), k);
    w.dispose();
  }
});
test("migra v3 preservando scripts e sem alterar fonte original", () => {
  const p: any = createProject();
  p.version = 3;
  p.scenes[0].nodes[0].script = {
    language: "lua",
    source: "function update() end",
    enabled: true,
  };
  for (const n of p.scenes[0].nodes) {
    delete n.friction;
    delete n.terrain;
  }
  const raw = JSON.stringify(p),
    next = parseProject(raw);
  assert.equal(next.version, 7);
  assert.equal(next.scenes[0].nodes[0].friction, 0.3);
  assert.equal(next.scenes[0].nodes[0].script.source, "function update() end");
  assert.equal(JSON.stringify(p), raw);
});
test("configurações rejeitam NaN, extremos; persistem valores válidos", () => {
  const p = createProject();
  p.settings.mouseSensitivity = 3;
  p.settings.physicsHz = 240;
  assert.equal(parseProject(JSON.stringify(p)).settings.mouseSensitivity, 3);
  p.settings.physicsHz = 1000;
  assert.throws(() => parseProject(JSON.stringify(p)));
  p.settings.physicsHz = NaN;
  assert.throws(() => parseProject(JSON.stringify(p)));
});
test("diagnóstico Lua 5.3 e JS, posição e sintaxe sem executar código", () => {
  assert.equal(
    diagnose("function update(dt)\n self.x=math.sin(dt)\nend", "lua").length,
    0,
  );
  assert.equal(
    diagnose("local x = 3 << 1\nfunction update() end", "lua").length,
    0,
  );
  assert.equal(
    diagnose("function update(dt) {self.x += dt;}", "javascript").length,
    0,
  );
  const lua = diagnose("function update()\n local a =\nend", "lua");
  assert.equal(lua[0].severity, "error");
  assert.ok(lua[0].line >= 2);
  assert.equal(
    diagnose("function update( {", "javascript")[0].severity,
    "error",
  );
  assert.equal(diagnose("while(true){}", "javascript").length, 0); // parse only, never executes
});
test("terreno: pincéis, limites, pintura, bloqueio e undo", () => {
  const nodes = terrainPatch(),
    tile = nodes[28],
    p = clone(tile.position),
    original = JSON.stringify(nodes);
  assert.equal(nodes.length, 65);
  const history = new History(clone(nodes));
  brushTerrain(nodes, tile.id, p, { ...defaultBrush, mode: "raise" });
  assert.ok(tile.scale[1] > 1);
  assert.equal(tile.position[1] - tile.scale[1] / 2, 0);
  history.commit(clone(nodes));
  assert.equal(JSON.stringify(history.undo()), original);
  brushTerrain(nodes, tile.id, p, {
    ...defaultBrush,
    mode: "terrainPaint",
    color: "#ffffff",
  });
  assert.equal(tile.color, "#ffffff");
  brushTerrain(nodes, tile.id, p, {
    ...defaultBrush,
    mode: "flatten",
    height: 3,
  });
  assert.equal(tile.scale[1], 3);
  brushTerrain(nodes, tile.id, p, {
    ...defaultBrush,
    mode: "lower",
    strength: 100,
  });
  assert.ok(tile.scale[1] >= 0.1);
  tile.locked = true;
  const prev = clone(tile);
  assert.equal(
    brushTerrain(nodes, tile.id, p, { ...defaultBrush, mode: "raise" }),
    false,
  );
  assert.deepEqual(tile, prev);
  const project = createProject();
  project.scenes[0].nodes = nodes;
  assert.equal(
    parseProject(JSON.stringify(project)).scenes[0].nodes[28].terrain,
    true,
  );
});
test("suavização usa estado anterior e alinhamento/distribuição respeitam locks", () => {
  const ns = terrainPatch();
  ns[28].scale[1] = 10;
  ns[28].position[1] = 5;
  brushTerrain(ns, ns[28].id, ns[28].position, {
    ...defaultBrush,
    mode: "smooth",
    strength: 1,
  });
  assert.ok(ns[28].scale[1] < 10);
  const group = makeNode("group"),
    a = makeNode("box", { parent: group.id, position: [-3, 0, 0] }),
    b = makeNode("box", { parent: group.id, position: [2, 0, 0] }),
    c = makeNode("box", { parent: group.id, position: [9, 0, 0] });
  arrangeChildren([group, a, b, c], group.id, 0, true);
  assert.equal(b.position[0], 3);
  c.locked = true;
  arrangeChildren([group, a, b, c], group.id, 0, false);
  assert.equal(a.position[0], 0);
  assert.equal(c.position[0], 9);
});
function falling(fps: number) {
  const w = new World(new THREE.Scene()),
    n = makeNode("box", { position: [0, 20, 0], physics: "dynamic" });
  w.load(
    { id: "s", name: "s", nodes: [n] },
    { background: "#000000", gravity: -9.81 },
    true,
  );
  for (let i = 0; i < fps; i++) w.update(1 / fps, new Set());
  const b = w.bodies.get(n.id)!;
  const result = [b.position.y, b.velocity.y, w.elapsed];
  w.dispose();
  return result;
}
test("gravidade: passos fixos consistentes a 30, 60 e 144 FPS", () => {
  const a = falling(30),
    b = falling(60),
    c = falling(144);
  a.forEach((v, i) => {
    assert.ok(Math.abs(v - b[i]) < 1e-6);
    assert.ok(Math.abs(v - c[i]) < 1e-6);
  });
  assert.ok(Math.abs(a[0] - (20 - 9.81 / 2)) < 0.1);
});
test("controle: velocidade/corrida configuráveis e colliders cilíndricos", () => {
  const w = new World(new THREE.Scene()),
    p = makeNode("box", {
      behavior: "player",
      physics: "dynamic",
      speed: 5,
      position: [0, 10, 0],
    }),
    c = makeNode("cylinder", { physics: "static", position: [10, 0, 0] });
  w.load(
    { id: "s", name: "s", nodes: [p, c] },
    {
      background: "#000000",
      gravity: 0,
      ...controlDefaults,
      moveMultiplier: 2,
      sprintMultiplier: 2,
    },
    true,
  );
  w.update(1 / 60, new Set(["w", "shift"]));
  assert.equal(w.bodies.get(p.id)!.velocity.z, -20);
  assert.ok(w.bodies.get(c.id)!.shapes[0] instanceof CANNON.Cylinder);
  w.applyScript(p.id, { vy: 12, color: "#ffffff" });
  assert.equal(w.bodies.get(p.id)!.velocity.y, 12);
  assert.equal(w.bodies.get(p.id)!.position.y, 10);
  w.dispose();
});
