import { launchBrowser } from "./browser-helper.mjs";
import { _electron as electron, expect, chromium } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "gf06-"));
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
  await page.setViewportSize({ width: 1500, height: 950 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await expect(page.locator(".viewport canvas")).toBeVisible();
  const lab = path.resolve(
    "examples/laboratorio06/Laboratorio-0.6.gameforge.json",
  );
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
  }, lab);
  await page.getByRole("button", { name: "Abrir", exact: true }).click();
  await expect(page.locator(".project-identity")).toContainText("Laboratório");
  await page.getByTitle("Executar / parar · F5").click();
  await page
    .getByRole("button", { name: "Permitir e executar", exact: true })
    .click();
  await expect(page.locator(".runtime-hud")).toContainText("Vida: 100");
  await expect(page.getByLabel("Vista da câmera")).toHaveValue("first");
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "test-results/studio06-desktop-fps.png" });
  await page.keyboard.press("j");
  await expect(page.locator(".runtime-hud")).toContainText("Vida: 0");
  await page.screenshot({ path: "test-results/studio06-desktop-ragdoll.png" });
  await page.keyboard.press("r");
  await expect(page.locator(".runtime-hud")).toContainText("Vida: 100");
  await page.keyboard.press("g");
  await page.getByLabel("Vista da câmera").selectOption("third");
  await page
    .locator(".viewport canvas")
    .click({ position: { x: 400, y: 220 } });
  await page.keyboard.down("w");
  await page.waitForTimeout(500);
  await page.keyboard.up("w");
  await page.screenshot({ path: "test-results/studio06-desktop-third.png" });
  await page.keyboard.press("F8");
  await expect(page.locator(".runtime-hud")).toHaveCount(0);
  // Palette creates an editable draft, applies and persists natively in v6.
  await page.locator(".tree-row").filter({ hasText: "Bot · patrulha" }).click();
  await page.getByRole("button", { name: "Scripts", exact: true }).click();
  page.on("dialog", (d) => d.accept());
  await page.getByLabel("Comandos prontos").selectOption("follow");
  await page
    .getByRole("button", { name: "Aplicar script", exact: true })
    .click();
  await expect(page.locator(".cm-content")).toContainText(
    'engine.bot(self.id, "follow")',
  );
  const projectFile = path.join(temp, "lab.gameforge.json");
  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
  }, projectFile);
  await page.getByRole("button", { name: /^Salvar/ }).click();
  await expect
    .poll(async () => {
      try {
        return JSON.parse(await fs.readFile(projectFile, "utf8")).version;
      } catch {
        return 0;
      }
    })
    .toBe(7);
  const data = JSON.parse(await fs.readFile(projectFile, "utf8"));
  if (
    data.scenes[0].nodes.find((n) => n.id === "jogador").position.join(",") !==
      "0,2,8" ||
    data.settings.shadows.coverage !== 40
  )
    throw Error("Authored scene or settings lost");
  const destination = path.join(temp, "lab.html");
  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
  }, destination);
  await page
    .getByRole("button", { name: "Exportar jogo", exact: true })
    .click();
  await expect(page.locator(".toast")).toContainText("Jogo HTML exportado");
  const browser = await launchBrowser({
    headless: true,
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  try {
    const offline = await browser.newPage();
    offline.on("dialog", (d) => d.accept());
    offline.on("pageerror", (e) => errors.push(e.message));
    await offline.goto(pathToFileURL(destination).href);
    await offline
      .getByRole("button", {
        name: "Permitir scripts (somente se confiar)",
        exact: true,
      })
      .click();
    await expect(offline.locator("#score")).toContainText("Vida: 100");
    await offline.keyboard.press("j");
    await expect(offline.locator("#score")).toContainText("Vida: 0");
    await offline.keyboard.press("r");
    await expect(offline.locator("#score")).toContainText("Vida: 100");
  } finally {
    await browser.close();
  }
  if (errors.length) throw Error(errors.join("\n"));
  console.log(
    "PASS 0.6 production desktop: native open/save, FPS, ragdoll/death/respawn, third person, quick-command palette, authoring restore, offline exported runtime",
  );
} finally {
  await app.close();
}
