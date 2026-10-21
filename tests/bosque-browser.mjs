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
page.on("console", (m) => {
  if (m.type() === "error") console.log("ERR", m.text());
});
try {
  await page.goto("http://127.0.0.1:5173");
  await page
    .locator("input[type=file]")
    .setInputFiles("examples/bosque-vivo/Bosque-Vivo-v0.5.gameforge.json");
  await expect(page.locator(".project-identity")).toContainText("Bosque Vivo");
  await page.getByTitle("Executar / parar · F5").click();
  await page
    .getByRole("button", { name: "Permitir e executar", exact: true })
    .click();
  await expect(page.locator("[data-ui-id=menu-title]")).toHaveText(
    "BOSQUE VIVO",
    { timeout: 12000 },
  );
  await page.screenshot({ path: "test-results/bosque-menu.png" });
  await page.locator("[data-ui-id=begin]").click();
  await expect(page.locator("[data-ui-id=menu-bg]")).toBeHidden();
  await expect(page.locator("[data-ui-id=life]")).toContainText("VIDA");
  await expect(page.locator("[data-ui-id=hunger]")).toContainText("FOME");
  await page.waitForTimeout(800);
  await page.screenshot({ path: "test-results/bosque-play.png" });
  await page.keyboard.press("e");
  await expect(page.locator("[data-ui-id=bag-bg]")).toBeVisible();
  await page.locator("[data-ui-id=save]").click();
  await expect(page.locator("[data-ui-id=message]")).toContainText(
    "Progresso salvo",
    { timeout: 6000 },
  );
  const saved = await page.evaluate(() =>
    JSON.parse(
      localStorage.getItem("gameforge.save.bosque-vivo-world.game-controller"),
    ),
  );
  if (
    saved.blocks.length !== 24576 ||
    saved.inventory.berry !== 8 ||
    saved.health <= 0
  )
    throw Error("Save invalid " + JSON.stringify(saved).slice(0, 100));
  await page.screenshot({ path: "test-results/bosque-inventory.png" });
  await page.keyboard.press("F8");
  await page.getByTitle("Executar / parar · F5").click();
  await page.locator("[data-ui-id=load]").click();
  await expect(page.locator("[data-ui-id=message]")).toContainText(
    "Progresso carregado",
  );
  await page.keyboard.press("F8");
  await page
    .locator(".tree-row")
    .filter({ hasText: "Controlador do jogo" })
    .click();
  await page.getByRole("button", { name: "Scripts", exact: true }).click();
  await expect(page.getByLabel("Código do script")).toContainText("CONFIG");
  await expect(page.locator(".code-diagnostics")).toContainText("Nenhum erro");
  if (errors.length) throw Error(errors.join("\n"));
  console.log(
    "PASS project opens in engine, editable JS gameplay, game menu, health/hunger, inventory, persistent save/load, script syntax",
  );
} finally {
  await browser.close();
}
