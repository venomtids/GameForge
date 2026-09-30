import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  readdir,
  mkdtemp,
  access,
  appendFile,
  writeFile,
  mkdir,
} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
if (process.platform !== "win32")
  throw new Error("Este smoke test do instalador requer Windows.");
const directory = path.resolve("dist/windows");
const installers = (await readdir(directory)).filter((n) =>
  n.endsWith("-Setup.exe"),
);
if (installers.length !== 1)
  throw new Error("Esperado exatamente um instalador NSIS.");
const installPath = await mkdtemp(
  path.join(os.tmpdir(), "GameForge-installed-"),
);
// NSIS /D must be the final argument. Assisted silent install does not auto-launch the app.
await promisify(execFile)(
  path.join(directory, installers[0]),
  ["/S", `/D=${installPath}`],
  { timeout: 120000, windowsHide: true },
);
const executable = path.join(installPath, "GameForge Studio.exe");
for (const file of [
  executable,
  path.join(installPath, "resources/app.asar"),
  path.join(installPath, "resources/THIRD-PARTY-NOTICES.txt"),
  path.join(
    installPath,
    "resources/Projetos/Studio-0.8/Ilha-Aurora.gameforge.json",
  ),
])
  await access(file);
if (!process.env.GITHUB_ENV)
  throw new Error(
    "GITHUB_ENV é necessário para informar o executável instalado ao próximo passo.",
  );
await appendFile(process.env.GITHUB_ENV, `GAMEFORGE_TEST_EXE=${executable}\n`);
await mkdir("test-results", { recursive: true });
await writeFile(
  "test-results/windows-install08.txt",
  "PASS NSIS silent installation, executable, app.asar, third-party licenses and bundled examples.\n",
);
console.log(
  "PASS NSIS installed executable and packaged resources; native test will launch the INSTALLED app.",
);
