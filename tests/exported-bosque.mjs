import { launchBrowser } from "./browser-helper.mjs";
import { expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
const template = await fs.readFile("public/player.html", "utf8"),
  data = await fs.readFile(
    "examples/bosque-vivo/Bosque-Vivo-v0.5.gameforge.json",
    "utf8",
  );
await fs.writeFile(
  "test-results/Bosque-exportado.html",
  template.replace(
    "__GAMEFORGE_PROJECT_DATA__",
    Buffer.from(data).toString("base64"),
  ),
);
const browser = await launchBrowser({
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  await page.goto(
    pathToFileURL(path.resolve("test-results/Bosque-exportado.html")).href,
  );
  await page
    .getByRole("button", {
      name: "Permitir scripts (somente se confiar)",
      exact: true,
    })
    .click();
  await page.locator("[data-ui-id=begin]").click();
  await expect(page.locator("[data-ui-id=menu-bg]")).toBeHidden();
  await page.keyboard.press("e");
  await expect(page.locator("[data-ui-id=bag-bg]")).toBeVisible();
  await page.locator("[data-ui-id=save]").click();
  await expect(page.locator("[data-ui-id=message]")).toContainText(
    "Progresso salvo",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("#overlay")).toBeVisible();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.locator("#overlay")).toBeHidden();
  if (errors.length) throw Error(errors.join("\n"));
  console.log(
    "PASS exported offline game shares voxel, script, UI, input, save and pause runtimes",
  );
} finally {
  await browser.close();
}
