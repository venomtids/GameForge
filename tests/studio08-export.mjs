import { expect } from "@playwright/test";
import { launchBrowser } from "./browser-helper.mjs";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
await mkdir("test-results", { recursive: true });
const browser = await launchBrowser();
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 940 },
    acceptDownloads: true,
  });
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.GAMEFORGE_URL ?? "http://127.0.0.1:5173");
  await expect(page.locator(".viewport canvas")).toBeVisible();
  await page.getByLabel("Configurações do projeto", { exact: true }).click();
  await page
    .getByLabel("Nome do projeto", { exact: true })
    .fill("Aurora · criação 日本語 🚀");
  await page.getByRole("button", { name: "Concluir", exact: true }).click();
  await expect(page.locator(".project-identity strong")).toHaveText(
    "Aurora · criação 日本語 🚀",
  );
  const [projectFile] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /^Salvar/ }).click(),
  ]);
  await projectFile.saveAs("test-results/studio08-export.gameforge.json");
  const p = JSON.parse(
    await readFile("test-results/studio08-export.gameforge.json", "utf8"),
  );
  assert.equal(p.name, "Aurora · criação 日本語 🚀");
  assert.ok(p.scenes[0].nodes.some((n) => n.animation));
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Exportar jogo", exact: true }).click(),
  ]);
  const htmlPath = path.resolve("test-results/studio08-export.html");
  await download.saveAs(htmlPath);
  const html = await readFile(htmlPath, "utf8");
  assert.ok(!html.includes("__GAMEFORGE_PROJECT_DATA__"));
  assert.ok(!/<script[^>]+src=/.test(html));
  console.log(
    "PASS real JSON/HTML downloads, UTF-8 and self-contained runtime",
  );

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
  await expect(game.locator("canvas")).toBeVisible();
  await expect(game).toHaveTitle("Aurora · criação 日本語 🚀");
  await expect(game.locator(".touch-game-controls")).toBeVisible();
  await game.getByRole("button", { name: "Pular", exact: true }).tap();
  await game
    .getByRole("button", { name: "Mover para frente", exact: true })
    .tap();
  await game.waitForTimeout(300);
  assert.ok(
    !(await game
      .locator("#event")
      .textContent()
      .then((text) => text.includes("Não foi possível carregar"))),
  );
  assert.equal(
    await game.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await game.screenshot({ path: "test-results/studio08-offline-mobile.png" });
  await game.keyboard.press("Escape");
  await expect(game.locator("#overlay")).toBeVisible();
  await expect(game.locator(".touch-game-controls")).not.toBeVisible();
  await game.getByRole("button", { name: "Continuar", exact: true }).tap();
  await expect(game.locator(".touch-game-controls")).toBeVisible();
  await game.getByRole("button", { name: "Reiniciar", exact: true }).tap();
  await expect(game.locator("canvas")).toBeVisible();
  assert.deepEqual(requests, []);
  assert.deepEqual(errors, []);
  console.log(
    "PASS offline file:// playback without HTTP requests, mobile touch, pause/resume/restart",
  );
  console.log("ALL STUDIO 0.8 EXPORT TESTS PASSED");
} finally {
  await browser.close();
}
