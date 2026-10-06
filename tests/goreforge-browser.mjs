import { expect } from "@playwright/test";
import { launchBrowser } from "./browser-helper.mjs";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";

/**
 * Teste de navegador do GORE FORGE.
 *
 * Verifica o que só existe em execução real: física rodando (Cannon-es +
 * gelatina), criação de corpos pelo menu de spawn, fratura de props pela camada
 * de destruição, tiro de arma de verdade e a troca de tema pela UI de dados.
 *
 *   npm run dev            # em outro terminal
 *   npm run test:goreforge
 */
await mkdir("test-results", { recursive: true });
const browser = await launchBrowser();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() !== "error") return;
  const text = message.text();
  // Ruído de rede/WebGL do ambiente headless não é falha do jogo.
  if (/favicon|Failed to load resource|swiftshader|GPU stall/i.test(text)) return;
  errors.push(text);
});
const base = process.env.GAMEFORGE_URL ?? "http://127.0.0.1:5173";

const state = () =>
  page.evaluate(() => {
    const runtime = window.goreforge;
    return {
      fps: runtime.store.fps,
      bodies: runtime.world.bodies.size,
      configurations: runtime.world.configs.length,
      jellies: runtime.world.jellyCharacters.size,
      rigs: runtime.world.physicalRigs.size,
      spawned: runtime.store.spawnedNow,
      destroyed: runtime.store.destroyed,
      shots: runtime.store.shots,
      particles: runtime.fx.particleCount,
      decals: runtime.decals.count,
      weapon: runtime.store.weapon,
      theme: runtime.store.theme.id,
      hp: runtime.store.health,
      zone: runtime.store.zoneName,
      paused: runtime.ctx.paused,
      menuOpen: runtime.ctx.menuOpen,
      time: runtime.ctx.time,
    };
  });

