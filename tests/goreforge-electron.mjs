import { _electron as electron } from "@playwright/test";
import { mkdir, mkdtemp, readdir, rm, stat } from "node:fs/promises";
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

/**
 * Instalado pelo NSIS, o app NÃO é uma pasta carregável pelo Electron: não há
 * package.json na raiz, o jogo vive dentro de resources\app.asar. Então, quando
 * existe um executável na pasta (ou GOREFORGE_TEST_EXE aponta um), abrimos o app
 * pelo próprio .exe — é o que o usuário clica no Menu Iniciar.
 */
const acharExecutavel = async (pasta) => {
  const arquivos = await readdir(pasta).catch(() => []);
  return (
    arquivos.find(
      (nome) => /\.exe$/i.test(nome) && !/^uninstall/i.test(nome),
    ) ?? null
  );
};

/** A pasta preparada por `installer:goreforge:desktop` tem package.json e é carregável. */
const ehPastaDeApp = async (pasta) =>
  Boolean(await stat(path.join(pasta, "package.json")).catch(() => null));

const exeDoAmbiente = process.env.GOREFORGE_TEST_EXE || "";
// pasta com package.json = app de desenvolvimento/empacotado (carrega a pasta);
// pasta instalada pelo NSIS = abrir pelo .exe (o jogo está em resources\app.asar)
const instaladoNaPasta = exeDoAmbiente ? false : !(await ehPastaDeApp(appDir));
const exeNaPasta = instaladoNaPasta ? await acharExecutavel(appDir) : null;
const executavel =
  exeDoAmbiente || (exeNaPasta ? path.join(appDir, exeNaPasta) : "");

/**
 * Anotações do GitHub Actions: quando algo falha, a mensagem real vira anotação
 * no resumo da execução — dá para ler sem baixar log nenhum.
 */
const escapar = (texto) =>
  String(texto).replace(/%/g, "%25").replace(/\r?\n/g, "%0A");
const anotar = (titulo, detalhe) =>
  console.error(`::error title=${titulo}::${escapar(detalhe).slice(0, 1400)}`);
const avisar = (titulo, detalhe) =>
  console.log(`::notice title=${titulo}::${escapar(detalhe).slice(0, 700)}`);
const alvo = executavel || appDir;
const info = await stat(alvo).catch(() => null);
assert.ok(
  info && (executavel ? info.isFile() : info.isDirectory()),
  `app não encontrado em ${alvo}: rode \`npm run installer:goreforge:desktop\` antes`,
);

await mkdir("test-results", { recursive: true });
const perfil = await mkdtemp(path.join(os.tmpdir(), "goreforge-electron-"));
const erros = [];
let app = null;
try {
  const sinalizadores = [
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    `--user-data-dir=${perfil}`,
  ];
  // Instalado, o app abre pelo .exe (o que o usuario clica). O Playwright nao
  // injeta o loader nesse caso, entao se isso travar caímos para o app.asar
  // instalado, que e exatamente o que o Electron carrega ao abrir o .exe.
  const asar = path.join(appDir, "resources", "app.asar");
  const tentativas = executavel
    ? [
        {
          nome: `executavel instalado (${executavel})`,
          opcoes: {
            executablePath: executavel,
            args: sinalizadores,
            timeout: 90000,
          },
        },
        {
          nome: `app.asar instalado (${asar})`,
          opcoes: { args: [asar, ...sinalizadores], timeout: 90000 },
        },
      ]
    : [
        {
          nome: `pasta ${path.resolve(appDir)}`,
          opcoes: { args: [appDir, ...sinalizadores], timeout: 90000 },
        },
      ];

  const recusas = [];
  for (const tentativa of tentativas) {
    try {
      app = await electron.launch(tentativa.opcoes);
      avisar("Electron", `aplicativo aberto por ${tentativa.nome}`);
      break;
    } catch (falha) {
      recusas.push(`${tentativa.nome}: ${falha?.message ?? falha}`);
    }
  }
  if (!app) {
    anotar(
      "Nenhuma forma de abrir o GORE FORGE funcionou",
      recusas.join(" | "),
    );
    throw new Error(`nao consegui abrir o aplicativo: ${recusas.join(" | ")}`);
  }
  // se o processo principal reclamar, a mensagem tem de aparecer na anotação
  try {
    app.process().stderr?.on("data", (pedaco) => {
      const texto = String(pedaco).trim();
      if (texto) erros.push(`stderr: ${texto}`);
    });
  } catch {
    /* sem stderr acessível: seguimos com o resto dos diagnósticos */
  }
  const janela = await app.firstWindow();
  janela.on("pageerror", (erro) => erros.push(String(erro.message ?? erro)));
  janela.on("console", (mensagem) => {
    if (mensagem.type() !== "error") return;
    const texto = mensagem.text();
    if (/favicon|swiftshader|GPU stall|Autofill/i.test(texto)) return;
    erros.push(texto);
  });

  const nomeApp = await app.evaluate(({ app: a }) => a.getName());
  assert.ok(
    /gore[\s_-]*forge/i.test(nomeApp),
    `nome do aplicativo: ${nomeApp}`,
  );
  const titulo = await janela.title();
  assert.match(titulo, /gore[\s_-]*forge/i, `título da janela: ${titulo}`);
  console.log("PASS electron: aplicativo GORE FORGE abriu (janela e título)");

  /* ---------------------------------------------------- splash + jogo ---- */
  try {
    await janela.waitForFunction(() => !!window.goreforge, null, {
      timeout: 90000,
    });
  } catch (semJogo) {
    const diagnostico = await janela
      .evaluate(() => {
        let webgl2 = false;
        try {
          webgl2 = !!document.createElement("canvas").getContext("webgl2");
        } catch {
          webgl2 = false;
        }
        return {
          titulo: document.title,
          pronto: document.readyState,
          temCanvas: !!document.querySelector("canvas"),
          temSplash: !!document.querySelector("#gf-enter"),
          textoDoBoot:
            document
              .querySelector("#goreforge-boot")
              ?.textContent?.slice(0, 160) ?? null,
          webgl2,
          temGoreforge: typeof window.goreforge,
        };
      })
      .catch((erroDiagnostico) => ({
        falhaAoDiagnosticar: String(erroDiagnostico.message ?? erroDiagnostico),
      }));
    anotar("GORE FORGE não carregou no Electron", JSON.stringify(diagnostico));
    throw semJogo;
  }
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
    // mesma chamada dos testes de navegador/offline: `position` é Vector3
    // (o spawner usa .clone()), e `ahead(dist, altura)` devolve um ponto à frente
    const runtime = window.goreforge;
    runtime.spawner.spawn("crate", {
      position: runtime.ahead(8, 1),
      kind: "prop",
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
  console.log(
    executavel
      ? "PASS electron: GORE FORGE rodando a partir do aplicativo INSTALADO"
      : "PASS electron: GORE FORGE rodando no aplicativo instalável",
  );
} catch (erro) {
  anotar("GORE FORGE no Electron falhou", erro?.message ?? String(erro));
  if (erros.length) anotar("Erros de página no Electron", erros.join(" | "));
  throw erro;
} finally {
  if (app) await app.close().catch(() => {});
  await rm(perfil, { recursive: true, force: true }).catch(() => {});
}
