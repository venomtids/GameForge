import { expect } from "@playwright/test";
import { launchBrowser } from "./browser-helper.mjs";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
await mkdir("test-results", { recursive: true });
const browser = await launchBrowser();
const context = await browser.newContext({
  viewport: { width: 1440, height: 940 },
  acceptDownloads: true,
});
const page = await context.newPage(),
  errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("dialog", (dialog) => dialog.accept());
const base = process.env.GAMEFORGE_URL ?? "http://127.0.0.1:5173";
const saved = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("gameforge.project.v6")));
// Autosave intentionally debounces edits for 600 ms. Do not observe a previous 'saved' label.
const waitSave = async () => {
  await page.waitForTimeout(700);
  await page.waitForFunction(() =>
    document
      .querySelector(".status-bar")
      ?.textContent.includes("Salvo neste dispositivo"),
  );
};
const runCommand = async (text) => {
  await page.keyboard.press("Control+k");
  const input = page.getByLabel("Buscar comando", { exact: true });
  await expect(input).toBeVisible();
  await input.fill(text);
  await input.press("Enter");
  await expect(input).not.toBeVisible();
};
try {
  await page.goto(base);
  await expect(page.locator(".viewport canvas")).toBeVisible();
  await waitSave();
  let p = await saved();
  assert.equal(p.name, "Ilha Aurora");
  const initialCount = p.scenes[0].nodes.length;
  await page.screenshot({ path: "test-results/studio08-desktop.png" });
  await runCommand("adicionar cubo");
  await waitSave();
  p = await saved();
  assert.equal(p.scenes[0].nodes.length, initialCount + 1);
  await page.keyboard.press("Control+d");
  await waitSave();
  p = await saved();
  assert.equal(p.scenes[0].nodes.length, initialCount + 2);
  await page.keyboard.press("Control+c");
  await page.keyboard.press("Control+v");
  await waitSave();
  p = await saved();
  assert.equal(p.scenes[0].nodes.length, initialCount + 3);
  console.log("PASS palette, duplicate, copy/paste and autosave");

  await page.getByLabel("Buscar nós", { exact: true }).fill("Caminho");
  const paths = page.locator(".tree-row").filter({ hasText: "Caminho" });
  await expect(paths).toHaveCount(7);
  await paths.nth(0).click();
  await paths.nth(1).click({ modifiers: ["Control"] });
  await paths.nth(2).click({ modifiers: ["Shift"] });
  await expect(page.locator(".multi-inspector")).toContainText(
    "3 objetos selecionados",
  );
  await page.getByRole("button", { name: "Centro", exact: true }).click();
  await waitSave();
  p = await saved();
  const pathNodes = p.scenes[0].nodes.filter((n) =>
    /^Caminho · [123]$/.test(n.name),
  );
  assert.ok(
    pathNodes.every(
      (n) => Math.abs(n.position[0] - pathNodes[0].position[0]) < 1e-6,
    ),
  );
  await page.keyboard.press("Control+g");
  await waitSave();
  p = await saved();
  const group = p.scenes[0].nodes.find((n) => n.name === "Modelo");
  assert.ok(group);
  assert.equal(
    p.scenes[0].nodes.filter((n) => n.parent === group.id).length,
    3,
  );
  await page.keyboard.press("Control+z");
  await waitSave();
  assert.equal(
    (await saved()).scenes[0].nodes.some((n) => n.id === group.id),
    false,
  );
  await page.keyboard.press("Control+Shift+z");
  await waitSave();
  assert.equal(
    (await saved()).scenes[0].nodes.some((n) => n.id === group.id),
    true,
  );
  await page
    .locator(".tree-row")
    .filter({ hasText: /^Modelo$/ })
    .click();
  await page.keyboard.press("Control+Shift+g");
  await waitSave();
  assert.equal(
    (await saved()).scenes[0].nodes.some((n) => n.id === group.id),
    false,
  );
  await page.getByLabel("Buscar nós", { exact: true }).fill("");
  await page.screenshot({ path: "test-results/studio08-multiselect.png" });
  console.log(
    "PASS multi-selection, alignment, atomic grouping/ungrouping, undo/redo",
  );

  // Layout drag, keyboard resizing and persisted preferences.
  const left = page.getByRole("separator", { name: "Largura do explorador" });
  const bounds = await left.boundingBox();
  await page.mouse.move(bounds.x + 2, bounds.y + 180);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 48, bounds.y + 180);
  await page.mouse.up();
  await expect(left).toHaveAttribute("aria-valuenow", "276");
  await left.focus();
  await left.press("ArrowRight");
  await expect(left).toHaveAttribute("aria-valuenow", "286");
  await page.getByLabel("Mostrar ou ocultar explorador").click();
  await expect(page.locator(".scene-panel")).not.toBeVisible();
  await page.getByLabel("Mostrar ou ocultar explorador").click();
  await expect(page.locator(".scene-panel")).toBeVisible();
  await page.getByLabel("Qualidade da renderização").selectOption("economy");
  await page.waitForTimeout(350);
  assert.equal(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("gameforge.studio.preferences.v1"))
          .quality,
    ),
    "economy",
  );
  await page.getByLabel("Qualidade da renderização").selectOption("auto");
  console.log(
    "PASS resizable/collapsible panels, keyboard separator and local preferences",
  );

  await page
    .getByRole("button", { name: "Meus projetos", exact: true })
    .click();
  await expect(page.locator(".template-card")).toHaveCount(7);
  await page.screenshot({ path: "test-results/studio08-projects.png" });
  await page
    .locator(".template-card")
    .filter({ hasText: "Motion Lab" })
    .click();
  await waitSave();
  assert.equal((await saved()).name, "Motion Lab");
  await page
    .locator(".tree-row")
    .filter({ hasText: "Plataforma móvel" })
    .click();
  await page.getByRole("button", { name: "Animação", exact: true }).click();
  await expect(page.locator(".animation-panel")).toBeVisible();
  await page.getByLabel("Keyframe em 2 s", { exact: true }).click();
  await page.getByLabel("Keyframe Posição Y", { exact: true }).fill("4");
  await page.getByLabel("Keyframe Posição Y", { exact: true }).press("Enter");
  await waitSave();
  p = await saved();
  assert.equal(
    p.scenes[0].nodes.find((n) => n.name === "Plataforma móvel").animation
      .frames[1].position[1],
    4,
  );
  const authored = JSON.stringify(p.scenes[0].nodes);
  await page.getByLabel("Voltar ao início da animação").click();
  await page.getByLabel("Reproduzir prévia da animação").click();
  await page.waitForTimeout(600);
  assert.ok(
    Number(await page.getByLabel("Tempo da animação").inputValue()) > 0.2,
  );
  await page.getByLabel("Parar prévia da animação").click();
  assert.equal(JSON.stringify((await saved()).scenes[0].nodes), authored);
  await page.screenshot({ path: "test-results/studio08-timeline.png" });
  await page.keyboard.press("F5");
  await expect(page.locator(".play-border")).toBeVisible();
  await expect(page.locator(".bottom-dock")).toHaveClass(/closed/);
  await page.waitForTimeout(700);
  await page.keyboard.press("F8");
  await expect(page.locator(".play-border")).not.toBeVisible();
  await waitSave();
  assert.equal(JSON.stringify((await saved()).scenes[0].nodes), authored);
  console.log(
    "PASS keyframe authoring, preview without modifying the scene, runtime and restoration",
  );

  // Rascunhos do CodeMirror must survive dock switches AND unrelated scene changes.
  await page.getByRole("button", { name: "Scripts", exact: true }).click();
  await page.getByLabel("Linguagem do script").selectOption("javascript");
  const code = page.getByRole("textbox", {
    name: "Código do script",
    exact: true,
  });
  await code.fill('function start(){ engine.log("draft survives"); }');
  await page
    .getByRole("button", { name: "Console", exact: false })
    .first()
    .click();
  await page.getByRole("button", { name: "Scripts", exact: true }).click();
  await expect(code).toContainText("draft survives");
  await page
    .getByRole("button", { name: "Aplicar script", exact: true })
    .click();
  await waitSave();
  assert.match(
    (await saved()).scenes[0].nodes.find((n) => n.name === "Plataforma móvel")
      .script.source,
    /draft survives/,
  );
  console.log("PASS script draft recovery and applied-source persistence");

  // A restoration creates a backup of the edit it is replacing.
  await page
    .getByRole("button", { name: "Meus projetos", exact: true })
    .click();
  await page.getByLabel("Nome da versão").fill("Versão de teste");
  await expect(
    page.getByRole("button", { name: "Criar versão", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Criar versão", exact: true }).click();
  await expect(page.locator(".snapshot-list")).toContainText("Versão de teste");
  await page.getByRole("button", { name: "Fechar biblioteca" }).click();
  await runCommand("adicionar cubo");
  await waitSave();
  const changedCount = (await saved()).scenes[0].nodes.length;
  await page
    .getByRole("button", { name: "Meus projetos", exact: true })
    .click();
  await page
    .locator(".snapshot-list button")
    .filter({ hasText: "Versão de teste" })
    .click();
  await expect(page.locator(".project-library")).not.toBeVisible();
  await waitSave();
  assert.equal((await saved()).scenes[0].nodes.length, changedCount - 1);
  await page
    .getByRole("button", { name: "Meus projetos", exact: true })
    .click();
  await expect(page.locator(".snapshot-list")).toContainText(
    "Antes da restauração",
  );
  await page.getByRole("button", { name: "Fechar biblioteca" }).click();
  console.log(
    "PASS IndexedDB library, named versions and safe restore with pre-restore backup",
  );

  // Exact viewport sizes, not just screenshot approximations.
  for (const [width, height] of [
    [320, 720],
    [390, 844],
    [768, 1024],
    [1024, 768],
    [1440, 940],
    [1920, 1080],
    [812, 420],
  ]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(150);
    const layout = await page.evaluate(() => {
      const canvas = document
        .querySelector(".viewport canvas")
        .getBoundingClientRect();
      return {
        scroll: document.documentElement.scrollWidth,
        width: innerWidth,
        canvas: { x: canvas.x, right: canvas.right, height: canvas.height },
      };
    });
    assert.ok(layout.scroll <= width, `horizontal overflow at ${width}`);
    assert.ok(
      layout.canvas.height > 65,
      `viewport collapsed at ${width}x${height}`,
    );
    assert.ok(
      layout.canvas.x >= 0 && layout.canvas.right <= width + 1,
      `viewport outside screen at ${width}`,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Cena", exact: true }).click();
  await expect(page.locator(".scene-panel")).toBeVisible();
  await page
    .getByRole("button", { name: "Fechar painel lateral" })
    .click({ position: { x: 382, y: 80 } });
  await expect(page.locator(".scene-panel")).not.toBeVisible();
  await page.getByRole("button", { name: "Inspetor", exact: true }).click();
  await expect(page.locator(".inspector")).toBeVisible();
  await page.getByRole("button", { name: "Viewport", exact: true }).click();
  await expect(page.locator(".inspector")).not.toBeVisible();
  await page
    .getByRole("button", { name: "Recursos", exact: true })
    .first()
    .click();
  await page.screenshot({ path: "test-results/studio08-mobile.png" });
  await page.keyboard.press("F5");
  await expect(
    page.getByRole("button", { name: "Executar sem scripts", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Executar sem scripts", exact: true })
    .click();
  const touch = page.locator(".touch-game-controls");
  await expect(touch).toBeVisible();
  await page.getByRole("button", { name: "Pular", exact: true }).click();
  await page.screenshot({ path: "test-results/studio08-touch.png" });
  await page.keyboard.press("F8");
  console.log(
    "PASS responsive 320–1920px, portrait/landscape panels and touch controls",
  );

  // Stress the storage bounds; no unbounded accumulation of full-project snapshots.
  const limits = await page.evaluate(async () => {
    const { rememberProject, listProjects, createSnapshot, listSnapshots } =
      await import("/src/engine/project-library.ts");
    const { templateProject } = await import(
      "/src/engine/studio08-templates.ts"
    );
    for (let i = 0; i < 14; i++) {
      const p = templateProject("empty");
      p.name = `Library ${i}`;
      await rememberProject(p);
    }
    const p = templateProject("empty");
    await rememberProject(p);
    for (let i = 0; i < 8; i++) await createSnapshot(p, `Snapshot ${i}`);
    return {
      projects: (await listProjects()).length,
      snapshots: (await listSnapshots(p)).length,
      latest: (await listSnapshots(p))[0].name,
    };
  });
  assert.equal(limits.projects, 12);
  assert.equal(limits.snapshots, 5);
  assert.equal(limits.latest, "Snapshot 7");
  await page.setViewportSize({ width: 1440, height: 940 });
  await page.reload();
  await expect(page.locator(".viewport canvas")).toBeVisible();
  await expect(page.locator(".project-identity strong")).toHaveText(
    "Motion Lab",
  );
  await page.keyboard.press("Control+k");
  await page.keyboard.press("Escape");
  await expect(page.locator(".command-palette")).not.toBeVisible();
  assert.deepEqual(errors, []);
  console.log("ALL STUDIO 0.8 BROWSER TESTS PASSED");
} catch (error) {
  await page.screenshot({ path: "test-results/studio08-failure.png" });
  console.error(
    await page.evaluate(() => ({
      focus: document.activeElement?.outerHTML.slice(0, 500),
      toast: document.querySelector(".toast")?.textContent,
      status: document.querySelector(".status-bar")?.textContent,
    })),
  );
  throw error;
} finally {
  await browser.close();
}