try {
  await page.goto(`${base}/goreforge.html`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.goreforge, null, { timeout: 30000 });
  await expect(page.locator("canvas")).toBeVisible();

  /* ---------------------------------------------------------- splash ----- */
  await expect(page.locator(".gf-boot-card h1")).toHaveText(/gore forge/i);
  await expect(page.locator("#gf-enter")).toBeVisible();
  await page.locator("#gf-enter").click();
  await page.waitForTimeout(700);
  assert.equal(await page.locator("#goreforge-boot").count(), 0, "splash deveria desaparecer depois do clique");
  await page.waitForTimeout(600);

  const start = await state();
  assert.ok(start.fps > 5, `fps baixo no início: ${start.fps}`);
  assert.ok(start.bodies > 20, `pátio deveria ter corpos dinâmicos: ${start.bodies}`);
  assert.ok(start.configurations > 60, `cena deveria ter os nós do pátio: ${start.configurations}`);
  assert.ok(start.jellies >= 1, "o pátio tem corpos de gelatina");
  assert.ok(start.time > 0.5, "o tempo de simulação deveria avançar");
  assert.ok(start.zone.length > 0, "o HUD deveria informar a zona atual");
  console.log("PASS boot, física rodando e zona detectada");

  /* ------------------------------------------------------------ HUD ----- */
  await expect(page.locator('[data-gf-id="hud-vitals"]')).toBeVisible();
  const hud = await page.evaluate(() => {
    const ammo = document.querySelector('[data-gf-id="hud-ammo-count"]');
    const slots = document.querySelectorAll('[data-gf-id^="hud-slot-"]');
    return { ammo: ammo?.textContent?.trim() ?? "", slots: slots.length };
  });
  assert.ok(/\d+\s*\/\s*\d+|∞/.test(hud.ammo), `HUD sem munição: "${hud.ammo}"`);
  assert.ok(hud.slots >= 6, `HUD deveria ter os slots rápidos: ${hud.slots}`);

  /* O HUD é escrito por `bind` — precisa refletir o estado a cada quadro. */
  const targetMag = await page.evaluate(() => {
    const runtime = window.goreforge;
    const state = runtime.store.ammoOf();
    state.mag = Math.max(1, state.mag - 7);
    return state.mag;
  });
  await page.waitForFunction(
    (mag) =>
      document.querySelector('[data-gf-id="hud-ammo-count"]')?.textContent?.trim().startsWith(String(mag)),
    targetMag,
    { timeout: 8000 },
  );
  await page.waitForFunction(
    () => /[1-9]\d* corpos/.test([...document.querySelectorAll('[data-gf-id^="hud-diag"]')].map((e) => e.textContent).join(" ")),
    null,
    { timeout: 8000 },
  );
  const liveHud = await page.evaluate(() => ({
    ammo: document.querySelector('[data-gf-id="hud-ammo-count"]')?.textContent?.trim() ?? "",
    diag: [...document.querySelectorAll('[data-gf-id^="hud-diag"]')].map((e) => e.textContent).join(" | "),
    hp: document.querySelector('[data-gf-id="hud-hp-bar"]')?.textContent ?? "",
  }));
  console.log(`PASS HUD montado por dados (munição ${liveHud.ammo}, ${liveHud.diag.split(" | ")[0]})`);

  /* --------------------------------------------------- armas e tiro ----- */
  await page.evaluate(() => {
    const runtime = window.goreforge;
    runtime.equip("ferrolho");
    runtime.combat.triggerDown();
  });
  await page.waitForTimeout(400);
  const shot = await state();
  assert.ok(shot.shots > 0, "o tiro deveria registrar disparos");
  assert.equal(shot.weapon, "ferrolho");
  console.log(`PASS arma disparou (${shot.shots} tiros)`);

  /* ------------------- dano da engine → vida do jogo (bots/explosões) --- */
  await page.evaluate(() => {
    const runtime = window.goreforge;
    runtime.store.health = 100;
    runtime.store.armor = 0;
    runtime.store.damageTaken = 0;
    /* É exatamente o que um NPC com behavior "attack" faz na engine. */
    runtime.world.damage(runtime.world.playerId, 24, "gf-teste");
  });
  await page.waitForFunction(() => window.goreforge.store.damageTaken >= 20, null, { timeout: 30000 });
  const bridge = await page.evaluate(() => ({
    hp: window.goreforge.store.health,
    engine: window.goreforge.world.health.get(window.goreforge.world.playerId),
    taken: window.goreforge.store.damageTaken,
    indicator: window.goreforge.store.hitDirection.life > 0,
  }));
  assert.ok(bridge.hp <= 80 && bridge.hp > 0, `ataque de NPC deveria tirar vida: ${bridge.hp}`);
  assert.equal(bridge.engine, bridge.hp, "a vida do jogo e a da engine devem ficar iguais");
  console.log(`PASS dano da engine convertido (100 → ${bridge.hp} de vida, ${bridge.taken} recebido)`);

  /* ------------------------------------------------- menu de spawn ------- */
  const backdrop = page.locator('[data-gf-part="spawn-backdrop"]');
  const cardCount = () => page.locator('[data-gf-part="spawn-backdrop"] button[data-item]').count();
  await page.keyboard.press("Tab");
  await expect(backdrop).toBeVisible();
  const firstCategory = await cardCount();
  assert.ok(firstCategory >= 3, `categoria inicial deveria listar itens: ${firstCategory}`);

  await page.locator('[data-gf-part="spawn-backdrop"] button[data-tab="Armas"]').click();
  await page.waitForTimeout(200);
  const weapons = await cardCount();
  assert.ok(weapons >= 6, `aba de armas deveria listar o arsenal: ${weapons}`);

  await page.locator('[data-gf-part="spawn-backdrop"] button[data-tab="Caixas e blocos"]').click();
  await page.waitForTimeout(200);
  const crates = await cardCount();
  assert.ok(crates >= 4, `aba de caixas deveria listar props: ${crates}`);

  const search = page.locator('[data-gf-part="spawn-backdrop"] input[type="search"]');
  await search.fill("explosivo");
  await page.waitForTimeout(250);
  const searched = await cardCount();
  assert.ok(searched >= 2 && searched < crates + weapons, `busca por tag deveria filtrar: ${searched}`);
  await search.fill("");
  await page.waitForTimeout(200);
  await page.screenshot({ path: "test-results/goreforge-menu-spawn.png" });

  const before = await state();
  const card = page.locator('[data-gf-part="spawn-backdrop"] button[data-item="crate"]');
  if (await card.count()) await card.first().click();
  else await page.locator('[data-gf-part="spawn-backdrop"] button[data-item]').first().click();
  await page.waitForTimeout(500);
  await page.keyboard.press("Tab");
  const afterMenu = await state();
  assert.ok(afterMenu.spawned > before.spawned, "clicar no card deveria criar corpos");
  console.log(`PASS menu de spawn criou ${afterMenu.spawned - before.spawned} corpos`);

  /* ------------------- gelatina: física elástica e deformação da malha --- */
  const jelly = await page.evaluate(async () => {
    const runtime = window.goreforge;
    /* 1) prop de gelatina do pátio: rig elástico (JellyCage) + malha deformada */
    const propId =
      [...runtime.world.physicalRigs.keys()].find((id) => runtime.world.physicalRigs.get(id).jelly) ??
      "gf-jelly-a";
    const rig = runtime.world.physicalRigs.get(propId);
    const mesh = rig?.meshes?.[0];
    const initial = mesh ? Array.from(mesh.geometry.attributes.position.array.slice(0, 90)) : [];
    const propBody = runtime.world.bodies.get(propId);
    if (propBody) {
      propBody.velocity.set(4, 10, 1);
      propBody.wakeUp();
    }
    /* 2) NPC de gelatina: corpo macio de verdade (JellyCharacter) */
    const character =
      runtime.world.jellyCharacters.get("gf-bot-jelly-1") ??
      [...runtime.world.jellyCharacters.values()][0];
    const charBody = character ? runtime.world.bodies.get(character.node.id) : null;
    if (charBody) {
      charBody.velocity.set(0, 12, 0);
      charBody.wakeUp();
    }
    const squash = [];
    for (let index = 0; index < 45; index++) {
      await new Promise((resolve) => setTimeout(resolve, 45));
      if (character) squash.push(character.deformation);
    }
    const current = mesh ? Array.from(mesh.geometry.attributes.position.array.slice(0, 90)) : [];
    return {
      propId,
      hasCage: !!rig?.jelly,
      surfaces: rig?.meshes?.length ?? 0,
      vertexMoved: initial.length
        ? initial.reduce((max, value, index) => Math.max(max, Math.abs(value - current[index])), 0)
        : -1,
      deformMin: squash.length ? Math.min(...squash) : 1,
      deformMax: squash.length ? Math.max(...squash) : 1,
      rigs: runtime.world.physicalRigs.size + runtime.world.jellyCharacters.size,
    };
  });
  assert.ok(jelly.hasCage, "prop de gelatina deveria ter JellyCage (malha de molas)");
  assert.ok(
    jelly.vertexMoved > 1e-3,
    `a malha de gelatina deveria deformar nos vértices (${jelly.vertexMoved})`,
  );
  assert.ok(
    jelly.deformMax - jelly.deformMin > 0.005,
    `o personagem de gelatina deveria amassar/esticar (${jelly.deformMin} … ${jelly.deformMax})`,
  );
  console.log(
    `PASS gelatina: ${jelly.propId} com ${jelly.surfaces} malha(s), vértices movidos ${jelly.vertexMoved.toFixed(4)} m, deformação ${jelly.deformMin.toFixed(3)}–${jelly.deformMax.toFixed(3)}`,
  );

  /* -------------------------------------------- destruição de props ------ */
  const destruction = await page.evaluate(async () => {
    const runtime = window.goreforge;
    const origin = runtime.ahead(9, 1);
    const ids = runtime.spawner.spawn("barrel", { position: origin, kind: "prop" });
    const id = ids[0];
    runtime.destruction.track(id, { hp: 30, material: "explosivo", chunks: 8, explosive: { radius: 6, force: 18, damage: 90 } });
    const bodiesBefore = runtime.world.bodies.size;
    const destroyedBefore = runtime.store.destroyed;
    runtime.destruction.damage(id, 500, { point: origin, direction: runtime.point(0, 1, 0) });
    await new Promise((resolve) => setTimeout(resolve, 700));
    return {
      id,
      stillThere: runtime.world.bodies.has(id),
      bodiesBefore,
      bodiesAfter: runtime.world.bodies.size,
      destroyedBefore,
      destroyedAfter: runtime.store.destroyed,
      decals: runtime.decals.count,
      particles: runtime.fx.particleCount,
    };
  });
  assert.ok(!destruction.stillThere, "o barril deveria ser removido ao fraturar");
  assert.ok(destruction.destroyedAfter > destruction.destroyedBefore, "contador de destruição deveria subir");
  assert.ok(destruction.bodiesAfter > destruction.bodiesBefore, "a fratura deveria criar estilhaços físicos");
  assert.ok(destruction.particles > 0 || destruction.decals > 0, "a explosão deveria gerar partículas/marcas");
  console.log(
    `PASS destruição: ${destruction.bodiesAfter - destruction.bodiesBefore} estilhaços, ${destruction.decals} marcas, ${destruction.particles} partículas`,
  );

  /* ----------------------------------------------------- menu de pausa -- */
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-gf-part="pause-backdrop"]')).toBeVisible();
  await page.locator('[data-gf-part="pause-backdrop"] button[data-tab]').nth(2).click();
  await page.waitForTimeout(200);
  const themeBefore = (await state()).theme;
  const themeButton = page.locator('[data-gf-part="pause-backdrop"] button[data-gf-id^="theme-"]').last();
  await themeButton.click();
  await page.waitForTimeout(300);
  const themed = await state();
  assert.notEqual(themed.theme, themeBefore, "clicar num tema deveria trocar o tema do jogo");
  const cssAccent = await page.evaluate(() =>
    getComputedStyle(document.querySelector(".gf-ui")).getPropertyValue("--gf-accent").trim(),
  );
  assert.ok(cssAccent.length > 0, "o tema deveria escrever variáveis CSS --gf-*");
  await page.screenshot({ path: "test-results/goreforge-menu-pausa.png" });
  console.log(`PASS pausa + tema ao vivo (${themeBefore} → ${themed.theme})`);

  /* ------------------------------------------------ persistência + fps --- */
  const persisted = await page.evaluate(() => ({
    settings: !!localStorage.getItem("goreforge.settings.v1"),
    theme: JSON.parse(localStorage.getItem("goreforge.settings.v1")).theme,
  }));
  assert.ok(persisted.settings, "os ajustes deveriam ser salvos no navegador");
  assert.equal(persisted.theme, themed.theme);

  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  const final = await state();
  assert.ok(final.fps > 10, `fps final baixo: ${final.fps}`);
  await page.screenshot({ path: "test-results/goreforge-patio.png" });
  console.log(`PASS sessão estável (${final.fps.toFixed(0)} fps, ${final.bodies} corpos)`);

  assert.deepEqual(errors, [], `erros de página: ${errors.join(" | ")}`);
  console.log("PASS GORE FORGE browser");
} finally {
  await browser.close();
}
