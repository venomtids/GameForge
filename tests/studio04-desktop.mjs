import { _electron as electron, expect } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "gf04-"));
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
  await expect(page.locator("canvas")).toHaveCount(1);
  await page.getByRole("button", { name: "Novo", exact: true }).click();
  await page.getByRole("button", { name: /Ateliê 0.4 Terreno/ }).click();
  await page.locator(".tree-row").filter({ hasText: "Escultura Lua" }).click();
  await page.getByRole("button", { name: "Scripts", exact: true }).click();
  await page.getByLabel("Código do script").fill("function update( broken");
  await expect(page.locator(".code-diagnostics")).toContainText("Erro · linha");
  await expect(
    page.getByRole("button", { name: "Aplicar script", exact: true }),
  ).toBeDisabled();
  const source = await fs.readFile("examples/escultura-interativa.lua", "utf8");
  await page
    .locator(".script-file-actions input[type=file]")
    .setInputFiles({
      name: "escultura.lua",
      mimeType: "text/plain",
      buffer: Buffer.from(source),
    });
  await page
    .getByRole("button", { name: "Aplicar script", exact: true })
    .click();
  const savePath = path.join(temp, "exportado.lua");
  await app.evaluate(({ dialog }, p) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: p });
  }, savePath);
  await page
    .getByRole("button", { name: "Exportar script", exact: true })
    .click();
  await expect
    .poll(async () => {
      try {
        return await fs.readFile(savePath, "utf8");
      } catch {
        return "";
      }
    })
    .toBe(source);
  await page.getByTitle("Executar / parar · F5").click();
  await page
    .getByRole("button", { name: "Permitir e executar", exact: true })
    .click();
  await page.getByRole("button", { name: /^Console/ }).click();
  await expect(page.locator(".console-content")).toContainText("Ateliê: WASD");
  await page.keyboard.down("e");
  await page.waitForTimeout(180);
  await page.keyboard.up("e");
  await expect(page.locator(".console-content")).toContainText("Cor alterada!");
  await page.keyboard.press("F8");
  await page.getByRole("button", { name: "Toolbox", exact: true }).click();
  await expect(page.locator(".toolbox-panel>div>button")).toHaveCount(46);
  await page.screenshot({ path: "test-results/studio04-desktop.png" });
  if (errors.length) throw Error(errors.join("\n"));
  console.log(
    "PASS production Electron: new demo, Lua diagnostic, native .lua export/import, start/self state/key E, 46 prefabs, CSP",
  );
} finally {
  await app.close();
  await fs.rm(temp, { recursive: true, force: true });
}
