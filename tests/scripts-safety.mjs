import { launchBrowser } from "./browser-helper.mjs";

const browser = await launchBrowser({
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage();
await page.goto("http://127.0.0.1:5173");
const result = await page.evaluate(async () => {
  const { World } = await import("/src/engine/World.ts"),
    { ScriptHost } = await import("/src/engine/Scripts.ts"),
    { makeNode } = await import("/src/engine/model.ts"),
    THREE = await import("/node_modules/.vite/deps/three.js");
  const run = async (language, source) => {
    const w = new World(new THREE.Scene()),
      n = makeNode("box", { script: { language, source, enabled: true } });
    w.load(
      { id: "s", name: "s", nodes: [n] },
      { background: "#202a30", gravity: 0 },
      true,
    );
    const logs = [];
    const host = new ScriptHost(w, (t) => logs.push(t));
    host.start();
    const timer = setInterval(() => {
      w.update(1 / 60, new Set());
      host.update(1 / 60, new Set());
    }, 16);
    await new Promise((r) => setTimeout(r, 1800));
    clearInterval(timer);
    host.stop();
    w.dispose();
    return logs;
  };
  return {
    lua: await run(
      "lua",
      "function update(dt,time,input) while true do end end",
    ),
    js: await run(
      "javascript",
      "function update(dt,time,input){while(true){}}",
    ),
    syntax: await run("lua", "function update( broken"),
  };
});
console.log(result);
if (
  !result.lua.some((s) => s.includes("50.000")) ||
  !result.js.some((s) => s.includes("tempo excedido")) ||
  !result.syntax.some((s) => s.includes("[script]"))
)
  throw new Error("Guard failed");
await browser.close();
console.log("PASS Lua budget, JavaScript watchdog, syntax errors");
