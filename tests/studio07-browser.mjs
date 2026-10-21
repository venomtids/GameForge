import { launchBrowser } from "./browser-helper.mjs";
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
const seed = {
  version: 6,
  name: "Luzes 0.7",
  settings: { volume: 0.9 },
  scenes: [
    {
      id: "cena",
      name: "Cena",
      nodes: [
        {
          id: "chao",
          kind: "box",
          name: "Chão",
          position: [0, -0.5, 0],
          scale: [40, 1, 40],
          physics: "static",
          color: "#5d6b4f",
        },
      ],
    },
  ],
};
try {
  await page.addInitScript((p) => {
    if (!localStorage.getItem("gameforge.project.v6"))
      localStorage.setItem("gameforge.project.v6", JSON.stringify(p));
  }, seed);
  await page.goto("http://127.0.0.1:5173");

  // ---------------------------------------------------------------- Toolbox
  await page.getByRole("button", { name: "Toolbox", exact: true }).click();
  await expect(page.locator(".toolbox-panel")).toContainText("60 modelos");
  await page.getByLabel("Categoria do Toolbox").selectOption("Iluminação");
  await expect(page.locator(".toolbox-panel")).toContainText(
    "Lâmpada piscante",
  );
  await page.getByRole("button", { name: /^Lâmpada piscante/ }).click();
  await page.waitForTimeout(800);

  // -------------------------------------------------- Inspetor de luz (0.7)
  const luz = page.locator(".component-section.features07");
  await luz.getByLabel("Tipo de luz").selectOption("spot");
  await luz.getByLabel("Intensidade", { exact: true }).fill("18");
  await luz.getByLabel("Ângulo").fill("50");
  await luz.getByLabel("Pisca (0–1)").fill("0.4");
  await luz.getByLabel("Velocidade da piscada").fill("9");
  await page.waitForTimeout(750);
  let p = await saved();
  const lampada = p.scenes[0].nodes.at(-1);
  if (
    lampada.light.type !== "spot" ||
    lampada.light.intensity !== 18 ||
    lampada.light.angle !== 50 ||
    Math.abs(lampada.light.flicker - 0.4) > 0.0001 ||
    Math.abs(lampada.light.flickerSpeed - 9) > 0.0001
  )
    throw Error(
      "Inspetor de luz não persistiu: " + JSON.stringify(lampada.light),
    );
  await page.screenshot({ path: "test-results/studio07-luz.png" });

  // ------------------------------------------- Lanterna e áudio (Mundo 0.7)
  await page.getByRole("button", { name: "Mundo", exact: true }).click();
  await page.getByLabel("Intensidade da lanterna").fill("30");
  await page.getByLabel("Alcance da lanterna").fill("44");
  await page.getByLabel("Ângulo da lanterna").fill("40");
  await page.getByLabel("Lanterna ligada ao iniciar").check();
  await page.getByLabel("Sombras da lanterna").check();
  await page.getByLabel("Volume geral").fill("0.7");
  await page.waitForTimeout(750);
  p = await saved();
  const t = p.settings.torch;
  if (
    !t ||
    t.intensity !== 30 ||
    t.distance !== 44 ||
    t.angle !== 40 ||
    t.enabled !== true ||
    t.shadows !== true ||
    Math.abs(p.settings.volume - 0.7) > 0.0001
  )
    throw Error("Lanterna/áudio não persistiram: " + JSON.stringify(t));
  await page.screenshot({ path: "test-results/studio07-mundo.png" });

  // ------------------------------------------------- Runtime: luz, som, tween
  const runtime = await page.evaluate(async () => {
    const THREE = await import("/node_modules/.vite/deps/three.js"),
      { World, addLighting } = await import("/src/engine/World.ts"),
      { createProject, makeNode } = await import("/src/engine/model.ts"),
      { prefab06 } = await import("/src/engine/prefabs06.ts"),
      { ScriptHost } = await import("/src/engine/Scripts.ts");
    const p = createProject(),
      player = prefab06("humanoidPlayer")[0];
    player.id = "player";
    player.position = [0, 2, 6];
    const lampada = makeNode("box", {
      id: "lanterna",
      position: [3, 2.4, 3],
      scale: [0.6, 0.2, 0.6],
      light: {
        type: "point",
        enabled: true,
        intensity: 2,
        distance: 10,
        color: "#ffe9c0",
      },
    });
    const script = makeNode("box", {
      id: "script",
      position: [0, 1, 2],
      script: {
        enabled: true,
        language: "javascript",
        source:
          'function start(){engine.light("lanterna",{type:"spot",intensity:16,distance:30,color:"#ffd9a0"});engine.flicker("lanterna",1.5,0.8);engine.torch(true,{intensity:28,distance:26,angle:36,color:"#ffeccc"});engine.sound("porta.abrir",1,1);engine.loop("vento",0.4);engine.move("lanterna",{y:3.4},0.4);engine.heal("player",15);engine.log("JS07 ok");}\n' +
          'let feito=false;function update(dt,time,input){if(time>0.5&&!feito){feito=true;engine.sound("moeda",0.7,1.2);engine.loop("vento",0);engine.torch(false);}}',
      },
    });
    p.scenes[0].nodes = [
      makeNode("box", {
        physics: "static",
        position: [0, -0.5, 0],
        scale: [30, 1, 30],
      }),
      player,
      lampada,
      script,
    ];
    p.settings.playerId = player.id;
    const scene = new THREE.Scene(),
      unlight = addLighting(scene),
      world = new World(scene);
    world.load(p.scenes[0], p.settings, true);
    world.health.set("player", 50);
    const played = [],
      loops = [],
      logs = [];
    const origPlay = world.audio.play.bind(world.audio),
      origLoop = world.audio.loop.bind(world.audio);
    world.audio.play = (n, v, tom) => {
      played.push(n);
      return origPlay(n, v, tom);
    };
    world.audio.loop = (n, v) => {
      loops.push([n, v]);
      return origLoop(n, v);
    };
    const host = new ScriptHost(world, (s) => logs.push(s));
    host.start();
    for (let i = 0; i < 40; i++) {
      host.update(0.04, new Set());
      world.update(0.04, new Set(), i * 0.04);
      await new Promise((r) => setTimeout(r, 25));
    }
    const light = world.lights.get("lanterna");
    const mundo = new THREE.Vector3();
    light.getWorldPosition(mundo);
    return {
      logs,
      played,
      loops,
      tipo: light.constructor.name,
      intensidade: light.intensity,
      distancia: light.distance,
      altura: mundo.y,
      piscadas: world.flickers.size,
      lanterna: { ...world.torch, offset: undefined },
      vida: world.health.get("player"),
      volume: world.audio.volume ?? null,
      unlight: !!unlight,
    };
  });
  if (!runtime.logs.some((l) => /JS07 ok/.test(l)))
    throw Error("Script 0.7 não rodou: " + JSON.stringify(runtime.logs));
  if (!runtime.played.includes("porta.abrir"))
    throw Error("Som avulso não tocou: " + JSON.stringify(runtime.played));
  if (!runtime.played.includes("moeda"))
    throw Error("Som do update não tocou: " + JSON.stringify(runtime.played));
  if (!runtime.loops.some(([n]) => n === "vento"))
    throw Error("Loop não iniciou: " + JSON.stringify(runtime.loops));
  if (
    runtime.tipo !== "SpotLight" ||
    runtime.distancia !== 30 ||
    !(runtime.intensidade > 0.5 && runtime.intensidade <= 16)
  )
    throw Error("engine.light não aplicou: " + JSON.stringify(runtime));
  if (!(runtime.piscadas >= 1))
    throw Error("engine.flicker não registrou a piscada");
  if (runtime.altura < 3.4 || runtime.altura > 3.7)
    throw Error("tween move não terminou: " + runtime.altura);
  if (runtime.vida !== 65)
    throw Error("engine.heal não curou: " + runtime.vida);
  if (runtime.lanterna.enabled !== false || runtime.lanterna.intensity !== 28)
    throw Error(
      "engine.torch não aplicou: " + JSON.stringify(runtime.lanterna),
    );

  // ------------------------------------- Jogo PORTAS rodando dentro da engine
  const jogo = await page.evaluate(async () => {
    const THREE = await import("/node_modules/.vite/deps/three.js"),
      { World, addLighting } = await import("/src/engine/World.ts"),
      { parseProject } = await import("/src/engine/model.ts"),
      { ScriptHost } = await import("/src/engine/Scripts.ts"),
      { GameUI } = await import("/src/engine/GameUI.ts");
    const texto = await fetch(
      "/examples/portas-hotel/Hotel-Portas.gameforge.json",
    ).then((r) => r.text());
    const projeto = parseProject(texto),
      cena = projeto.scenes[0];
    const hud = document.createElement("div");
    hud.id = "hud-07";
    hud.style.position = "absolute";
    hud.style.inset = "0";
    document.body.appendChild(hud);
    const scene = new THREE.Scene(),
      renderer = new THREE.WebGLRenderer({ antialias: true }),
      unlight = addLighting(scene),
      world = new World(scene);
    world.load(cena, projeto.settings, true);
    const ui = new GameUI(hud, world, () => {});
    const played = [],
      loops = [],
      logs = [];
    const origPlay = world.audio.play.bind(world.audio),
      origLoop = world.audio.loop.bind(world.audio);
    world.audio.play = (n, v, tom) => {
      played.push(n);
      return origPlay(n, v, tom);
    };
    world.audio.loop = (n, v) => {
      loops.push([n, v]);
      return origLoop(n, v);
    };
    const host = new ScriptHost(world, (s) => logs.push(s));
    host.start();
    let lanternaLigou = false;
    const passo = async (teclas) => {
      host.update(1 / 30, teclas);
      world.update(1 / 30, teclas, performance.now() / 1000);
      ui.update(true, false);
      lanternaLigou ||= world.torch.enabled;
      await new Promise((r) => setTimeout(r, 6));
    };
    for (let i = 0; i < 20; i++) await passo(new Set());
    await passo(new Set(["e"])); // entra no elevador e começa as 100 portas
    for (let i = 0; i < 300; i++)
      await passo(new Set(i % 60 === 0 ? ["w"] : []));
    const sala1 = [...world.objects.keys()].filter((id) =>
      id.startsWith("s1."),
    );
    renderer.setSize(560, 340);
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.right = "12px";
    renderer.domElement.style.bottom = "12px";
    renderer.domElement.style.borderRadius = "10px";
    document.body.appendChild(renderer.domElement);
    const { CameraRig } = await import("/src/engine/CameraRig.ts");
    const rig = new CameraRig(renderer.domElement);
    rig.set("first");
    rig.playing = true;
    rig.update(world, 0.016);
    renderer.render(scene, rig.camera);
    return {
      logs,
      played,
      loops: loops.map(([n, v]) => `${n}:${v}`),
      porta: world.uiPatches.get("hud.porta")?.text ?? "",
      inicio: world.uiPatches.get("tela.inicio")?.visible ?? null,
      objetivo: world.uiPatches.get("hud.objetivo")?.text ?? "",
      sala1: sala1.length,
      luzes: world.lights.size,
      lanterna: world.torch.enabled,
      lanternaLigou,
      comodos: world.objects.size,
      volume: projeto.settings.volume ?? null,
      playerX: world.objects.get(world.playerId)?.position.x ?? null,
    };
  });
  if (!/PORTA\s+1\s*\/\s*100/.test(jogo.porta))
    throw Error("HUD do jogo não subiu: " + JSON.stringify(jogo.porta));
  if (jogo.sala1 < 12)
    throw Error("Sala 1 do hotel não foi construída: " + jogo.sala1);
  if (jogo.inicio !== false)
    throw Error("Tela inicial não saiu depois de começar");
  if (jogo.luzes < 1) throw Error("Nenhuma luz no hotel");
  // Random hotel enemies can kill the idle test player; death correctly switches the torch off.
  if (!jogo.lanternaLigou)
    throw Error("Lanterna do jogador nunca ligou: " + JSON.stringify(jogo));
  if (!jogo.played.includes("elevador"))
    throw Error("Som de início não tocou: " + JSON.stringify(jogo.played));
  if (!jogo.loops.some((l) => l.startsWith("vento")))
    throw Error("Camada de vento não tocou: " + JSON.stringify(jogo.loops));
  if (jogo.logs.some((l) => /Error|erro:/i.test(l)))
    throw Error("Erro no script do jogo: " + JSON.stringify(jogo.logs));
  await page.screenshot({ path: "test-results/studio07-portas.png" });

  if (errors.length) throw Error("Erros de página: " + errors.join(" | "));
  console.log("studio07-browser PASS");
  console.log(
    "  luz/spot:",
    runtime.tipo,
    runtime.intensidade,
    "| tween y:",
    runtime.altura.toFixed(2),
    "| heal:",
    runtime.vida,
  );
  console.log(
    "  sons:",
    runtime.played.join(","),
    "| loops:",
    runtime.loops.map(([n]) => n).join(","),
  );
  console.log(
    "  jogo:",
    jogo.porta,
    "| nós s1:",
    jogo.sala1,
    "| nós totais:",
    jogo.comodos,
    "| luzes:",
    jogo.luzes,
    "| som:",
    jogo.played.slice(0, 6).join(","),
  );
} finally {
  await browser.close();
}
