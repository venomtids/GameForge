import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Prepara `dist/goreforge-desktop`: a pasta que o electron-builder empacota.
 *
 * Só entra o que o usuário final precisa — o jogo (arquivo único), o processo
 * principal do Electron, o ícone e um package.json próprio (com `main`). Nenhum
 * node_modules de desenvolvimento e nenhuma dependência de runtime.
 *
 *   npm run installer:goreforge:desktop
 */
const root = process.cwd();
const destino = path.join(root, "dist/goreforge-desktop");
const jogo = path.join(root, "entregas/goreforge.html");
const pacote = JSON.parse(
  await readFile(path.join(root, "package.json"), "utf8"),
);

const info = await readFile(jogo).catch(() => null);
if (!info || info.length < 300_000)
  throw new Error(
    "entregas/goreforge.html não existe (ou está pequeno demais): rode `npm run build:goreforge` antes.",
  );

await rm(destino, { recursive: true, force: true });
await mkdir(path.join(destino, "desktop"), { recursive: true });
await mkdir(path.join(destino, "packaging"), { recursive: true });

// jogo + processo principal + ícone (o ícone também vai no app para a janela)
await cp(jogo, path.join(destino, "goreforge.html"));
await cp(
  path.join(root, "desktop/goreforge-main.cjs"),
  path.join(destino, "desktop/goreforge-main.cjs"),
);
await cp(
  path.join(root, "packaging/gameforge.ico"),
  path.join(destino, "packaging/gameforge.ico"),
);

// package.json do app empacotado (o electron-builder lê ESTE, não o do estúdio)
await writeFile(
  path.join(destino, "package.json"),
  JSON.stringify(
    {
      name: "gore-forge",
      productName: "GORE FORGE",
      version: pacote.version,
      description:
        "GORE FORGE — sandbox de física, gelatina e gore em primeira pessoa (jogo offline).",
      author: pacote.author,
      license: pacote.license,
      main: "desktop/goreforge-main.cjs",
      private: true,
    },
    null,
    2,
  ) + "\n",
);

console.log(
  `App de desktop preparado em ${path.relative(root, destino)} (jogo + processo principal, sem dependências).`,
);
