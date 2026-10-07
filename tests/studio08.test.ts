import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import * as THREE from "three";
import * as CANNON from "cannon-es";
import {
  makeNode,
  createProject,
  parseProject,
  History,
  type Vec3,
} from "../src/engine/model";
import {
  movementClip,
  recordKeyframe,
  sampleAnimation,
  validateAnimation,
} from "../src/engine/animation";
import {
  alignSelection,
  distributeSelection,
  duplicateSelection,
  groupSelection,
  selectedBranchIds,
  selectionRoots,
  translateSelection,
  ungroupSelection,
} from "../src/engine/editor-operations";
import { AdaptiveResolution } from "../src/engine/render-quality";
import {
  parsePreferences,
  preferenceDefaults,
} from "../src/editor/StudioLayout";
import {
  templateProject,
  studioTemplates,
} from "../src/engine/studio08-templates";
import {
  readScriptDraft,
  rememberScriptDraft,
  clearScriptDraft,
} from "../src/editor/script-drafts";
import {
  decodeProject,
  encodeProject,
  serializeProject,
} from "../src/engine/serialization";
import { World } from "../src/engine/World";
const require = createRequire(import.meta.url);
const {
  atomicWrite,
  atomicWriteSync,
  readProjectFile,
  projectArgument,
  validWindowState,
} = require("../desktop/storage.cjs");
const pose = {
  position: [0, 0, 0] as Vec3,
  rotation: [0, 0, 0] as Vec3,
  scale: [1, 1, 1] as Vec3,
};
function approx(actual: number, expected: number, tolerance = 1e-6) {
  assert.ok(
    Math.abs(actual - expected) < tolerance,
    `${actual} != ${expected}`,
  );
}
function animationWorld(physics: "none" | "static" | "dynamic" = "none") {
  const p = createProject(),
    n = makeNode("box", {
      id: "animated",
      position: [0, 1, 0],
      physics,
      scale: [3, 0.4, 3],
    });
  n.animation = movementClip(n);
  p.scenes[0].nodes = [n];
  const world = new World(new THREE.Scene());
  world.load(p.scenes[0], p.settings, true);
  return { p, n, world };
}

