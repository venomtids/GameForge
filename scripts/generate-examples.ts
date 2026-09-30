import { writeFileSync } from "node:fs";
import { studioProject, parkourProject } from "../src/engine/templates";
import { parseProject } from "../src/engine/model";
for (const [name, project] of [
  ["Atelie-GameForge-v0.4", studioProject()],
  ["Skyline-Parkour-v0.4", parkourProject()],
] as const) {
  const data = JSON.stringify(parseProject(JSON.stringify(project)), null, 2);
  writeFileSync(`examples/${name}.gameforge.json`, data);
}
const example = studioProject().scenes[0].nodes.find((n) => n.script.enabled)!;
writeFileSync(
  "examples/escultura-interativa.lua",
  example.script.source + "\n",
);
