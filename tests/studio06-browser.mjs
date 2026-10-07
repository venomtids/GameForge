import { launchBrowser } from "./browser-helper.mjs";
import fs from "node:fs/promises";
import { expect } from "@playwright/test";
const browser = await launchBrowser({
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1060 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const saved = async () => {
  await page.waitForTimeout(700);
  await expect(
    page.getByText("Salvo neste dispositivo", { exact: true }),
  ).toBeVisible();
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("gameforge.project.v6")),
  );
};
try {
  const seed = JSON.parse(
    await fs.readFile(
      "examples/laboratorio06/Laboratorio-0.6.gameforge.json",
      "utf8",
    ),
  );
  const original = seed.scenes[0].nodes.find((n) => n.id === "jogador");
  original.id = "original";
  original.name = "Jogador antigo";
  original.position = [8, 2, 8];
  original.actor.humanoid = false;
  seed.scenes[0].nodes = [original];
  seed.settings.playerId = "original";
  await page.addInitScript((p) => {
    if (!localStorage.getItem("gameforge.project.v6"))
      localStorage.setItem("gameforge.project.v6", JSON.stringify(p));
  }, seed);
  await page.goto("http://127.0.0.1:5173");
  await page.getByRole("button", { name: "Toolbox", exact: true }).click();
  await page
    .getByLabel("Categoria do Toolbox")
    .selectOption("Personagens e física");
  await expect(page.locator(".toolbox-panel")).toContainText(/\d+ modelos/);
  await page
    .getByRole("button", { name: /Jogador articulado · opção 2/ })
    .click();
  await page.waitForTimeout(800);
  let p = await saved();
  const actor = p.scenes[0].nodes.find((n) => n.actor.humanoid);
  if (
    !actor ||
    p.settings.playerId !== actor.id ||
    !p.scenes[0].nodes.some((n) => n.id === "original")
  )
    throw Error("Second Toolbox player did not preserve first");
  await page.getByRole("button", { name: /Bot · patrulha/ }).click();
  await page.getByLabel("Comportamento do bot").selectOption("attack");
  await page.getByLabel("Dano por ataque").fill("12");
  await page.waitForTimeout(650);
  p = await saved();
  if (p.scenes[0].nodes.at(-1).actor.damage !== 12)
    throw Error("Bot inspector");
  await page.getByRole("button", { name: "Mundo", exact: true }).click();
  await page.getByLabel("Filtro de sombras").selectOption("vsm");
  await page.getByLabel("Desfoque VSM").fill("5");
  await page.getByLabel("Resolução de sombras").selectOption("1024");
  await page.getByLabel("Cobertura (m)").fill("35");
  await page.waitForTimeout(650);
  p = await saved();
  if (p.settings.shadows.softness !== 5 || p.settings.shadows.coverage !== 35)
    throw Error("Shadows persist");
  await page.screenshot({ path: "test-results/studio06-shadows.png" });
  await page.getByLabel("Vista da câmera").selectOption("top");
  await page.getByRole("button", { name: "Terreno", exact: true }).click();
  await page.getByLabel("Formato do terreno").selectOption("flat");
  await page.getByLabel("Resolução do terreno").selectOption("65");
  await page
    .getByRole("button", { name: "Criar terreno", exact: true })
    .click();
  await page.getByLabel("Raio", { exact: true }).fill("5");
  await page.keyboard.press("Tab");
  await page.waitForTimeout(750);
  p = await saved();
  const terrain = p.scenes[0].nodes.find((n) => n.surface);
  if (terrain.surface.resolution !== 65) throw Error("Terrain generation");
  const canvas = page.locator(".viewport canvas"),
    rect = await canvas.boundingBox();
  await page.mouse.move(
    rect.x + rect.width * 0.42,
    rect.y + rect.height * 0.45,
  );
  await page.mouse.down();
  await page.mouse.move(
    rect.x + rect.width * 0.62,
    rect.y + rect.height * 0.52,
    { steps: 14 },
  );
  await page.mouse.up();
  await page.waitForTimeout(850);
  let sculpted = await saved();
  if (
    !sculpted.scenes[0].nodes
      .find((n) => n.id === terrain.id)
      .surface.heights.some((h) => h > 0)
  )
    throw Error("Continuous terrain stroke");
  await page.screenshot({ path: "test-results/studio06-terrain.png" });
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(750);
  p = await saved();
  if (
    p.scenes[0].nodes
      .find((n) => n.id === terrain.id)
      .surface.heights.some((h) => h !== 0)
  )
    throw Error("Stroke must be ONE undo");
  await page.keyboard.press("Control+Shift+z");
  await page.waitForTimeout(750);
  // Actual worker + Cannon + avatar viewmodel integration, independent of editor's scene.
  const runtime = await page.evaluate(async () => {
    const THREE = await import("/node_modules/.vite/deps/three.js"),
      { World, addLighting } = await import("/src/engine/World.ts"),
      { createProject, makeNode } = await import("/src/engine/model.ts"),
      { prefab06 } = await import("/src/engine/prefabs06.ts"),
      { ScriptHost } = await import("/src/engine/Scripts.ts"),
      { CameraRig } = await import("/src/engine/CameraRig.ts"),
      { configureLighting } = await import("/src/engine/Lighting.ts");
    const p = createProject(),
      player = prefab06("humanoidPlayer")[0];
    player.id = "player";
    player.position = [0, 2, 5];
    const j = prefab06("jelly")[0];
    j.position = [-4, 3, 0];
    const rag = prefab06("botPatrol")[0];
    rag.id = "rag";
    rag.actor.bot = "off";
    rag.position = [5, 2, 0];
    const js = makeNode("box", {
      id: "js",
      position: [0, 1, 0],
      script: {
        enabled: true,
        language: "javascript",
        source:
          'let done=false;function start(){engine.walk(self.id,1,0,2);engine.damage(self.id,10);engine.log("JS06 ready");}function update(dt,time,input){if(time>.4&&!done){engine.stop(self.id);engine.ragdoll("rag",true);done=true;}}',
      },
    });
    const lua = makeNode("box", {
      id: "lua",
      position: [-2, 1, 0],
      script: {
        enabled: true,
        language: "lua",
        source:
          'function start() engine.rotate(self.id,90) engine.damage(self.id,5) engine.log("LUA06 ready "..self.id) end\nfunction update(dt,time,input) end',
      },
    });
    p.scenes[0].nodes = [
      makeNode("box", {
        physics: "static",
        position: [0, -0.5, 0],
        scale: [30, 1, 30],
      }),
      player,
      j,
      rag,
      js,
      lua,
    ];
    p.settings.playerId = player.id;
    const scene = new THREE.Scene(),
      unlight = addLighting(scene),
      world = new World(scene);
    world.load(p.scenes[0], p.settings, true);
    const logs = [],
      host = new ScriptHost(world, (s) => logs.push(s));
    host.start();
    for (let i = 0; i < 40; i++) {
      host.update(0.04, new Set());
      world.update(0.04, new Set(), 0);
      await new Promise((r) => setTimeout(r, 40));
    }
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(400, 300);
    const rig = new CameraRig(renderer.domElement);
    rig.set("first");
    rig.playing = true;
    rig.update(world, 0.016);
    configureLighting(scene, renderer, p.settings, new THREE.Vector3());
    renderer.render(scene, rig.camera);
    const arms =
      rig.arms.visible &&
      rig.arms.children.length === 2 &&
      !world.objects.get(player.id).visible;
    rig.set("third");
    rig.update(world, 0.016);
    const third = world.objects.get(player.id).visible && !rig.arms.visible;
    const result = {
      logs,
      jsX: world.objects.get("js").position.x,
      luaRotation: world.objects.get("lua").rotation.y,
      health: [world.health.get("js"), world.health.get("lua")],
      rag: world.physicalRigs.has("rag"),
      arms,
      third,
      calls: renderer.info.render.calls,
    };
    host.stop();
    rig.dispose();
    world.dispose();
    unlight();
    renderer.dispose();
    return result;
  });
  if (
    !runtime.arms ||
    !runtime.third ||
    runtime.jsX < 0.1 ||
    runtime.luaRotation < 0.5 ||
    runtime.health.join(",") !== "90,95" ||
    !runtime.rag ||
    runtime.logs.some((s) => /erro|interrompido|error/i.test(s))
  )
    throw Error("Runtime integration " + JSON.stringify(runtime));
  console.log(
    "PASS workers JS/Lua, viewmodel/third body, rigs, commands",
    runtime,
  );
  if (errors.length) throw Error(errors.join("\n"));
  console.log(
    "PASS 0.6 browser: Toolbox, bot inspector, shadows, terrain65 drag and one-stroke undo",
  );
} catch (e) {
  await page.screenshot({ path: "test-results/studio06-error.png" });
  throw e;
} finally {
  await browser.close();
}
