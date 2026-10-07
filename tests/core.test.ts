import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  createProject,
  parseProject,
  activeScene,
  canParent,
  descendants,
  duplicateBranch,
  History,
  makeNode,
  clone,
} from "../src/engine/model";
import { World } from "../src/engine/World";
test("projeto de exemplo sobrevive a salvar/abrir", () => {
  const p = createProject();
  assert.deepEqual(parseProject(JSON.stringify(p)), p);
  assert.equal(activeScene(p).nodes.length, 21);
});
test("importação rejeita JSON inválido, versão desconhecida e IDs duplicados", () => {
  assert.throws(() => parseProject("{"));
  const p = createProject();
  p.version = 99 as any;
  assert.throws(() => parseProject(JSON.stringify(p)));
  p.version = 5;
  activeScene(p).nodes.push(clone(activeScene(p).nodes[0]));
  assert.throws(() => parseProject(JSON.stringify(p)), /repetido/);
});
test("validação rejeita valores extremos e campos ausentes", () => {
  for (const change of [
    (p: any) => (p.settings.gravity = Infinity),
    (p: any) => (p.scenes[0].nodes[0].scale[0] = -1),
    (p: any) => delete p.scenes[0].nodes[0].visible,
    (p: any) => (p.scenes[0].nodes[0].color = "javascript:x"),
  ]) {
    const p = createProject();
    change(p);
    assert.throws(() => parseProject(JSON.stringify(p)));
  }
});
test("validação rejeita referências inválidas e ciclos", () => {
  const p = createProject(),
    ns = activeScene(p).nodes;
  ns[0].parent = ns[1].id;
  ns[1].parent = ns[0].id;
  assert.throws(() => parseProject(JSON.stringify(p)), /ciclo/);
  ns[1].parent = "missing";
  assert.throws(() => parseProject(JSON.stringify(p)), /pai/);
});
test("migra JSON original", () => {
  const p = parseProject(
    JSON.stringify({
      sceneObjects: [
        {
          id: "a",
          kind: "cubo",
          name: "Teste",
          x: 0,
          y: 1,
          z: 2,
          color: "#ff0000",
          scale: 1,
          rigidBody: true,
          rotationSpeed: 0,
          scriptMode: "none",
        },
      ],
    }),
  );
  assert.equal(activeScene(p).nodes[0].physics, "dynamic");
  assert.equal(p.version, 7);
});
test("hierarquia não permite pai descendente e duplicação remapeia filhos", () => {
  const ns = activeScene(createProject()).nodes;
  const group = ns.find((n) => n.kind === "group")!;
  const ids = descendants(ns, group.id);
  assert.equal(ids.size, 3);
  const child = ns.find((n) => n.parent === group.id)!;
  assert.equal(canParent(ns, group.id, child.id), false);
  const copies = duplicateBranch(ns, group.id);
  assert.equal(copies.length, 3);
  assert.equal(copies[1].parent, copies[0].id);
  assert.notEqual(copies[0].id, group.id);
});
test("histórico desfaz, refaz, limpa futuro e limita memória", () => {
  const h = new History(1, 2);
  h.commit(2);
  h.commit(3);
  h.commit(4);
  assert.equal(h.past.length, 2);
  assert.equal(h.undo(), 3);
  assert.equal(h.redo(), 4);
  h.undo();
  h.commit(7);
  assert.equal(h.future.length, 0);
  assert.equal(h.current, 7);
});
test("física: corpo cai, colide com chão e restaura edição", () => {
  const s = new THREE.Scene(),
    w = new World(s);
  const floor = makeNode("box", {
      position: [0, -0.5, 0],
      scale: [10, 1, 10],
      physics: "static",
    }),
    body = makeNode("box", { position: [0, 4, 0], physics: "dynamic" });
  const data = { id: "s", name: "Test", nodes: [floor, body] };
  w.load(data, { background: "#202a30", gravity: -9.81 }, true);
  for (let i = 0; i < 240; i++) w.update(1 / 60, new Set());
  const y = w.bodies.get(body.id)!.position.y;
  assert.ok(y > 0.45 && y < 0.6, `y=${y}`);
  w.load(data, { background: "#202a30", gravity: -9.81 }, false);
  assert.equal(w.objects.get(body.id)!.position.y, 4);
  assert.equal(body.position[1], 4);
  w.dispose();
});
test("jogador se move e coleta apenas uma vez", () => {
  const w = new World(new THREE.Scene()),
    p = makeNode("box", {
      physics: "dynamic",
      behavior: "player",
      speed: 5,
      position: [0, 1, 0],
    }),
    c = makeNode("sphere", { behavior: "collectible", position: [1.5, 1, 0] });
  w.load(
    { id: "s", name: "s", nodes: [p, c] },
    { background: "#202a30", gravity: 0 },
    true,
  );
  for (let i = 0; i < 15; i++) w.update(1 / 60, new Set(["d"]));
  assert.ok(w.bodies.get(p.id)!.position.x > 0.4);
  assert.equal(w.collected, 1);
  assert.equal(w.total, 1);
  w.update(1 / 60, new Set());
  assert.equal(w.collected, 1);
  w.dispose();
});
test("pausa é controlada pelo chamador e nó invisível não participa da física", () => {
  const w = new World(new THREE.Scene()),
    n = makeNode("box", { visible: false, physics: "dynamic" });
  w.load(
    { id: "s", name: "s", nodes: [n] },
    { background: "#202a30", gravity: -9.81 },
    true,
  );
  assert.equal(w.bodies.size, 0);
  w.dispose();
});
test("migra v2 sem sobrescrever scripts externos e mantém formato novo", () => {
  const p: any = createProject();
  p.version = 2;
  for (const n of p.scenes[0].nodes) {
    delete n.script;
    delete n.locked;
  }
  const migrated = parseProject(JSON.stringify(p));
  assert.equal(migrated.version, 7);
  assert.equal(migrated.scenes[0].nodes[0].script.enabled, false);
  assert.equal(migrated.scenes[0].nodes[0].locked, false);
});
test("valida scripts e modo de câmera", () => {
  const p: any = createProject();
  p.settings.gameCamera = "invalid";
  assert.throws(() => parseProject(JSON.stringify(p)));
  p.settings.gameCamera = "first";
  assert.equal(parseProject(JSON.stringify(p)).settings.gameCamera, "first");
  p.scenes[0].nodes[0].script.source = "x".repeat(128001);
  assert.throws(() => parseProject(JSON.stringify(p)), /Script/);
});
test("checkpoint ativa, queda retorna e conclusão exige cristais", () => {
  const w = new World(new THREE.Scene());
  const floor = makeNode("box", {
      position: [0, -0.5, 0],
      scale: [20, 1, 20],
      physics: "static",
    }),
    player = makeNode("box", {
      position: [0, 1, 0],
      physics: "dynamic",
      behavior: "player",
      speed: 5,
    }),
    cp = makeNode("cylinder", {
      name: "Checkpoint 1",
      position: [0, 0.03, 0],
      scale: [3, 0.06, 3],
      behavior: "checkpoint",
    }),
    finish = makeNode("box", { position: [7, 1, 0], behavior: "finish" }),
    crystal = makeNode("sphere", {
      position: [7, 1, 0],
      behavior: "collectible",
    });
  w.load(
    { id: "s", name: "s", nodes: [floor, player, cp, finish, crystal] },
    { background: "#202a30", gravity: -9.81 },
    true,
  );
  for (let i = 0; i < 100; i++) w.update(1 / 60, new Set());
  assert.equal(w.checkpointName, "Checkpoint 1");
  assert.equal(w.completed, false);
  w.bodies.get(player.id)!.position.y = -20;
  w.update(1 / 60, new Set());
  assert.equal(w.deaths, 1);
  assert.ok(w.bodies.get(player.id)!.position.y > 0);
  w.bodies.get(player.id)!.position.set(7, 1, 0);
  for (let i = 0; i < 90; i++) w.update(1 / 60, new Set());
  assert.equal(w.completed, true);
  w.dispose();
});
test("input FPS relativo ao yaw e sprint", () => {
  const w = new World(new THREE.Scene()),
    n = makeNode("box", {
      position: [0, 1, 0],
      physics: "dynamic",
      behavior: "player",
      speed: 5,
    });
  w.load(
    { id: "s", name: "s", nodes: [n] },
    { background: "#202a30", gravity: 0 },
    true,
  );
  for (let i = 0; i < 10; i++)
    w.update(1 / 60, new Set(["w", "shift"]), Math.PI / 2);
  assert.ok(w.bodies.get(n.id)!.position.x < -1);
  assert.ok(Math.abs(w.bodies.get(n.id)!.position.z) < 0.01);
  w.dispose();
});
