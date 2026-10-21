import { launchBrowser } from "./browser-helper.mjs";
import { expect } from "@playwright/test";
const browser = await launchBrowser({
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") console.log("CONSOLE", m.text());
});
await page.goto("http://127.0.0.1:5173");
await expect(page.locator("canvas")).toHaveCount(1);
await page.screenshot({ path: "test-results/update-editor.png" });
await page.getByTitle("Executar / parar · F5").click();
await expect(page.getByLabel("Vista da câmera")).toHaveValue("first");
await expect(page.locator(".fps-crosshair")).toBeVisible();
await page.waitForTimeout(500);
await page.screenshot({ path: "test-results/update-fps.png" });
await page.keyboard.press("F8");
for (const mode of [
  "top",
  "bottom",
  "front",
  "back",
  "left",
  "right",
  "iso",
  "free",
  "perspective",
]) {
  await page.getByLabel("Vista da câmera").selectOption(mode);
  await expect(page.locator("canvas")).toHaveCount(1);
}
console.log("PASS cameras and FPS mode");
await page.getByRole("button", { name: "Novo", exact: true }).click();
await page
  .getByRole("button", { name: /Lua \+ JavaScript Dois exemplos/ })
  .click();
await page.getByTitle("Executar / parar · F5").click();
await expect(
  page.getByText("Permitir scripts deste projeto?", { exact: true }),
).toBeVisible();
await page
  .getByRole("button", { name: "Permitir e executar", exact: true })
  .click();
await page.waitForTimeout(2000);
await page.getByRole("button", { name: /^Console/ }).click();
console.log("LOGS", await page.locator(".console-content").innerText());
await page.keyboard.press("F8");
const result = await page.evaluate(async () => {
  const { World } = await import("/src/engine/World.ts");
  const { ScriptHost } = await import("/src/engine/Scripts.ts");
  const { makeNode } = await import("/src/engine/model.ts");
  const THREE = await import("/node_modules/.vite/deps/three.js");
  const world = new World(new THREE.Scene());
  const lua = makeNode("box", {
    script: {
      language: "lua",
      enabled: true,
      source:
        "function update(dt,time,input) self.x=7; self.ry=self.ry+dt*60 end",
    },
  });
  const js = makeNode("box", {
    script: {
      language: "javascript",
      enabled: true,
      source: "function update(dt,time,input){self.x=-7;self.y=2;}",
    },
  });
  world.load(
    { id: "s", name: "s", nodes: [lua, js] },
    { background: "#202a30", gravity: 0 },
    true,
  );
  const logs = [];
  const host = new ScriptHost(world, (t) => logs.push(t));
  host.start();
  const timer = setInterval(() => {
    world.update(1 / 60, new Set());
    host.update(1 / 60, new Set());
  }, 16);
  await new Promise((r) => setTimeout(r, 1600));
  clearInterval(timer);
  const data = {
    lua: world.objects.get(lua.id).position.x,
    js: world.objects.get(js.id).position.x,
    angle: world.objects.get(lua.id).rotation.y,
    logs,
  };
  host.stop();
  world.dispose();
  return data;
});
console.log("SCRIPT RESULT", result);
if (result.lua !== 7 || result.js !== -7)
  throw new Error("Scripts did not execute");
if (errors.length) throw new Error(errors.join("\n"));
await browser.close();
console.log("UPDATE SMOKE PASSED");
