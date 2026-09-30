import { expect } from "@playwright/test";
import { launchBrowser } from "./browser-helper.mjs";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
await mkdir("test-results", { recursive: true });
const browser = await launchBrowser();
const context = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  acceptDownloads: true,
});
const page = await context.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("dialog", (dialog) => dialog.accept());
const saved = async () => {
  await page.waitForTimeout(800);
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("gameforge.project.v6")),
  );
};
const newJelly = async () => {
  await page.getByRole("button", { name: "Novo", exact: true }).click();
  await page.getByRole("button", { name: /^Jelly Jump/ }).click();
  await expect(page.locator(".project-identity strong")).toHaveText(
    "Jelly Jump · Parkour de gelatina",
  );
  await page.waitForFunction(() => {
    const p = JSON.parse(localStorage.getItem("gameforge.project.v6"));
    return (
      p?.settings.playerId === "jelly-player" && p.scenes[0].nodes.length === 44
    );
  });
};
try {
  await page.goto(process.env.GAMEFORGE_URL ?? "http://127.0.0.1:5173");
  await expect(page.locator(".viewport canvas")).toBeVisible();
  await newJelly();
  let p = await saved();
  assert.equal(p.settings.playerId, "jelly-player");
  assert.equal(
    p.scenes[0].nodes.filter(
      (n) => n.physics === "static" && n.deform.type === "jelly",
    ).length,
    11,
  );
  await page.keyboard.press("Control+n");
  await expect(page.locator(".template-card")).toHaveCount(7);
  await expect(
    page.locator(".template-card").filter({ hasText: "Jelly Jump" }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/jelly-library.png" });
  await page.getByLabel("Fechar biblioteca", { exact: true }).click();
  await page.getByRole("button", { name: "Toolbox", exact: true }).click();
  await page.getByLabel("Buscar no Toolbox", { exact: true }).fill("gelatina");
  await expect(page.locator(".toolbox-panel > div > button")).toHaveCount(3);
  await page
    .getByRole("button", { name: /Jogador de gelatina · articulado e jogável/ })
    .click();
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("gameforge.project.v6"))?.settings
        .playerId !== "jelly-player",
  );
  p = await saved();
  const player = p.scenes[0].nodes.find((n) => n.id === p.settings.playerId);
  assert.notEqual(player.id, "jelly-player");
  assert.equal(player.deform.type, "jelly");
  assert.equal(player.actor.humanoid, true);
  assert.ok(p.scenes[0].nodes.some((n) => n.id === "jelly-player"));
  await expect(
    page.getByRole("button", { name: "Jogador principal", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Recuperação de volume", { exact: true }).fill("0.9");
  await page.getByLabel("Limite de esticamento", { exact: true }).fill("1.5");
  await page.waitForFunction(() => {
    const p = JSON.parse(localStorage.getItem("gameforge.project.v6")),
      n = p.scenes[0].nodes.find((n) => n.id === p.settings.playerId);
    return n.deform.volume === 0.9 && n.deform.maxStretch === 1.5;
  });
  p = await saved();
  assert.equal(
    p.scenes[0].nodes.find((n) => n.id === player.id).deform.volume,
    0.9,
  );
  assert.equal(
    p.scenes[0].nodes.find((n) => n.id === player.id).deform.maxStretch,
    1.5,
  );
  await page.screenshot({ path: "test-results/jelly-toolbox.png" });
  console.log(
    "PASS searchable jelly Toolbox, primary player without deleting the original, inspector parameters",
  );

  await newJelly();
  const before = JSON.stringify((await saved()).scenes[0].nodes);
  await page.keyboard.press("F5");
  await expect(page.locator(".play-border")).toBeVisible();
  await expect(page.locator(".runtime-hud")).toContainText("Cristais 0 / 5");
  await page.keyboard.down("w");
  await page.waitForTimeout(250);
  await page.keyboard.up("w");
  await page.keyboard.press("Space");
  await page.waitForTimeout(400);
  await expect(page.locator(".runtime-hud")).toContainText("Vida: 100");
  await page.waitForTimeout(700);
  await page.screenshot({ path: "test-results/jelly-play.png" });
  await page.keyboard.press("r");
  await expect(page.locator(".runtime-hud")).toContainText("1 quedas");
  await page.keyboard.press("F8");
  await expect(page.locator(".play-border")).not.toBeVisible();
  assert.equal(JSON.stringify((await saved()).scenes[0].nodes), before);
  console.log(
    "PASS real editor play/input/jump/R/stop and authored scene restoration",
  );

  // Use the actual dev engine modules; no test hooks are shipped in production.
  const camera = await page.evaluate(async () => {
    const [{ World }, { CameraRig }, { jellyParkourProject }, THREE] =
      await Promise.all([
        import("/src/engine/World.ts"),
        import("/src/engine/CameraRig.ts"),
        import("/src/engine/jelly-parkour.ts"),
        import("/node_modules/.vite/deps/three.js"),
      ]);
    const p = jellyParkourProject(),
      w = new World(new THREE.Scene());
    w.load(p.scenes[0], p.settings, true);
    const canvas = document.createElement("canvas");
    document.body.append(canvas);
    const rig = new CameraRig(canvas);
    rig.configure(p.settings);
    rig.playing = true;
    for (let i = 0; i < 120; i++) w.update(1 / 120, new Set());
    rig.set("third");
    rig.update(w, 1 / 60);
    const third = w.objects.get(w.playerId).visible;
    rig.set("first");
    rig.update(w, 1 / 60);
    const firstHidden = !w.objects.get(w.playerId).visible,
      firstArms = rig.arms.visible;
    const hand = rig.arms.userData.direita.mao.material;
    const gelHand = hand.transparent && hand.color.getHexString() === "9cf5d2";
    w.damage(w.playerId, 100);
    rig.update(w, 1 / 60);
    const deadArmsHidden = !rig.arms.visible;
    w.respawn();
    rig.set("third");
    rig.update(w, 1 / 60);
    const respawnVisible =
      w.objects.get(w.playerId).visible && w.jellyCharacters.has(w.playerId);
    rig.dispose();
    w.dispose();
    canvas.remove();
    return {
      third,
      firstHidden,
      firstArms,
      gelHand,
      deadArmsHidden,
      respawnVisible,
    };
  });
  assert.ok(Object.values(camera).every(Boolean), JSON.stringify(camera));
  console.log(
    "PASS first/third-person gelatin visibility, matching FPS hands and ragdoll/respawn camera",
  );

  const [jsonDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /^Salvar/ }).click(),
  ]);
  await jsonDownload.saveAs("test-results/Jelly-Jump-Gelatina.gameforge.json");
  const [htmlDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Exportar jogo", exact: true }).click(),
  ]);
  const htmlPath = path.resolve("test-results/Jelly-Jump-Gelatina.html");
  await htmlDownload.saveAs(htmlPath);
  const html = await readFile(htmlPath, "utf8");
  assert.ok(!html.includes("__GAMEFORGE_PROJECT_DATA__"));
  assert.ok(!/<script[^>]+src=/.test(html));
  const offline = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    offline: true,
  });
  const game = await offline.newPage(),
    requests = [];
  game.on("pageerror", (e) => errors.push(e.message));
  game.on("request", (r) => {
    if (/^https?:/.test(r.url())) requests.push(r.url());
  });
  await game.goto(pathToFileURL(htmlPath).href);
  await expect(game).toHaveTitle("Jelly Jump · Parkour de gelatina");
  await expect(game.locator(".touch-game-controls")).toBeVisible();
  await game.waitForTimeout(700);
  await game.getByRole("button", { name: "Pular", exact: true }).tap();
  await game.waitForTimeout(2000);
  // Software WebGL may present its first compiled frame only after resize.
  await game.setViewportSize({ width: 391, height: 844 });
  await game.setViewportSize({ width: 390, height: 844 });
  await game.waitForTimeout(700);
  await game.screenshot({ path: "test-results/jelly-offline-mobile.png" });
  await game
    .getByRole("button", { name: "Retornar ao checkpoint", exact: true })
    .tap();
  await expect(game.locator("#score")).toContainText("1 quedas");
  await game.keyboard.press("Escape");
  await expect(game.locator("#overlay")).toBeVisible();
  await game.getByRole("button", { name: "Continuar", exact: true }).tap();
  await expect(game.locator(".touch-game-controls")).toBeVisible();
  await game.getByRole("button", { name: "Reiniciar", exact: true }).tap();
  await expect(game.locator("canvas")).toBeVisible();
  assert.equal(
    await game.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  assert.deepEqual(requests, []);
  assert.deepEqual(errors, []);
  console.log(
    "PASS real JSON/HTML downloads, offline file:// jelly runtime, 390px touch and pause/restart",
  );
  console.log("ALL JELLY BROWSER/EXPORT TESTS PASSED");
} catch (error) {
  await page.screenshot({ path: "test-results/jelly-failure.png" });
  throw error;
} finally {
  await browser.close();
}
