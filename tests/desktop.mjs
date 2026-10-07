import { _electron as electron, expect } from "@playwright/test";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "gameforge-test-"));
const savePath = path.join(temp, "project.json");
const app = await electron.launch({
  args: [
    process.env.GAMEFORGE_TEST_APP || ".",
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    `--user-data-dir=${path.join(temp, "profile")}`,
  ],
});
const page = await app.firstWindow();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.waitForLoadState("domcontentloaded");
await expect(page.locator("canvas")).toHaveCount(1);
const platform = await page.evaluate(() => window.gameforgeDesktop?.platform);
if (!platform) throw new Error("Preload API missing");
const nodeExposed = await page.evaluate(() => typeof window.require);
if (nodeExposed !== "undefined") throw new Error("Node exposed");
console.log("PASS Electron production load, preload, context isolation");
await app.evaluate(({ dialog }, p) => {
  dialog.showSaveDialog = async () => ({ canceled: false, filePath: p });
}, savePath);
await page.getByRole("button", { name: /^Salvar/ }).click();
await expect(page.locator(".toast")).toContainText("Projeto salvo em disco");
const p = JSON.parse(await fs.readFile(savePath, "utf8"));
if (p.format !== "gameforge") throw new Error("native save");
await app.evaluate(({ dialog }, p) => {
  dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [p] });
}, savePath);
await page.getByRole("button", { name: "Abrir", exact: true }).click();
await expect(page.locator(".toast")).toContainText("Projeto aberto");
console.log("PASS native IPC open/save (dialogs mocked, real filesystem)");
const exportPath = path.join(temp, "game.html");
await app.evaluate(({ dialog }, p) => {
  dialog.showSaveDialog = async () => ({ canceled: false, filePath: p });
}, exportPath);
await page.getByRole("button", { name: "Exportar jogo", exact: true }).click();
await expect(page.locator(".toast")).toContainText("Jogo HTML exportado");
const html = await fs.readFile(exportPath, "utf8");
if (html.includes("__GAMEFORGE_PROJECT_DATA__"))
  throw new Error("native export not injected");
console.log("PASS desktop runtime export from file://");
if (errors.length) throw new Error(errors.join("\n"));
await app.close();
await fs.rm(temp, { recursive: true, force: true });
console.log("ALL DESKTOP SMOKE TESTS PASSED");
