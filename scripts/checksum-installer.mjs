import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
const directory = "dist/windows";
const installers = (await readdir(directory)).filter((name) =>
  name.endsWith("-Setup.exe"),
);
if (!installers.length)
  throw new Error(
    "Nenhum instalador encontrado. Execute npm run desktop:win primeiro.",
  );
const lines = [];
for (const name of installers) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path.join(directory, name)))
    hash.update(chunk);
  lines.push(`${hash.digest("hex")}  ${name}`);
}
await writeFile(
  path.join(directory, "SHA256SUMS.txt"),
  lines.join("\n") + "\n",
);
await copyFile(
  "packaging/LEIA-ME-WINDOWS.txt",
  path.join(directory, "LEIA-ME-WINDOWS.txt"),
);
console.log(lines.join("\n"));
