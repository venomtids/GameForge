import { mkdir, writeFile } from "node:fs/promises";
import { templateProject } from "../src/engine/studio08-templates";
import { serializeProject } from "../src/engine/serialization";
await mkdir("examples/studio08", { recursive: true });
for (const [id, file] of [
  ["aurora", "Ilha-Aurora"],
  ["animation", "Motion-Lab"],
  ["baseplate", "Baseplate"],
  ["jelly", "Jelly-Jump-Gelatina"],
] as const) {
  const project = templateProject(id);
  await writeFile(
    `examples/studio08/${file}.gameforge.json`,
    serializeProject(project, true),
  );
  console.log(`${file}: ${project.scenes[0].nodes.length} objetos`);
}
