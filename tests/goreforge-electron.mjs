import { _electron as electron } from "@playwright/test";
import { mkdir, mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

/**
 * Valida o GORE FORGE DENTRO DO APLICATIVO (Electron), não no navegador.
 *
 * Roda contra o app preparado por `npm run installer:goreforge:desktop` — ou,
 * com `GOREFORGE_TEST_APP`, contra o aplicativo INSTALADO (é assim que o CI do
 * Windows prova que o instalador NSIS entrega um jogo que abre e joga).
 *
 *   npm run test:electron:goreforge
 *   GOREFORGE_TEST_APP="C:\\...\\GORE FORGE" npm run test:electron:goreforge
 */
const appDir = process.env.GOREFORGE_TEST_APP || "dist/goreforge-desktop";
const info = await stat(appDir).catch(() => null);
assert.ok(
  info && info.isDirectory(),
  `app não encontrado em ${appDir}: rode \`npm run installer:goreforge:desktop\` antes`,
);

await mkdir("test-results", { recursive: true });
const perfil = await mkdtemp(path.join(os.tmpdir(), "goreforge-electron-"));
const app = await electron.launch({
  args: [
    appDir,
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    `--user-data-dir=${perfil}`,
  ],
});

const erros = [];
try {
  const janela = await app.firstWindow();
  janela.on("pageerror", (erro) => erros.push(String(erro.message ?? erro)));
  janela.on("console", (mensagem) => {
    if (mensagem.type() !== "error") return;
    const texto = mensagem.text();
    if (/favicon|swiftshader|GPU stall|Autofill/i.test(texto)) return;
    erros.push(texto);
  });

  const nomeApp = await app.evaluate(({ app: a }) => a.getName());
  assert.ok(/gore\s*forge/i.test(nomeApp), `nome do aplicativo: ${nomeApp}`);
  const titulo = await janela.title();
  assert.match(titulo, /gore\s*forge/i, `título da janela: ${titulo}`);
  console.log("PASS electron: aplicativo GORE FORGE abriu (janela e título)");

  /* ---------------------------------------------------- splash + jogo ---- */
  await janela.waitForFunction(() => !!window.goreforge, null, {
    timeout: 60000,
  });
  await janela.locator("#gf-enter").click();
  await janela.waitForTimeout(1200);

  const inicial = await janela.evaluate(() => {
    const gf = window.goreforge;
    return {
      corpos: gf.world.bodies.size,
      rigs: gf.world.physicalRigs.size,
      zonas: gf.world.configs.length,
      fps: gf.store.fps,
      arma: gf.store.weapon,
    };
  });
  assert.ok(inicial.corpos > 40, `pátio vazio: ${inicial.corpos} corpos`);
  assert.ok(inicial.rigs > 0, "nenhum rig elástico no pátio");
  assert.ok(inicial.zonas > 0, "nenhuma zona registrada");
  console.log(
    `PASS electron: pátio carregado (${inicial.corpos} corpos, ${inicial.rigs} rigs, ${inicial.zonas} zonas)`,
  );

  /* -------------------------------------------------- física rodando ----- */
  const t0 = await janela.evaluate(() => window.goreforge.ctx.time);
  await janela.waitForFunction(
    (anterior) => window.goreforge.ctx.time > anterior + 0.4,
    t0,
    { timeout: 60000 },
  );
  console.log("PASS electron: simulação avançando (ctx.time cresce)");

  /* ------------------------------------------------------- mouse/arma ---- */
  await janela.evaluate(() => {
    window.goreforge.store.godMode = false;
    window.goreforge.combat.triggerDown();
  });
  await janela.waitForFunction(() => window.goreforge.store.shots >= 1, null, {
    timeout: 30000,
  });
  console.log("PASS electron: arma disparou dentro do aplicativo");

  /* ------------------------------------------------------------ spawn ---- */
  const corposAntes = await janela.evaluate(
    () => window.goreforge.world.bodies.size,
  );
  await janela.evaluate(() => {
    window.goreforge.spawner.spawn("crate", {
      position: [0, 6, 0],
      kind: "dynamic",
    });
  });
  await janela.waitForFunction(
    (antes) => window.goreforge.world.bodies.size > antes,
    corposAntes,
    { timeout: 30000 },
  );
  console.log("PASS electron: menu/spawner criou corpo novo");

  /* ---------------------------------------------- dano da engine → vida -- */
  await janela.evaluate(() => {
    window.goreforge.world.damage(
      window.goreforge.world.playerId,
      24,
      "gf-electron",
    );
  });
  await janela.waitForFunction(
    () => window.goreforge.store.damageTaken >= 20,
    null,
    { timeout: 60000 },
  );
  const vida = await janela.evaluate(() => ({
    hp: window.goreforge.store.health,
    engineHp: window.goreforge.world.health.get(
      window.goreforge.world.playerId,
    ),
  }));
  assert.ok(vida.hp <= 80, `vida não caiu no aplicativo: ${vida.hp}`);
  assert.equal(vida.engineHp, vida.hp, "vida do jogo e da engine divergiram");
  console.log(
    `PASS electron: dano convertido (vida ${vida.hp} = engine ${vida.engineHp})`,
  );

  /* -------------------------------------------------------------- HUD ---- */
  const hud = await janela.evaluate(() => ({
    municao:
      document
        .querySelector('[data-gf-id="hud-ammo-count"]')
        ?.textContent?.trim() ?? "",
    slots: document.querySelectorAll('[data-gf-id^="hud-slot-"]').length,
    tema: getComputedStyle(document.querySelector(".gf-ui"))
      .getPropertyValue("--gf-accent")
      .trim(),
    armazenamento: (() => {
      try {
        localStorage.setItem("goreforge.teste", "ok");
        return localStorage.getItem("goreforge.teste") === "ok";
      } catch {
        return false;
      }
    })(),
  }));
  assert.ok(hud.municao.length > 0, "HUD sem contador de munição");
  assert.ok(hud.slots >= 6, `HUD com ${hud.slots} slots de arma`);
  assert.ok(hud.tema.startsWith("#"), `tema sem cor de destaque: ${hud.tema}`);
  assert.ok(
    hud.armazenamento,
    "localStorage indisponível no aplicativo (preferências não salvam)",
  );
  console.log(
    "PASS electron: HUD por dados e preferências (localStorage) funcionando",
  );

  /* ------------------------------------------------------- tela cheia --- */
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0].setFullScreen(true);
  });
  await janela.waitForTimeout(400);
  const cheia = await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].isFullScreen(),
  );
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0].setFullScreen(false);
  });
  assert.ok(cheia, "tela cheia não ligou");
  console.log("PASS electron: tela cheia (F11) funciona");

  await janela.screenshot({ path: "test-results/goreforge-electron.png" });
  assert.deepEqual(
    erros,
    [],
    `erros de página no aplicativo: ${erros.join(" | ")}`,
  );
  console.log("PASS electron: GORE FORGE rodando no aplicativo instalável");
} finally {
  await app.close();
  await rm(perfil, { recursive: true, force: true });
}
