import {
  readScriptDraft,
  rememberScriptDraft,
  clearScriptDraft,
} from "./script-drafts";
import { commandNames, commandTemplate } from "../engine/commands07";
import CodeEditor from "./CodeEditor";
import { diagnose } from "../engine/diagnostics";
import { useEffect, useMemo, useState, useRef } from "react";
import type { Node3D, ScriptLanguage } from "../engine/model";
export const scriptExamples = {
  lua: '-- Lua 5.3 • self: posição e rotação do nó\nfunction update(dt, time, input)\n  self.ry = self.ry + 45 * dt\n  -- if input.space then engine.log("Espaço!") end\nend',
  javascript:
    '// JavaScript • dt em segundos; rotação em graus\nfunction update(dt, time, input) {\n  self.ry += 45 * dt;\n  // if (input.space) engine.log("Espaço!");\n}',
  none: "",
};
export default function ScriptPanel({
  node,
  scope,
  disabled,
  onApply,
}: {
  node: Node3D | undefined;
  scope: string;
  disabled: boolean;
  onApply: (script: Node3D["script"]) => void;
}) {
  const [language, setLanguage] = useState<ScriptLanguage>("none"),
    [source, setSource] = useState(""),
    [enabled, setEnabled] = useState(true),
    [dirty, setDirty] = useState(false);
  const importFile = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState("");
  const issues = useMemo(() => diagnose(source, language), [source, language]);
  const draftRef = useRef({ language, source, enabled });
  const currentNode = useRef("");
  currentNode.current = `${scope}/${node?.id}`;
  const edit = (patch: Partial<Node3D["script"]>) => {
    if (!node) return;
    const next = { ...draftRef.current, ...patch };
    draftRef.current = next;
    setLanguage(next.language);
    setSource(next.source);
    setEnabled(next.enabled);
    setDirty(rememberScriptDraft(scope, node, next));
  };
  useEffect(() => {
    const draft = node
      ? readScriptDraft(scope, node)
      : {
          script: { language: "none" as const, source: "", enabled: false },
          dirty: false,
        };
    draftRef.current = draft.script;
    setLanguage(draft.script.language);
    setSource(draft.script.source);
    setEnabled(draft.script.enabled);
    setDirty(draft.dirty);
    setFileError("");
  }, [
    scope,
    node?.id,
    node?.script.language,
    node?.script.source,
    node?.script.enabled,
  ]);
  if (!node)
    return (
      <div className="empty-inline">
        Selecione um nó para programar em Lua ou JavaScript.
      </div>
    );
  return (
    <div className="script-panel">
      <div className="script-code">
        <div className="script-head">
          <select
            aria-label="Linguagem do script"
            value={language}
            disabled={disabled}
            onChange={(e) => {
              const l = e.target.value as ScriptLanguage;
              if (
                source.trim() &&
                language !== "none" &&
                l !== language &&
                !confirm(
                  "Trocar a linguagem substitui este rascunho por um exemplo. Continuar?",
                )
              )
                return;
              edit({
                language: l,
                source: scriptExamples[l],
                enabled: l !== "none",
              });
            }}
          >
            <option value="none">Sem script</option>
            <option value="lua">Lua 5.3</option>
            <option value="javascript">JavaScript</option>
          </select>
          <span>
            {node.name}
            {language === "lua" ? ".lua" : ".js"}
            {dirty ? " • não aplicado" : ""}
          </span>
          <label>
            <input
              type="checkbox"
              aria-label="Script habilitado"
              checked={enabled}
              disabled={disabled || language === "none"}
              onChange={(e) => {
                edit({ enabled: e.target.checked });
              }}
            />
            Ativo
          </label>
        </div>
        <div className="quick-commands">
          <label>
            Comandos prontos{" "}
            <select
              aria-label="Comandos prontos"
              disabled={disabled}
              value=""
              onChange={(e) => {
                if (!e.target.value) return;
                if (
                  source.trim() &&
                  !confirm(
                    "Substituir o rascunho do script pelo modelo? O nó só muda ao clicar em Aplicar script.",
                  )
                )
                  return;
                const lang = language === "none" ? "javascript" : language;
                edit({
                  language: lang,
                  source: commandTemplate(
                    e.target.value as keyof typeof commandNames,
                    lang,
                  ),
                  enabled: true,
                });
              }}
            >
              <option value="">Escolha um modelo editável…</option>
              {Object.entries(commandNames).map(([key, name]) => (
                <option value={key} key={key}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <small>
            Lua + JavaScript · andar / girar continuam até engine.stop. Bots e
            impulso exigem corpo dinâmico.
          </small>
        </div>
        <CodeEditor
          source={source}
          language={language}
          disabled={disabled || language === "none"}
          onChange={(text) => {
            edit({ source: text });
          }}
        />
        <div
          className={"code-diagnostics " + (issues.length ? "has-errors" : "")}
          role="status"
        >
          {issues.length
            ? issues.map((d, i) => (
                <div key={i}>
                  Erro · linha {d.line}, coluna {d.column}: {d.message}
                </div>
              ))
            : "✓ Nenhum erro de sintaxe detectado · erros de execução aparecem no Console"}
          {fileError && <div>{fileError}</div>}
        </div>
      </div>
      <div className="script-guide">
        <strong>API de scripts · 0.8</strong>
        <p>
          <code>start() / update(dt, time, input)</code>
          <br />
          <code>self.x / y / z</code> · posição local
          <br />
          <code>self.rx / ry / rz</code> · graus
          <br />
          <code>self.id / health (leitura)</code>
          <br />
          <code>engine.walk(id, dx, dz, velocidade)</code>
          <br />
          <code>engine.rotate(id, grausPorSegundo)</code>
          <br />
          <code>engine.stop(id) / bot(id, modo)</code>
          <br />
          <code>engine.damage(id, valor)</code>
          <br />
          <code>engine.ragdoll(id, true)</code>
          <br />
          <code>engine.impulse(id, x, y, z)</code>
          <br />
          <code>self.color / visible</code>
          <br />
          <code>self.vx / vy / vz / grounded</code>
          <br />
          <code>input.pressed / released</code>
          <br />
          <code>engine.clamp / lerp / distance</code>
          <br />
          <code>engine.log(texto)</code> → Console
          <br />
          JS: <code>engine.get / set / spawn / remove</code>
          <br />
          JS: <code>engine.ui / voxel / store</code>
          <br />
          JS: <code>input.ray / target / events</code>
        </p>
        <small>
          Worker separado, com limite de tempo. Sem API de arquivos/DOM. Execute
          apenas códigos de confiança. Lua 5.3, não Luau/Roblox.
        </small>
        <button
          className="primary"
          disabled={disabled || issues.some((d) => d.severity === "error")}
          onClick={() => {
            onApply({
              language,
              source,
              enabled: language !== "none" && enabled,
            });
            clearScriptDraft(scope, node);
            setDirty(false);
          }}
        >
          Aplicar script
        </button>
        <div className="script-file-actions">
          <input
            hidden
            type="file"
            ref={importFile}
            accept=".lua,.js"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              const target = currentNode.current;
              if (f.size > 256000) {
                setFileError(
                  "Arquivo muito grande. Limite: 256 KB e 128.000 caracteres.",
                );
                return;
              }
              try {
                const text = await f.text();
                if (text.length > 128000)
                  throw new Error("Limite de 128.000 caracteres.");
                if (!/\.(lua|js)$/i.test(f.name))
                  throw new Error("Use .lua ou .js.");
                if (currentNode.current !== target) return;
                edit({
                  language: /\.lua$/i.test(f.name) ? "lua" : "javascript",
                  source: text,
                  enabled: true,
                });
                setFileError("");
              } catch (e) {
                setFileError(String(e));
              }
            }}
          />
          <button
            disabled={disabled}
            onClick={() => importFile.current?.click()}
          >
            Importar .lua / .js
          </button>
          <button
            disabled={language === "none"}
            onClick={async () => {
              const name =
                node.name.replace(/[^a-zA-Z0-9_-]/g, "_") +
                (language === "lua" ? ".lua" : ".js");
              try {
                if (window.gameforgeDesktop && language !== "none") {
                  await window.gameforgeDesktop.save(source, name, language);
                  return;
                }
                const url = URL.createObjectURL(
                  new Blob([source], { type: "text/plain;charset=utf-8" }),
                );
                const a = document.createElement("a");
                a.href = url;
                a.download = name;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              } catch (e) {
                setFileError("Falha ao exportar: " + String(e));
              }
            }}
          >
            Exportar script
          </button>
        </div>
        <small>
          Rascunhos são preservados nesta sessão (até 32 objetos); aplique para
          salvar no projeto. Ctrl+Espaço: sugestões · Ctrl+F: buscar · Tab:
          indentar. Os avisos não garantem ausência de erros de lógica.
        </small>
      </div>
    </div>
  );
}
