import { launchBrowser } from "./browser-helper.mjs";
import { expect } from "@playwright/test";
import fs from "node:fs/promises";
const browser = await launchBrowser({
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
for (const version of [2, 3, 4, 5]) {
  const old = JSON.parse(
    await fs.readFile(
      version === 5 ? "examples/bosque-vivo/Bosque-Vivo-v0.5.gameforge.json" : version === 4
        ? "examples/Skyline-Parkour-v0.4.gameforge.json"
        : "examples/Skyline-Parkour-v0.3.gameforge.json",
      "utf8",
    ),
  );
  old.version = version;
  old.name = "Projeto antigo preservado " + version;
  for (const n of old.scenes[0].nodes) {
    if (version < 4) {
      delete n.friction;
      delete n.terrain;
    }
    if (version === 2) {
      delete n.script;
      delete n.locked;
    }
  }
  const raw = JSON.stringify(old);
  const page = await browser.newPage();
  await page.addInitScript(
    ({ raw, version }) =>
      localStorage.setItem("gameforge.project.v" + version, raw),
    { raw, version },
  );
  await page.goto("http://127.0.0.1:5173");
  await expect(page.locator(".project-identity")).toContainText(old.name);
  await expect(
    page.getByText("Salvo neste dispositivo", { exact: true }),
  ).toBeVisible();
  const data = await page.evaluate(
    (version) => ({
      old: localStorage.getItem("gameforge.project.v" + version),
      new: JSON.parse(localStorage.getItem("gameforge.project.v6")),
    }),
    version,
  );
  if (data.old !== raw || data.new.version !== 7 || data.new.name !== old.name)
    throw Error("Migration changed original");
  await page.close();
  console.log("PASS autosave v" + version + " -> v7; original unchanged");
}
await browser.close();
