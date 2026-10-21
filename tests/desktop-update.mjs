import { _electron as electron, expect } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "gf03-"));
const app = await electron.launch({
  args: [
    process.env.GAMEFORGE_TEST_APP || ".",
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    `--user-data-dir=${temp}`,
  ],
});
const page = await app.firstWindow();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.waitForLoadState("domcontentloaded");
await expect(page.locator("canvas")).toHaveCount(1);
await page.getByTitle("Executar / parar · F5").click();
await expect(page.getByLabel("Vista da câmera")).toHaveValue("first");
await expect(page.locator(".fps-crosshair")).toBeVisible();
await page.keyboard.press("F8");
await page.getByRole("button", { name: "Novo", exact: true }).click();
await page
  .getByRole("button", { name: /Lua \+ JavaScript Dois exemplos/ })
  .click();
await page.locator(".tree-row").filter({ hasText: "Cubo • Lua" }).click();
await page.getByRole("button", { name: "Scripts", exact: true }).click();
await page
  .getByLabel("Código do script")
  .fill(
    'engine.log("LUA_DESKTOP_OK")\nfunction update(dt,time,input) self.ry=self.ry+60*dt end',
  );
await page.getByRole("button", { name: "Aplicar script", exact: true }).click();
await page
  .locator(".tree-row")
  .filter({ hasText: "Esfera • JavaScript" })
  .click();
await page
  .getByLabel("Código do script")
  .fill(
    'engine.log("JS_DESKTOP_OK");function update(dt,time,input){self.y=1+Math.sin(time)*0.4;}',
  );
await page.getByRole("button", { name: "Aplicar script", exact: true }).click();
await page.getByTitle("Executar / parar · F5").click();
await page
  .getByRole("button", { name: "Permitir e executar", exact: true })
  .click();
await page.getByRole("button", { name: /^Console/ }).click();
await expect(page.locator(".console-content")).toContainText("LUA_DESKTOP_OK", {
  timeout: 12000,
});
await expect(page.locator(".console-content")).toContainText("JS_DESKTOP_OK", {
  timeout: 12000,
});
console.log("PASS Lua and JavaScript inside packaged Electron + CSP");
await page.screenshot({ path: "test-results/desktop-scripts.png" });
await page.keyboard.press("F8");
await page.getByRole("button", { name: "Toolbox", exact: true }).click();
await page
  .getByRole("button", { name: "Escada Construção", exact: true })
  .click();
await expect(
  page.locator(".tree-row").filter({ hasText: "Degrau" }),
).toHaveCount(6);
await page
  .getByRole("button", { name: "Bloquear / desbloquear nó", exact: true })
  .click();
await expect(page.getByLabel("Nome do nó")).toBeDisabled();
await page
  .getByRole("button", { name: "Bloquear / desbloquear nó", exact: true })
  .click();
await expect(page.getByLabel("Nome do nó")).toBeEnabled();
console.log("PASS prefab and lock tools");
if (errors.length) throw new Error(errors.join("\n"));
await app.close();
await fs.rm(temp, { recursive: true, force: true });
