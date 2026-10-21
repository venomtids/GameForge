import { launchBrowser } from "./browser-helper.mjs";
import { expect } from "@playwright/test";
const browser = await launchBrowser({
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto("http://127.0.0.1:5173");
  await page.getByRole("button", { name: "Novo", exact: true }).click();
  await page
    .getByRole("button", { name: /Formas avançadas Mapa-base/ })
    .click();
  await page.locator(".tree-row").filter({ hasText: "Anel" }).click();
  await page.getByRole("button", { name: "Pixel Studio", exact: true }).click();
  await page.getByLabel("Resolução da nova textura").selectOption("16");
  await page.getByRole("button", { name: "Nova textura", exact: true }).click();
  await page.getByLabel("Cor pixel").fill("#ff0088");
  const pixel = page.getByLabel("Pintura pixel a pixel");
  await pixel.click({ position: { x: 8, y: 8 } });
  await page
    .getByRole("button", { name: "Aplicar no objeto 3D", exact: true })
    .click();
  await page.waitForTimeout(650);
  let p = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("gameforge.project.v6")),
  );
  if (
    p.settings.textures[0].pixels[0] !== "#ff0088" ||
    !p.scenes[0].nodes.find((n) => n.kind === "torus").textureId
  )
    throw Error("Pixel painting/attach failed");
  await page.screenshot({ path: "test-results/studio05-pixels.png" });
  await page.getByRole("button", { name: "Interface 2D", exact: true }).click();
  await page.getByRole("button", { name: "+ Botão", exact: true }).click();
  await page.getByLabel("Texto 2D").fill("Meu menu 2D");
  await page.getByLabel("Ação do botão 2D").selectOption("pause");
  await page.getByRole("button", { name: "Pixel Studio", exact: true }).click();
  await page
    .getByRole("button", { name: "Aplicar no elemento 2D", exact: true })
    .click();
  await page.getByRole("button", { name: "Interface 2D", exact: true }).click();
  await page.screenshot({ path: "test-results/studio05-ui.png" });
  await page.getByTitle("Executar / parar · F5").click();
  const button = page.locator(".game-ui button");
  await expect(button).toHaveText("Meu menu 2D");
  await button.click();
  await expect(page.locator(".viewport-label")).toContainText("PAUSADA");
  await page.keyboard.press("F8");
  await page.getByRole("button", { name: "Mundo", exact: true }).click();
  await page.screenshot({ path: "test-results/studio05-world.png" });
  // Both context menu and right-button fly navigation work without changing the gizmo.
  const view = page.locator(".viewport canvas"),
    r = await view.boundingBox();
  await page.mouse.click(r.x + r.width * 0.55, r.y + r.height * 0.45, {
    button: "right",
  });
  await expect(page.locator(".viewport-context")).toBeVisible();
  await page
    .locator(".viewport-context")
    .getByRole("button", { name: "Fechar", exact: true })
    .click();
  const before = await view.screenshot();
  await page.mouse.move(r.x + r.width * 0.5, r.y + r.height * 0.5);
  await page.mouse.down({ button: "right" });
  await page.keyboard.down("w");
  await page.waitForTimeout(500);
  await page.keyboard.up("w");
  await page.mouse.move(r.x + r.width * 0.5 + 90, r.y + r.height * 0.5 + 20, {
    steps: 10,
  });
  await page.mouse.up({ button: "right" });
  await expect(page.locator(".viewport-context")).toHaveCount(0);
  const after = await view.screenshot();
  if (before.equals(after)) throw Error("Camera failed to move");
  await page.getByRole("button", { name: "Novo", exact: true }).click();
  await page
    .getByRole("button", { name: /Colinas contínuas Mapa-base/ })
    .click();
  await page
    .locator(".tree-row")
    .filter({ hasText: "Colinas esculpíveis" })
    .click();
  await page.getByLabel("Vista da câmera").selectOption("top");
  await page
    .getByRole("button", { name: "Design & pintura", exact: true })
    .click();
  await page.getByRole("button", { name: "Elevar", exact: true }).click();
  await page.waitForTimeout(650);
  p = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("gameforge.project.v6")),
  );
  const heights = p.scenes[0].nodes[0].surface.heights;
  await view.click({
    position: {
      x: (await view.boundingBox()).width / 2,
      y: (await view.boundingBox()).height / 2,
    },
  });
  await page.waitForTimeout(650);
  p = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("gameforge.project.v6")),
  );
  if (
    !p.scenes[0].nodes[0].surface.heights.some((v, i) => v > heights[i] + 0.01)
  )
    throw Error("Continuous brush did not modify heights");
  await page.screenshot({ path: "test-results/studio05-terrain.png" });
  if (errors.length) throw Error(errors.join("\n"));
  console.log(
    "PASS advanced forms, per-pixel drawing, texture apply to 3D/2D, UI button pauses runtime, sky panel, context actions, RMB+WASD camera, continuous sculpt",
  );
} finally {
  await browser.close();
}
