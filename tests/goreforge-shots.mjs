import { launchBrowser } from "./browser-helper.mjs";
import { mkdir } from "node:fs/promises";

/**
 * "Turnê" visual do GORE FORGE: dirige o jogo pelo runtime e salva capturas em
 * test-results/. Serve como preview e como verificação rápida de arte/HUD.
 *
 *   npm run dev
 *   npm run shots:goreforge
 */
await mkdir("test-results", { recursive: true });
const browser = await launchBrowser();
const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
const base = process.env.GAMEFORGE_URL ?? "http://127.0.0.1:5173";
await page.goto(`${base}/goreforge.html`, { waitUntil: "load" });
await page.waitForFunction(() => !!window.goreforge, null, { timeout: 30000 });
await page.screenshot({ path: "test-results/goreforge-01-splash.png" });
await page.locator("#gf-enter").click();
await page.waitForTimeout(1800);
await page.screenshot({ path: "test-results/goreforge-00-patio-limpo.png" });

/* Cenário longe da câmera para a captura mostrar o pátio, não um amontoado. */
await page.evaluate(() => {
  const runtime = window.goreforge;
  runtime.spawner.spawn("jelly-man", { position: runtime.ahead(14, 1.2), scale: 1.6, kind: "prop" });
  runtime.spawner.spawn("jelly-cube", { position: runtime.ahead(11, 2), scale: 1.8, kind: "prop" });
  runtime.spawner.spawn("barrel", { position: runtime.ahead(17, 0.8), scale: 1.3, kind: "prop" });
  runtime.spawner.spawn("crate", { position: runtime.ahead(13, 0.4), scale: 1.4, kind: "prop" });
  runtime.spawner.spawn("glass", { position: runtime.ahead(15, 3.4), scale: 1.4, kind: "prop" });
  runtime.spawner.spawn("ball", { position: runtime.ahead(12, 4), scale: 1.2, kind: "prop" });
  runtime.equip("quebra");
});
await page.waitForTimeout(2600);
await page.screenshot({ path: "test-results/goreforge-02-patio.png" });

/* Tiro de escopeta com desmembramento. */
await page.evaluate(() => {
  const runtime = window.goreforge;
  runtime.combat.triggerDown();
  runtime.combat.triggerUp();
});
await page.waitForTimeout(120);
await page.evaluate(() => {
  const runtime = window.goreforge;
  runtime.combat.triggerDown();
  runtime.combat.triggerUp();
});
await page.waitForTimeout(700);
await page.screenshot({ path: "test-results/goreforge-03-tiro.png" });

/* Explosão em cadeia nos barris (longe o bastante para caber na tela). */
await page.evaluate(() => {
  const runtime = window.goreforge;
  const point = runtime.ahead(17, 1);
  runtime.fx.explosion(point, 7, 2.5);
  runtime.destruction.explode(point, 7, 24, 120, { source: "preview" });
});
await page.waitForTimeout(320);
await page.screenshot({ path: "test-results/goreforge-04-explosao.png" });
await page.waitForTimeout(2600);

/* Menu de spawn e menu de pausa (temas). */
await page.keyboard.press("Tab");
await page.waitForTimeout(500);
await page.screenshot({ path: "test-results/goreforge-05-menu-spawn.png" });
await page.keyboard.press("Tab");
await page.evaluate(() => window.goreforge.setPaused(true));
await page.waitForTimeout(400);
await page.locator('[data-gf-part="pause-backdrop"] button[data-tab="interface"]').click();
await page.waitForTimeout(400);
await page.screenshot({ path: "test-results/goreforge-06-menu-pausa.png" });
await page.locator('[data-gf-part="pause-backdrop"] button[data-gf-id="theme-sangue"]').click().catch(() => {});
await page.waitForTimeout(400);
await page.keyboard.press("Escape");
await page.waitForTimeout(700);
await page.screenshot({ path: "test-results/goreforge-07-tema.png" });

const summary = await page.evaluate(() => ({
  fps: Math.round(window.goreforge.store.fps),
  bodies: window.goreforge.store.bodies,
  rigs: window.goreforge.store.rigs,
  destroyed: window.goreforge.store.destroyed,
  kills: window.goreforge.store.kills,
  theme: window.goreforge.store.theme.id,
}));
console.log("capturas em test-results/", summary);
await browser.close();
