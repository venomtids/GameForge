import { _electron as electron, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync } from "node:fs";
let stage = "launch",
  nativePage;
process.on("uncaughtExceptionMonitor", (error) => {
  const detail = `${stage}: ${error.stack ?? error}`;
  console.error(
    `::error title=Electron smoke test::${detail.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A")}`,
  );
  mkdirSync("test-results", { recursive: true });
  writeFileSync("test-results/windows-native08-failure.txt", detail);
});
const temporary = await fs.mkdtemp(
  path.join(os.tmpdir(), "gameforge-native08-"),
);
await fs.mkdir("test-results", { recursive: true });
const appPath = path.resolve(process.env.GAMEFORGE_TEST_APP ?? ".");
const app = await electron.launch({
  args: [
    appPath,
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    `--user-data-dir=${path.join(temporary, "profile")}`,
  ],
});
try {
  const page = (nativePage = await app.firstWindow()),
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await expect(page.locator(".viewport canvas")).toBeVisible({
    timeout: 30000,
  });
  assert.equal(await page.evaluate(() => typeof window.require), "undefined");
  assert.equal(await page.evaluate(() => typeof window.process), "undefined");
  assert.equal(
    await page.evaluate(() => typeof window.gameforgeDesktop.autosave),
    "function",
  );
  stage = "native save/open/backup";
  const file = path.join(temporary, "native.gameforge.json");
  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
  }, file);
  await page.getByRole("button", { name: /^Salvar/ }).click();
  await expect(page.locator(".toast")).toContainText("Projeto salvo em disco");
  const first = await fs.readFile(file, "utf8");
  await page.getByLabel("Configurações do projeto", { exact: true }).click();
  await page
    .getByLabel("Nome do projeto", { exact: true })
    .fill("Projeto nativo · ação 🚀");
  await page.getByRole("button", { name: "Concluir", exact: true }).click();
  await page.getByRole("button", { name: /^Salvar/ }).click();
  await expect
    .poll(async () => JSON.parse(await fs.readFile(file, "utf8")).name)
    .toBe("Projeto nativo · ação 🚀");
  assert.equal(await fs.readFile(file + ".bak", "utf8"), first);
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
  }, file);
  await page.getByRole("button", { name: "Abrir", exact: true }).click();
  await expect(page.locator(".toast")).toContainText("Projeto aberto");
  await expect(page.locator(".project-identity strong")).toHaveText(
    "Projeto nativo · ação 🚀",
  );
  console.log(
    "PASS native filesystem, UTF-8, isolated preload and atomic .bak",
  );

  stage = "native offline export";
  const htmlFile = path.join(temporary, "offline.html");
  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
  }, htmlFile);
  await page
    .getByRole("button", { name: "Exportar jogo", exact: true })
    .click();
  await expect(page.locator(".toast")).toContainText("Jogo HTML exportado");
  const html = await fs.readFile(htmlFile, "utf8");
  assert.ok(!html.includes("__GAMEFORGE_PROJECT_DATA__"));
  assert.ok(html.includes("project-data"));
  console.log("PASS production file:// offline runtime export");

  stage = "untrusted IPC window";
  const security = await app.evaluate(
    async ({ BrowserWindow }, preload) => {
      const rogue = new BrowserWindow({
        show: false,
        webPreferences: {
          preload,
          contextIsolation: true,
          sandbox: true,
          nodeIntegration: false,
        },
      });
      await rogue.loadURL("about:blank");
      const answer = await rogue.webContents.executeJavaScript(
        'window.gameforgeDesktop.open().then(() => "ALLOWED", error => error.message)',
      );
      rogue.destroy();
      return answer;
    },
    path.join(appPath, "desktop/preload.cjs"),
  );
  assert.match(security, /Origem IPC inválida/);
  const invalid = await page.evaluate(() =>
    window.gameforgeDesktop.autosave("x".repeat(8_000_001)).then(
      () => "ALLOWED",
      (e) => e.message,
    ),
  );
  assert.match(invalid, /8 MB/);
  console.log(
    "PASS untrusted IPC window rejection and native payload byte limit",
  );

  stage = "native animation/runtime";
  await page.getByRole("button", { name: "Novo", exact: true }).click();
  await page.getByRole("button", { name: /^Motion Lab/ }).click();
  await expect(page.locator(".project-identity strong")).toHaveText(
    "Motion Lab",
  );
  await page
    .locator(".tree-row")
    .filter({ hasText: "Plataforma móvel" })
    .click();
  await page.getByRole("button", { name: "Animação", exact: true }).click();
  await expect(page.locator(".animation-panel")).toBeVisible();
  await page.screenshot({ path: "test-results/studio08-windows-desktop.png" });
  await page.keyboard.press("F5");
  await expect(page.locator(".play-border")).toBeVisible();
  await page.waitForTimeout(1000);
  await page.keyboard.press("F8");
  await expect(page.locator(".play-border")).not.toBeVisible();
  await expect(page.locator(".animation-panel")).toBeVisible();
  await page.waitForFunction(() =>
    document
      .querySelector(".status-bar")
      .textContent.includes("Salvo neste dispositivo"),
  );
  await page.evaluate(() => window.dispatchEvent(new Event("beforeunload")));
  const userData = await app.evaluate(({ app }) => app.getPath("userData"));
  const autosaved = await fs.readFile(
    path.join(userData, "autosave.gameforge.json"),
    "utf8",
  );
  assert.equal(JSON.parse(autosaved).name, "Motion Lab");
  assert.deepEqual(errors, []);
  console.log(
    "PASS native timeline/runtime, shutdown flush and desktop autosave",
  );
  await fs.writeFile(
    "test-results/windows-native08.txt",
    "PASS Electron production renderer, IPC isolation, byte limits, atomic backups, UTF-8, offline export, animation runtime and shutdown autosave.\n",
  );
  console.log("ALL STUDIO 0.8 DESKTOP TESTS PASSED");
} catch (error) {
  await nativePage
    ?.screenshot({ path: "test-results/studio08-windows-failure.png" })
    .catch(() => {});
  throw error;
} finally {
  await app.close();
  await fs.rm(temporary, { recursive: true, force: true });
}
