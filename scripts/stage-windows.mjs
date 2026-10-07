import { cp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
const root = process.cwd(),
  destination = path.join(root, "dist/desktop-app");
await rm(destination, { recursive: true, force: true });
await mkdir(path.join(destination, "dist"), { recursive: true });
for (const file of ["index.html", "player.html", "assets", "gameforge.png"])
  await cp(
    path.join(root, "dist", file),
    path.join(destination, "dist", file),
    { recursive: true },
  );
await cp(path.join(root, "desktop"), path.join(destination, "desktop"), {
  recursive: true,
});
const p = JSON.parse(await readFile("package.json", "utf8"));
await writeFile(
  path.join(destination, "package.json"),
  JSON.stringify(
    {
      name: p.name,
      version: p.version,
      description: p.description,
      author: p.author,
      main: "desktop/main.cjs",
      private: true,
    },
    null,
    2,
  ),
);
console.log(
  "App de produção preparado: renderer compilado, fonte local e IPC isolado. Sem node_modules de desenvolvimento.",
);
