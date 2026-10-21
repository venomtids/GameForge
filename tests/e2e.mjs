import { launchBrowser } from "./browser-helper.mjs";
import { expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "gameforge-e2e-"));
const artifacts = path.resolve("test-results");
await fs.mkdir(artifacts, { recursive: true });
const browser = await launchBrowser({
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  acceptDownloads: true,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(process.env.TEST_URL || "http://127.0.0.1:5173");
await expect(page.locator("canvas")).toHaveCount(1);
await page.getByRole("button", { name: "Novo", exact: true }).click();
await page
  .getByRole("button", { name: /Ilha dos cristais Cena de exemplo/ })
  .click();
await page.waitForTimeout(700);
const tree = page.locator(".tree-row");
await expect(tree).toHaveCount(21);
await tree.filter({ hasText: "Jogador" }).click();
await expect(page.getByLabel("Nome do nó")).toHaveValue("Jogador");
await page.getByLabel("Posição X", { exact: true }).fill("2");
await page.getByLabel("Posição X", { exact: true }).press("Enter");
await expect(page.getByLabel("Posição X", { exact: true })).toHaveValue("2");
await page
  .getByRole("button", { name: "Desfazer · Ctrl+Z", exact: true })
  .click();
await expect(page.getByLabel("Posição X", { exact: true })).toHaveValue("0");
await page
  .getByRole("button", { name: "Refazer · Ctrl+Shift+Z", exact: true })
  .click();
await expect(page.getByLabel("Posição X", { exact: true })).toHaveValue("2");
await page
  .getByRole("button", { name: "Duplicar selecionado · Ctrl+D", exact: true })
  .click();
await expect(tree).toHaveCount(22);
await page
  .getByRole("button", { name: "Excluir selecionado · Delete", exact: true })
  .click();
await expect(tree).toHaveCount(21);
await page
  .getByRole("button", { name: "Adicionar nó", exact: true })
  .first()
  .click();
await page.locator(".add-options button").filter({ hasText: "Esfera" }).click();
await expect(tree).toHaveCount(22);
await page
  .getByRole("button", { name: "Excluir selecionado · Delete", exact: true })
  .click();
await page.getByTitle("Executar / parar · F5").click();
await expect(page.locator(".runtime-hud")).toBeVisible();
await page.keyboard.down("w");
await page.waitForTimeout(300);
await page.keyboard.up("w");
await page
  .getByRole("button", { name: "Pausar simulação", exact: true })
  .click();
await expect(page.locator(".viewport-label")).toContainText("PAUSADA");
await page.keyboard.press("F8");
await expect(page.locator(".runtime-hud")).toHaveCount(0);
console.log(
  "PASS edição, histórico, criação, exclusão, execução, pausa e restauração",
);
const downloadPromise = page.waitForEvent("download");
await page.getByRole("button", { name: /^Salvar/ }).click();
const d = await downloadPromise;
const saved = JSON.parse(await fs.readFile(await d.path(), "utf8"));
if (saved.scenes[0].nodes.length !== 21) throw new Error("save nodes");
await page.locator("input[type=file]").setInputFiles({
  name: "bad.json",
  mimeType: "application/json",
  buffer: Buffer.from('{"invalid":true}'),
});
await expect(page.locator(".toast")).toContainText("Formato incompatível");
await expect(tree).toHaveCount(21);
await page.locator("input[type=file]").setInputFiles({
  name: "project.json",
  mimeType: "application/json",
  buffer: Buffer.from(JSON.stringify(saved)),
});
await expect(page.locator(".toast")).toContainText("Projeto aberto");
console.log("PASS salvar, abrir e rejeitar projeto inválido");
const htmlPromise = page.waitForEvent("download");
await page.getByRole("button", { name: "Exportar jogo", exact: true }).click();
const html = await htmlPromise;
const htmlPath = path.join(temp, "exported-test.html");
await html.saveAs(htmlPath);
const offline = await browser.newPage();
const offlineErrors = [];
offline.on("pageerror", (e) => offlineErrors.push(e.message));
await offline.goto("file://" + htmlPath);
await expect(offline.locator("canvas")).toHaveCount(1);
await expect(offline.locator("#title")).toHaveText("Ilha dos cristais");
await offline.waitForTimeout(300);
if (offlineErrors.length) throw new Error(offlineErrors.join("\n"));
await offline.close();
console.log("PASS exportação HTML offline");
await page.getByRole("button", { name: "Jogos", exact: true }).first().click();
await expect(page.locator(".legacy-container canvas")).toHaveCount(1);
for (const game of ["coleta", "sobrevivencia", "checkpoint", "dueloia"]) {
  await page.locator(".legacy-container select").first().selectOption(game);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: "Pausar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Continuar", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
}
console.log("PASS iniciar/pausar/reiniciar os 4 jogos");
await page.getByRole("button", { name: "Laboratório", exact: true }).click();
await expect(page.locator(".legacy-container canvas")).toHaveCount(1);
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(artifacts, "lab.png") });
await page
  .getByRole("button", { name: "Teste Gravidade", exact: true })
  .click();
await expect(
  page.getByRole("button", {
    name: "Reiniciar teste de Gravidade",
    exact: true,
  }),
).toBeVisible();
await page.waitForTimeout(200);
await page
  .getByRole("button", { name: "Teste Minecraft", exact: true })
  .click();
await expect(page.getByText(/Blocos no mundo: [1-9]/)).toBeVisible();
await page.getByRole("button", { name: "Creative", exact: true }).click();
await expect(page.getByText(/Modo: creative/)).toBeVisible();
const voxelCanvas = page.locator(".legacy-container canvas");
const rect = await voxelCanvas.boundingBox();
await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2, {
  button: "right",
});
await page.waitForTimeout(100);
await expect(page.getByText(/Bloco .* criado em/)).toBeVisible();
await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
await expect(page.getByText(/Bloco removido em/)).toBeVisible();
await page.locator(".legacy-container input[type=range]").fill("2");
await expect(page.getByText("Render distance: 2")).toBeVisible();
await page.getByRole("button", { name: "Teste Xadrez", exact: true }).click();
await expect(
  page.getByRole("button", { name: "Recarregar teste Xadrez 3D", exact: true }),
).toBeVisible();
console.log(
  "PASS gravidade, voxel instanciado, criar/remover blocos, distância e troca de modos",
);
await page.getByRole("button", { name: "Editor", exact: true }).click();
await expect(tree).toHaveCount(21);
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({
  path: path.join(artifacts, "mobile.png"),
  fullPage: true,
});
const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth > innerWidth + 1,
);
if (overflow) throw new Error("Overflow horizontal mobile");
console.log("PASS laboratório, retorno ao editor, layout mobile");
if (errors.length) throw new Error(errors.join("\n"));
await browser.close();
await fs.rm(temp, { recursive: true, force: true });
console.log("ALL E2E PASSED");
