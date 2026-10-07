import type { Node3D } from "../engine/model";
type Script = Node3D["script"];
interface Draft {
  base: string;
  script: Script;
}
const drafts = new Map<string, Draft>();
const signature = (script: Script) =>
  `${script.language}\0${script.enabled}\0${script.source}`;
const key = (scope: string, node: Node3D) => `${scope}/${node.id}`;
export function readScriptDraft(scope: string, node: Node3D) {
  const id = key(scope, node),
    draft = drafts.get(id);
  if (draft && draft.base === signature(node.script))
    return { script: { ...draft.script }, dirty: true };
  drafts.delete(id);
  return { script: { ...node.script }, dirty: false };
}
export function rememberScriptDraft(
  scope: string,
  node: Node3D,
  script: Script,
) {
  const id = key(scope, node),
    dirty = signature(node.script) !== signature(script);
  drafts.delete(id);
  if (dirty)
    drafts.set(id, { base: signature(node.script), script: { ...script } });
  while (drafts.size > 32) drafts.delete(drafts.keys().next().value!);
  return dirty;
}
export function clearScriptDraft(scope: string, node: Node3D) {
  drafts.delete(key(scope, node));
}