test("0.8: every new template validates, has unique IDs, and loads without a GPU", () => {
  for (const template of studioTemplates) {
    const p = templateProject(template.id),
      migrated = parseProject(serializeProject(p));
    assert.equal(migrated.version, 7);
    assert.equal(migrated.name, p.name);
    const w = new World(new THREE.Scene());
    w.load(migrated.scenes[0], migrated.settings, true);
    assert.equal(w.objects.size, migrated.scenes[0].nodes.length);
    if (!["empty", "scripts"].includes(template.id)) assert.ok(w.playerId);
    w.dispose();
  }
});
test("0.8: optional animation migrates old v7 projects without changing authored transforms", () => {
  const p = createProject(),
    n = p.scenes[0].nodes[0];
  n.animation = movementClip(n);
  const loaded = parseProject(JSON.stringify(p));
  assert.deepEqual(loaded.scenes[0].nodes[0].animation, n.animation);
  assert.deepEqual(loaded.scenes[0].nodes[0].position, n.position);
  delete (p.scenes[0].nodes[0] as any).animation;
  assert.equal(
    parseProject(JSON.stringify(p)).scenes[0].nodes[0].animation,
    null,
  );
});
test("0.8: animation validates known fields and rejects unsafe numbers, unsorted and duplicate keys", () => {
  const clip = movementClip(pose);
  assert.deepEqual(validateAnimation(clip), clip);
  for (const change of [
    (c: any) => (c.duration = Infinity),
    (c: any) => (c.duration = 0),
    (c: any) => (c.interpolation = "eval"),
    (c: any) => (c.loop = 1),
    (c: any) => (c.frames = []),
    (c: any) => (c.frames[1].time = 0),
    (c: any) => (c.frames[1].time = 5),
    (c: any) => (c.frames[1].position[0] = NaN),
    (c: any) => (c.frames[1].scale[0] = -1),
  ]) {
    const c = structuredClone(clip);
    change(c);
    assert.throws(() => validateAnimation(c), /Animação inválida/);
  }
  assert.throws(() =>
    validateAnimation({
      ...clip,
      frames: Array.from({ length: 121 }, (_, i) => ({
        ...clip.frames[0],
        time: i / 100,
      })),
    }),
  );
  const withUnknown = {
    ...clip,
    exploit: "ignored",
    frames: clip.frames.map((f) => ({ ...f, unused: true })),
  };
  assert.equal("exploit" in validateAnimation(withUnknown)!, false);
  assert.equal("unused" in validateAnimation(withUnknown)!.frames[0], false);
});
test("0.8: linear/smooth/step interpolation, boundaries and loop are deterministic", () => {
  const c = movementClip(pose);
  c.interpolation = "linear";
  approx(sampleAnimation(c, 1).position[1], 1);
  approx(sampleAnimation(c, 4).position[1], 0);
  approx(sampleAnimation(c, 4, false).position[1], 0);
  approx(sampleAnimation(c, -2).position[1], 0);
  c.interpolation = "smooth";
  approx(sampleAnimation(c, 0.5).position[1], 0.3125);
  c.interpolation = "step";
  approx(sampleAnimation(c, 1).position[1], 0);
  approx(sampleAnimation(c, 2).position[1], 2);
  assert.deepEqual(sampleAnimation(c, NaN), sampleAnimation(c, 0));
});
test("0.8: recording replaces a keyframe, clamps times and does not mutate the input clip", () => {
  const c = movementClip(pose),
    original = structuredClone(c);
  const n = recordKeyframe(c, 2, { ...pose, position: [4, 6, 8] });
  assert.equal(n.frames.length, 3);
  assert.deepEqual(n.frames[1].position, [4, 6, 8]);
  assert.deepEqual(c, original);
  assert.equal(recordKeyframe(c, -5, pose).frames[0].time, 0);
  assert.equal(recordKeyframe(c, 900, pose).frames[2].time, 4);
});
test("0.8: visual animation actually moves the runtime mesh and authored data stays untouched", () => {
  const { p, world } = animationWorld();
  const before = JSON.stringify(p);
  for (let i = 0; i < 120; i++) world.update(1 / 120, new Set());
  approx(world.objects.get("animated")!.position.y, 2, 1e-5);
  assert.equal(JSON.stringify(p), before);
  world.load(p.scenes[0], p.settings, false);
  approx(world.objects.get("animated")!.position.y, 1);
  world.dispose();
});
test("0.8: static animated platforms have a real kinematic collider that follows the mesh", () => {
  const { world } = animationWorld("static");
  const body = world.bodies.get("animated")!;
  assert.equal(body.type, CANNON.Body.KINEMATIC);
  for (let i = 0; i < 240; i++) world.update(1 / 120, new Set());
  approx(body.position.y, 3, 1e-5);
  approx(body.position.y, world.objects.get("animated")!.position.y);
  world.dispose();
  assert.equal(world.bodies.size, 0);
});
test("0.8: animated group updates child colliders in world space without rescaling physical shapes", () => {
  const p = createProject(),
    group = makeNode("group", { position: [3, 1, 0] }),
    child = makeNode("box", {
      parent: group.id,
      position: [1, 0, 0],
      physics: "static",
    });
  group.animation = movementClip(group);
  group.animation.frames[1].scale = [3, 3, 3];
  p.scenes[0].nodes = [child, group];
  const world = new World(new THREE.Scene());
  world.load(p.scenes[0], p.settings, true);
  for (let i = 0; i < 240; i++) world.update(1 / 120, new Set());
  approx(world.bodies.get(child.id)!.position.x, 4);
  approx(world.bodies.get(child.id)!.position.y, 3);
  assert.deepEqual(world.objects.get(group.id)!.scale.toArray(), [1, 1, 1]);
  world.dispose();
});
test("0.8: dynamic bodies are controlled by physics, never by transform keyframes", () => {
  const { world } = animationWorld("dynamic");
  world.update(0.1, new Set());
  assert.equal(world.bodies.get("animated")!.type, CANNON.Body.DYNAMIC);
  assert.ok(world.objects.get("animated")!.position.y < 1);
  world.dispose();
});
test("0.8: timeline preview and reset do not mutate configs or start physics", () => {
  const { p, world } = animationWorld();
  world.load(p.scenes[0], p.settings, false);
  const before = JSON.stringify(world.configs);
  world.previewAnimation("animated", 2);
  approx(world.objects.get("animated")!.position.y, 3);
  assert.equal(world.physics, null);
  assert.equal(JSON.stringify(world.configs), before);
  world.restoreAnimationPoses();
  approx(world.objects.get("animated")!.position.y, 1);
  world.dispose();
});
test("0.8: selection roots exclude nested children and forest duplication remaps each node once", () => {
  const a = makeNode("group"),
    b = makeNode("box", { parent: a.id }),
    c = makeNode("sphere");
  const nodes = [b, a, c];
  assert.deepEqual(
    new Set(selectionRoots(nodes, [a.id, b.id, c.id]).map((n) => n.id)),
    new Set([a.id, c.id]),
  );
  assert.equal(selectedBranchIds(nodes, [a.id, b.id, c.id]).size, 3);
  const copies = duplicateSelection(nodes, [a.id, b.id, c.id]);
  assert.equal(copies.length, 3);
  assert.equal(new Set(copies.map((n) => n.id)).size, 3);
  assert.equal(copies[0].parent, copies[1].id);
  assert.equal(copies[0].position[0], b.position[0]);
  assert.equal(copies[1].position[0], a.position[0] + 1);
});
test("0.8: duplicated animations follow the copied root offset", () => {
  const n = makeNode("box");
  n.animation = movementClip(n);
  const copy = duplicateSelection([n], [n.id])[0];
  assert.equal(copy.animation!.frames[0].position[0], n.position[0] + 1);
  assert.notEqual(copy.animation, n.animation);
});
test("0.8: grouping and ungrouping siblings preserve their transforms and frame coordinates", () => {
  const a = makeNode("box", { position: [2, 1, 3] }),
    b = makeNode("sphere", { position: [6, 3, 1] });
  a.animation = movementClip(a);
  const nodes = [a, b],
    before = structuredClone(nodes),
    id = groupSelection(nodes, [a.id, b.id]);
  assert.equal(nodes.length, 3);
  assert.deepEqual(nodes[2].position, [4, 2, 2]);
  assert.equal(a.parent, id);
  const result = ungroupSelection(nodes, [id]);
  assert.equal(result.nodes.length, 2);
  for (let i = 0; i < 2; i++) {
    assert.deepEqual(result.nodes[i].position, before[i].position);
    assert.deepEqual(result.nodes[i].scale, before[i].scale);
  }
  assert.deepEqual(
    result.nodes[0].animation!.frames,
    before[0].animation!.frames,
  );
});
test("0.8: groups reject mixed parents, locked roots, node cap, and animated ungrouping", () => {
  const a = makeNode("box"),
    b = makeNode("box", { parent: "other" });
  assert.throws(() => groupSelection([a, b], [a.id, b.id]), /mesmo nível/);
  a.locked = true;
  assert.throws(() => groupSelection([a], [a.id]), /Desbloqueie/);
  a.locked = false;
  assert.throws(() =>
    groupSelection(
      Array.from({ length: 500 }, () => makeNode("box")),
      [],
    ),
  );
  const g = makeNode("group");
  g.animation = movementClip(g);
  assert.throws(() => ungroupSelection([g], [g.id]), /animação/);
});
test("0.8: alignment and distribution are precise, preserve animation offsets and respect locks", () => {
  const nodes = [0, 1, 10].map((x) => makeNode("box", { position: [x, 0, 0] }));
  nodes[1].animation = movementClip(nodes[1]);
  const ids = nodes.map((n) => n.id);
  distributeSelection(nodes, ids, 0);
  assert.deepEqual(
    nodes.map((n) => n.position[0]),
    [0, 5, 10],
  );
  approx(nodes[1].animation!.frames[0].position[0], 5);
  alignSelection(nodes, ids, 0, "center");
  assert.deepEqual(
    nodes.map((n) => n.position[0]),
    [5, 5, 5],
  );
  nodes[0].locked = true;
  const before = JSON.stringify(nodes);
  assert.throws(() => alignSelection(nodes, ids, 0, "min"), /Desbloqueie/);
  assert.equal(JSON.stringify(nodes), before);
});
test("0.8: translating a selected parent and child only moves the parent once", () => {
  const group = makeNode("group"),
    child = makeNode("box", { parent: group.id });
  const old = structuredClone(child.position);
  translateSelection([group, child], [group.id, child.id], [3, 2, 1]);
  assert.deepEqual(child.position, old);
  assert.deepEqual(group.position, [3, 3, 1]);
  assert.throws(() => translateSelection([group], [group.id], [NaN, 0, 0]));
});
test("0.8: nonuniform sheared transforms cannot be silently destroyed by ungrouping", () => {
  const group = makeNode("group", { scale: [2, 1, 1] }),
    child = makeNode("box", { parent: group.id, rotation: [0, 45, 0] });
  assert.throws(
    () => ungroupSelection([group, child], [group.id]),
    /não uniforme/,
  );
});
test("0.8: history supports falsy values and byte-bounds expensive terrain snapshots", () => {
  const simple = new History(false);
  simple.commit(true);
  assert.equal(simple.undo(), false);
  assert.equal(simple.redo(), true);
  const h = new History({ content: "a".repeat(100) }, 60, 1000);
  for (let i = 0; i < 30; i++) h.commit({ content: String(i).repeat(100) });
  assert.ok(h.bytes <= 1000);
  assert.ok(h.past.length < 10);
  h.undo();
  assert.ok(h.bytes <= 1000);
  h.commit({ content: "new" });
  assert.equal(h.future.length, 0);
});
test("0.8: adaptive resolution lowers GPU work and only slowly raises it after healthy samples", () => {
  const r = new AdaptiveResolution(2);
  assert.equal(r.ratio, 1.5);
  for (let i = 0; i < 20; i++) r.sample(20, "auto");
  assert.equal(r.ratio, 0.65);
  for (let i = 0; i < 5; i++) r.sample(60, "auto");
  assert.equal(r.ratio, 0.65);
  r.sample(60, "auto");
  approx(r.ratio, 0.75);
  assert.equal(r.setMode("high"), 2);
  assert.equal(r.sample(5, "high"), 2);
  assert.equal(r.setMode("economy"), 0.85);
  assert.equal(r.sample(NaN, "auto"), 0.85);
});
test("0.8: malformed local preferences cannot break the responsive grid", () => {
  assert.deepEqual(parsePreferences("{"), preferenceDefaults);
  const p = parsePreferences(
    JSON.stringify({
      leftWidth: 9999,
      rightWidth: -1,
      dockHeight: "bad",
      quality: "ultra",
      explorer: 0,
      translationSnap: 0,
      rotationSnap: 999,
    }),
  );
  assert.equal(p.leftWidth, 360);
  assert.equal(p.rightWidth, 240);
  assert.equal(p.dockHeight, 240);
  assert.equal(p.quality, "auto");
  assert.equal(p.explorer, true);
  assert.equal(p.translationSnap, 0.05);
  assert.equal(p.rotationSnap, 90);
});
test("0.8: unicode project export uses UTF-8 and no deprecated escape/unescape", () => {
  const p = createProject();
  p.name = "Criação · 日本語 · 🚀";
  assert.deepEqual(parseProject(decodeProject(encodeProject(p))), p);
  assert.equal(serializeProject(p, true), JSON.stringify(p, null, 2));
  assert.throws(() => decodeProject("!notbase64!"));
});
test("0.8: serialization falls back to compact JSON instead of producing an unopenable pretty file", () => {
  const p = { content: Array.from({ length: 1_300_000 }, () => 0) } as any;
  const serialized = serializeProject(p, true);
  assert.equal(serialized, JSON.stringify(p));
  assert.throws(
    () => serializeProject({ name: "漢".repeat(2_700_000) } as any),
    /excede 8 MB/,
  );
});
test("0.8: native saves are atomic, retain a .bak, and leave no temporary files", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "gameforge-atomic-")),
    file = path.join(dir, "project.gameforge.json");
  try {
    await atomicWrite(file, "first", true);
    await atomicWrite(file, "second", true);
    assert.equal(await readFile(file, "utf8"), "second");
    assert.equal(await readFile(file + ".bak", "utf8"), "first");
    await atomicWrite(file, "stale", true, () => false);
    assert.equal(await readFile(file, "utf8"), "second");
    atomicWriteSync(file, "final", true);
    assert.equal(await readFile(file, "utf8"), "final");
    assert.equal(await readFile(file + ".bak", "utf8"), "second");
    assert.deepEqual((await readdir(dir)).sort(), [
      "project.gameforge.json",
      "project.gameforge.json.bak",
    ]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("0.8: native reader checks file type and byte limit before exposing content", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "gameforge-read-"));
  try {
    const file = path.join(dir, "project.json");
    await writeFile(file, "{}", "utf8");
    assert.equal(await readProjectFile(file), "{}");
    await assert.rejects(
      readProjectFile(path.join(dir, "project.exe")),
      /Escolha/,
    );
    await writeFile(file, "漢".repeat(2_700_000));
    await assert.rejects(readProjectFile(file), /8 MB/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("0.8: command-line project detection and off-screen window recovery", () => {
  assert.equal(
    projectArgument(["GameForge.exe", "--dev", "map.gameforge.json"]),
    "map.gameforge.json",
  );
  assert.equal(projectArgument(["--evil.json", "main.cjs"]), null);
  const state = validWindowState(
    { x: 8000, y: 8000, width: 9999, height: 20, maximized: true },
    [{ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }],
  );
  assert.equal(state.width, 3840);
  assert.equal(state.height, 420);
  assert.equal(state.x, undefined);
  assert.equal(state.maximized, true);
});

test("0.8: script drafts survive panel switches and cloned node updates, but not an applied-source change", () => {
  const n = makeNode("box"),
    scope = "draft-test";
  const script = {
    language: "javascript" as const,
    enabled: true,
    source: "function start(){}",
  };
  assert.equal(rememberScriptDraft(scope, n, script), true);
  assert.deepEqual(readScriptDraft(scope, structuredClone(n)), {
    script,
    dirty: true,
  });
  assert.equal(readScriptDraft("another-project", n).dirty, false);
  n.script = { ...script, source: "function start(){ engine.log('new'); }" };
  assert.equal(readScriptDraft(scope, n).dirty, false);
  clearScriptDraft(scope, n);
});

test("0.8: transform transactions preflight every node/frame and never leave partial invalid changes", () => {
  const far = [-10000, 10000, 10000].map((x) =>
    makeNode("box", { position: [x, 0, 0] }),
  );
  const original = JSON.stringify(far);
  assert.throws(
    () =>
      groupSelection(
        far,
        far.map((n) => n.id),
      ),
    /limites/,
  );
  assert.equal(JSON.stringify(far), original);
  const g = makeNode("group", { position: [9000, 0, 0] }),
    a = makeNode("box", { parent: g.id, position: [0, 0, 0] }),
    b = makeNode("box", { parent: g.id, position: [2000, 0, 0] });
  const nodes = [g, a, b],
    before = JSON.stringify(nodes);
  assert.throws(() => ungroupSelection(nodes, [g.id]), /limites/);
  assert.equal(JSON.stringify(nodes), before);
  const safe = makeNode("box"),
    edge = makeNode("box", { position: [9999, 0, 0] });
  edge.animation = movementClip(edge);
  const selection = [safe, edge],
    saved = JSON.stringify(selection);
  assert.throws(
    () =>
      translateSelection(
        selection,
        selection.map((n) => n.id),
        [2, 0, 0],
      ),
    /limites/,
  );
  assert.equal(JSON.stringify(selection), saved);
  assert.throws(() => duplicateSelection([edge], [edge.id], 2), /limites/);
  const wide = [-5000, 0, 5000].map((x) =>
    makeNode("box", { position: [x, 0, 0] }),
  );
  alignSelection(
    wide,
    wide.map((n) => n.id),
    0,
    "center",
  );
  assert.deepEqual(
    wide.map((n) => n.position[0]),
    [0, 0, 0],
  );
});
test("0.8: ungrouping preserves full Euler revolutions instead of collapsing a spin to zero", () => {
  const g = makeNode("group", { position: [1, 2, 3] }),
    child = makeNode("box", { parent: g.id });
  child.animation = movementClip(child);
  child.animation.frames[1].rotation = [0, 360, 0];
  const result = ungroupSelection([g, child], [g.id]);
  assert.equal(result.nodes[0].animation!.frames[1].rotation[1], 360);
  const rotated = makeNode("group", { rotation: [0, 90, 0] });
  child.parent = rotated.id;
  const before = JSON.stringify(child);
  assert.throws(
    () => ungroupSelection([rotated, child], [rotated.id]),
    /animação de rotação/,
  );
  assert.equal(JSON.stringify(child), before);
});
test("0.8: async autosave commits cannot race a synchronous shutdown flush", async () => {
  const fs = require("node:fs/promises"),
    originalRename = fs.rename;
  const dir = await mkdtemp(path.join(tmpdir(), "gameforge-commit-")),
    file = path.join(dir, "save.json");
  let asynchronousRenames = 0;
  fs.rename = async (...args: any[]) => {
    asynchronousRenames++;
    return originalRename(...args);
  };
  try {
    await atomicWrite(file, "older");
    assert.equal(
      asynchronousRenames,
      0,
      "The final generation check and rename must be one synchronous commit",
    );
    atomicWriteSync(file, "newest");
    assert.equal(await readFile(file, "utf8"), "newest");
  } finally {
    fs.rename = originalRename;
    await rm(dir, { recursive: true, force: true });
  }
});
