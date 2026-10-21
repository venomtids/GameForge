import { launchBrowser } from "./browser-helper.mjs";
import { expect } from "@playwright/test";
import fs from "node:fs/promises";
const browser = await launchBrowser({
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://127.0.0.1:5173");
await expect(page.locator("canvas")).toHaveCount(1);
await page.getByRole("button", { name: "Toolbox", exact: true }).click();
await expect(page.locator(".toolbox-panel>div>button")).toHaveCount(60);
await page.getByLabel("Buscar no Toolbox").fill("Casa");
await expect(page.locator(".toolbox-panel>div>button")).toHaveCount(1);
await page.locator(".toolbox-panel>div>button").click();
await expect(page.getByLabel("Nome do nó")).toHaveValue("Casa");
await page.getByLabel("Buscar no Toolbox").fill("");
await page.getByLabel("Categoria do Toolbox").selectOption("Natureza");
await expect(page.locator(".toolbox-panel>div>button")).toHaveCount(8);
await page.screenshot({ path: "test-results/studio04-toolbox.png" });
await page
  .getByRole("button", { name: "Design & pintura", exact: true })
  .click();
await page
  .getByRole("button", { name: "+ Terreno 8 × 8 (64 blocos)", exact: true })
  .click();
await expect(page.getByLabel("Nome do nó")).toHaveValue(
  "Terreno · 8 × 8 blocos",
);
await page.getByRole("button", { name: "Material Areia", exact: true }).click();
await page
  .getByRole("button", {
    name: "Aplicar material à seleção / grupo",
    exact: true,
  })
  .click();
await page.waitForTimeout(700);
let state = await page.evaluate(() =>
  JSON.parse(localStorage.getItem("gameforge.project.v6")),
);
const tiles = state.scenes[0].nodes.filter((n) => n.terrain);
if (tiles.length !== 64 || tiles.some((n) => n.color !== "#d8be84"))
  throw Error("Terrain group material failed");
// Paint an unobstructed tile in top view by projecting its local coordinates.
await page.getByLabel("Vista da câmera").selectOption("top");
await page.getByRole("button", { name: "Elevar", exact: true }).click();
const canvas = page.locator("canvas");
const box = await canvas.boundingBox();
// Top view target initially ~0,.3,0; world extent ±12 in Y screen. Far left tile avoids parkour island.
await page.mouse.click(
  box.x + box.width / 2 - (7 / 24) * box.height,
  box.y + box.height / 2 + (5 / 24) * box.height,
);
await page.waitForTimeout(800);
state = await page.evaluate(() =>
  JSON.parse(localStorage.getItem("gameforge.project.v6")),
);
if (!state.scenes[0].nodes.some((n) => n.terrain && n.scale[1] > 1))
  throw Error("Terrain viewport brush failed");
await page.screenshot({ path: "test-results/studio04-design.png" });
await page.getByRole("button", { name: "Selecionar", exact: true }).click();
await page.keyboard.press("Control+z");
await page.waitForTimeout(650);
state = await page.evaluate(() =>
  JSON.parse(localStorage.getItem("gameforge.project.v6")),
);
if (state.scenes[0].nodes.some((n) => n.terrain && n.scale[1] > 1))
  throw Error("Terrain undo failed");
await page.getByTitle("Configurações do projeto").click();
await page.getByLabel("Sensibilidade do mouse FPS", { exact: true }).fill("3");
await page
  .getByLabel("Sensibilidade do mouse FPS", { exact: true })
  .press("Tab");
await page
  .getByLabel("Velocidade do personagem (multiplicador)", { exact: true })
  .fill("1.8");
await page
  .getByLabel("Velocidade do personagem (multiplicador)", { exact: true })
  .press("Tab");
await page.screenshot({ path: "test-results/studio04-controls.png" });
await page.getByRole("button", { name: "Fechar", exact: true }).click();
await page.getByRole("button", { name: "Novo", exact: true }).click();
await page
  .getByRole("button", { name: /Lua \+ JavaScript Dois exemplos/ })
  .click();
await page.locator(".tree-row").filter({ hasText: "Cubo • Lua" }).click();
await page.getByRole("button", { name: "Scripts", exact: true }).click();
await page
  .getByLabel("Código do script")
  .fill("function update(\n self.x = 1\nend");
await expect(page.locator(".code-diagnostics")).toContainText("Erro · linha");
await expect(
  page.getByRole("button", { name: "Aplicar script", exact: true }),
).toBeDisabled();
await page.screenshot({ path: "test-results/studio04-code-error.png" });
const lua =
  'function start()\n self.count = 0\n engine.log("START04")\nend\nfunction update(dt, time, input)\n self.count = self.count + 1\n self.ry = engine.lerp(self.ry, 90, dt)\n if self.count == 3 then engine.log("STATE04") end\n if input.pressed.w then engine.log("KEY04") end\nend';
await page
  .locator(".script-file-actions input[type=file]")
  .setInputFiles({
    name: "exemplo.lua",
    mimeType: "text/plain",
    buffer: Buffer.from(lua),
  });
await expect(page.getByLabel("Código do script")).toContainText("self.count");
await expect(
  page.getByRole("button", { name: "Aplicar script", exact: true }),
).toBeEnabled();
await page.getByRole("button", { name: "Aplicar script", exact: true }).click();
await expect(page.locator(".cm-content span").first()).toBeVisible();
await page.screenshot({ path: "test-results/studio04-code.png" });
const download = page.waitForEvent("download");
await page
  .getByRole("button", { name: "Exportar script", exact: true })
  .click();
const file = await download;
const path = await file.path();
if ((await fs.readFile(path, "utf8")) !== lua)
  throw Error("Script export changed source");
await page.getByTitle("Executar / parar · F5").click();
await page
  .getByRole("button", { name: "Permitir e executar", exact: true })
  .click();
await page.getByRole("button", { name: /^Console/ }).click();
await expect(page.locator(".console-content")).toContainText("STATE04");
await page.keyboard.down("w");
await page.waitForTimeout(150);
await page.keyboard.up("w");
await expect(page.locator(".console-content")).toContainText("KEY04");
if (errors.length) throw Error(errors.join("\n"));
console.log(
  "PASS 60 Toolbox, search/category, material, terrain raycast brush/undo, settings, syntax errors, Lua import/export, colors, start, persistent state, input edges",
);
await browser.close();
