import { launchBrowser } from "./browser-helper.mjs";
import { mkdir, stat } from "node:fs/promises";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

/**
 * Verifica o GORE FORGE como ARQUIVO ÚNICO OFFLINE.
 *
 * Gera o build (`npx vite build --config vite.goreforge.config.ts`) e abre
 * `entregas/goreforge.html` por file:// — sem servidor — conferindo que a
 * física, o gore e o HUD funcionam exatamente como no dev server.
 *
 *   npm run test:export:goreforge
 */
const file = path.resolve("entregas/goreforge.html");
const info = await stat(file).catch(() => null);
assert.ok(info, "entregas/goreforge.html não existe: rode `npm run build:goreforge` antes");
assert.ok(info.size > 300_000, `arquivo suspeito de pequeno: ${info.size} bytes`);
const html = await (await import("node:fs/promises")).readFile(file, "utf8");
assert.ok(!/src="\/src\//.test(html), "o build ainda aponta para módulos do servidor");
assert.ok(!/href="\.\/assets\//.test(html), "o build deixou CSS/JS externos");

await mkdir("test-results", { recursive: true });
const browser = await launchBrowser();
const context = await browser.newContext({ viewport: { width: 1440, height: 860 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() !== "error") return;
  const text = message.text();
  if (/favicon|Failed to load resource|swiftshader|GPU stall/i.test(text)) return;
  errors.push(text);
});

try {
  await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.goreforge, null, { timeout: 30000 });
  await page.locator("#gf-enter").click();
  await page.waitForTimeout(1200);

  const running = await page.evaluate(() => ({
    bodies: window.goreforge.world.bodies.size,
    configs: window.goreforge.world.configs.length,
    jellies: window.goreforge.world.jellyCharacters.size,
    rigs: window.goreforge.world.physicalRigs.size,
    zone: window.goreforge.store.zoneName,
    time: window.goreforge.ctx.time,
  }));
  assert.ok(running.bodies > 20, `offline sem física: ${running.bodies} corpos`);
  assert.ok(running.configs > 60, `cena incompleta offline: ${running.configs} nós`);
  assert.ok(running.rigs >= 6 && running.jellies >= 1, "gelatina/ragdolls ausentes no arquivo único");
  console.log(
    `PASS offline: ${running.bodies} corpos, ${running.configs} nós, ${running.rigs} rigs elásticos, ${running.jellies} NPCs de gelatina`,
  );

  /* Armamento + criação de corpos, tudo dentro do arquivo único. */
  const shot = await page.evaluate(async () => {
    const runtime = window.goreforge;
    runtime.equip("quebra");
    runtime.combat.triggerDown();
    runtime.combat.triggerUp();
    const bodiesBefore = runtime.world.bodies.size;
    const ids = runtime.spawner.spawn("crate", { position: runtime.ahead(8, 1), kind: "prop" });
    await new Promise((resolve) => setTimeout(resolve, 700));
    return {
      shots: runtime.store.shots,
      weapon: runtime.store.weapon,
      ids: ids.length,
      bodies: runtime.world.bodies.size - bodiesBefore,
      particles: runtime.fx.particleCount,
    };
  });
  assert.ok(shot.shots > 0, "o tiro não registrou disparo no arquivo único");
  assert.equal(shot.weapon, "quebra");
  assert.ok(shot.ids > 0 && shot.bodies > 0, "o spawner não criou corpos no arquivo único");
  console.log(`PASS offline: tiro e spawn funcionando (${shot.shots} tiros, ${shot.ids} corpos criados)`);

  /* Destruição (fratura) e HUD. */
  const destruction = await page.evaluate(async () => {
    const runtime = window.goreforge;
    const origin = runtime.ahead(9, 1);
    const [id] = runtime.spawner.spawn("barrel", { position: origin, kind: "prop" });
    runtime.destruction.track(id, {
      hp: 30,
      material: "explosivo",
      chunks: 8,
      explosive: { radius: 6, force: 18, damage: 90 },
    });
    const bodiesBefore = runtime.world.bodies.size;
    runtime.destruction.damage(id, 500, { point: origin, direction: runtime.point(0, 1, 0) });
    await new Promise((resolve) => setTimeout(resolve, 800));
    return {
      removed: !runtime.world.bodies.has(id),
      shards: runtime.world.bodies.size - bodiesBefore,
      decals: runtime.decals.count,
    };
  });
  assert.ok(destruction.removed && destruction.shards > 0, "fratura não gerou estilhaços offline");
  console.log(`PASS offline: barril fraturou em ${destruction.shards} estilhaços`);

  const hud = await page.evaluate(() => ({
    ammo: document.querySelector('[data-gf-id="hud-ammo-count"]')?.textContent?.trim() ?? "",
    slots: document.querySelectorAll('[data-gf-id^="hud-slot-"]').length,
    accent: getComputedStyle(document.querySelector(".gf-ui")).getPropertyValue("--gf-accent").trim(),
  }));
  assert.ok(hud.ammo.length > 0 && hud.slots >= 6 && hud.accent.startsWith("#"), "HUD/tema incompletos offline");
  await page.screenshot({ path: "test-results/goreforge-offline.png" });

  assert.deepEqual(errors, [], `erros de página no arquivo único: ${errors.join(" | ")}`);
  console.log("PASS GORE FORGE arquivo único offline");
} finally {
  await browser.close();
}
