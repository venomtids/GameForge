import { _electron as electron, expect } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "gf05-"));
const app = await electron.launch({
  args: [
    process.env.GAMEFORGE_TEST_APP || ".",
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    `--user-data-dir=${temp}/profile`,
  ],
});
try {
  const page = await app.firstWindow();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.waitForLoadState("domcontentloaded");
  await expect(page.locator(".viewport canvas")).toBeVisible();
  const game = path.resolve(
    "examples/bosque-vivo/Bosque-Vivo-v0.5.gameforge.json",
  );
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
  }, game);
  await page.getByRole("button", { name: "Abrir", exact: true }).click();
  await expect(page.locator(".project-identity")).toContainText("Bosque Vivo");
  await page.getByTitle("Executar / parar · F5").click();
  await page
    .getByRole("button", { name: "Permitir e executar", exact: true })
    .click();
  await expect(page.locator("[data-ui-id=begin]")).toBeVisible();
  await page.locator("[data-ui-id=begin]").click();
  await page.keyboard.press("e");
  await expect(page.locator("[data-ui-id=bag-bg]")).toBeVisible();
  await page.locator("[data-ui-id=save]").click();
  await expect(page.locator("[data-ui-id=message]")).toContainText(
    "Progresso salvo",
  );
  await page.screenshot({ path: "test-results/studio05-desktop-game.png" });
  await page.keyboard.press("F8");
  await page.getByRole("button", { name: "Interface 2D", exact: true }).click();
  await expect(page.getByLabel("Elementos 2D").locator("option")).toHaveCount(
    35,
  );
  await page.getByRole("button", { name: "Pixel Studio", exact: true }).click();
  await expect(
    page.getByLabel("Textura selecionada").locator("option"),
  ).toHaveCount(14);
  const destination = path.join(temp, "game.html");
  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
  }, destination);
  await page
    .getByRole("button", { name: "Exportar jogo", exact: true })
    .click();
  await expect(page.locator(".toast")).toContainText("Jogo HTML exportado");
  const html = await fs.readFile(destination, "utf8");
  if (html.includes("__GAMEFORGE_PROJECT_DATA__"))
    throw Error("Export injection failed");
  await fs.copyFile(destination, "test-results/Bosque-exportado.html");
  if (errors.length) throw Error(errors.join("\n"));
  console.log(
    "PASS Electron 0.5 CSP: open editable game, gameplay/HUD/inventory, save, 35 UI elements, 14 textures, native HTML export",
  );
} finally {
  await app.close();
  await fs.rm(temp, { recursive: true, force: true });
}
