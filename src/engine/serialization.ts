import type { Project } from "./model";
export const MAX_PROJECT_BYTES = 8_000_000;
const encoder = new TextEncoder();
/** Pretty JSON is convenient, but must still fit the same import limit. Fall back to compact JSON. */
export function serializeProject(project: Project, pretty = false) {
  let content = JSON.stringify(project, null, pretty ? 2 : undefined);
  if (pretty && encoder.encode(content).byteLength > MAX_PROJECT_BYTES)
    content = JSON.stringify(project);
  if (encoder.encode(content).byteLength > MAX_PROJECT_BYTES)
    throw new Error(
      "O projeto excede 8 MB. Reduza cenas, texturas ou resolução de terrenos antes de salvar.",
    );
  return content;
}
export function encodeProject(project: Project) {
  const bytes = encoder.encode(serializeProject(project));
  let binary = "";
  for (let i = 0; i < bytes.length; i += 32768)
    binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(binary);
}
export function decodeProject(encoded: string) {
  if (encoded.length > Math.ceil(MAX_PROJECT_BYTES / 3) * 4 + 4)
    throw new Error("Projeto exportado excede 8 MB.");
  const binary = atob(encoded),
    bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
