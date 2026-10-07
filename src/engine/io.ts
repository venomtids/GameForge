import { encodeProject, serializeProject } from "./serialization";
import { Project, parseProject } from "./model";
declare global {
  interface Window {
    gameforgeDesktop?: {
      platform: string;
      onCommand?: (callback: (command: string) => void) => () => void;
      onProject?: (callback: (content: string) => void) => () => void;
      initialProject?: () => Promise<string | null>;
      autosave?: (content: string) => Promise<void>;
      flushAutosave?: (content: string) => void;
      save: (
        content: string,
        suggested: string,
        kind: "project" | "html" | "lua" | "javascript",
      ) => Promise<{ canceled: boolean; path?: string }>;
      open: () => Promise<{ canceled: boolean; content?: string }>;
    };
  }
}
export function download(
  content: string,
  name: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function saveProject(p: Project) {
  const content = serializeProject(p, true),
    name = `${p.name.replace(/[^\p{L}\p{N}_ -]/gu, "") || "projeto"}.gameforge.json`;
  if (window.gameforgeDesktop)
    return !(await window.gameforgeDesktop.save(content, name, "project"))
      .canceled;
  download(content, name);
  return true;
}
export async function readProject(file: File) {
  if (file.size > 8_000_000) throw new Error("O arquivo excede 8 MB.");
  return parseProject(await file.text());
}
export async function exportGame(p: Project) {
  const response = await fetch("./player.html");
  if (!response.ok)
    throw new Error(
      "Runtime de exportação não encontrado. Execute npm run build.",
    );
  const template = await response.text();
  const marker = "__GAMEFORGE_PROJECT_DATA__";
  if (!template.includes(marker))
    throw new Error("Runtime de exportação inválido.");
  const encoded = encodeProject(p);
  const html = template.replace(marker, encoded);
  if (window.gameforgeDesktop)
    return !(await window.gameforgeDesktop.save(html, "meu-jogo.html", "html"))
      .canceled;
  download(html, "meu-jogo.html", "text/html");
  return true;
}
