import { useState } from "react";
import {
  AlignHorizontalJustifyCenter,
  Copy,
  Folder,
  Layers3,
  Move,
  Trash2,
} from "lucide-react";
import type { Node3D, Vec3 } from "../engine/model";
export type SelectionAction =
  | "group"
  | "ungroup"
  | "duplicate"
  | "delete"
  | "align"
  | "distribute"
  | "translate";
export default function MultiSelectionPanel({
  nodes,
  disabled,
  onAction,
  onPatch,
}: {
  nodes: Node3D[];
  disabled: boolean;
  onAction: (
    action: SelectionAction,
    axis?: 0 | 1 | 2,
    mode?: "min" | "center" | "max",
    delta?: Vec3,
  ) => void;
  onPatch: (patch: Partial<Node3D>) => void;
}) {
  const [axis, setAxis] = useState<0 | 1 | 2>(0),
    [delta, setDelta] = useState<Vec3>([0, 0, 0]);
  const editable = nodes.filter((n) => !n.locked);
  return (
    <div className="multi-inspector">
      <div className="multi-heading">
        <span>
          <Layers3 size={24} />
        </span>
        <h3>{nodes.length} objetos selecionados</h3>
        <p>Edite em conjunto. Uma alteração, um desfazer.</p>
      </div>
      <fieldset disabled={disabled}>
        <div className="multi-actions">
          <button onClick={() => onAction("group")} disabled={!editable.length}>
            <Folder size={14} /> Agrupar
          </button>
          <button onClick={() => onAction("duplicate")}>
            <Copy size={14} /> Duplicar
          </button>
          <button onClick={() => onAction("delete")}>
            <Trash2 size={14} /> Excluir
          </button>
        </div>
        <section>
          <h4>
            <Move size={13} /> Deslocar seleção
          </h4>
          <div className="vector-inputs">
            {["X", "Y", "Z"].map((label, i) => (
              <label
                key={label}
                className={`vector vector-${label.toLowerCase()}`}
              >
                <span>{label}</span>
                <input
                  type="number"
                  aria-label={`Deslocamento da seleção ${label}`}
                  value={delta[i]}
                  min={-1000}
                  max={1000}
                  step={0.5}
                  onChange={(e) => {
                    const next = [...delta] as Vec3;
                    next[i] = Math.max(
                      -1000,
                      Math.min(1000, Number(e.target.value) || 0),
                    );
                    setDelta(next);
                  }}
                />
              </label>
            ))}
          </div>
          <button
            className="outline-button"
            onClick={() => {
              onAction("translate", undefined, undefined, delta);
              setDelta([0, 0, 0]);
            }}
          >
            Aplicar deslocamento
          </button>
          <small>
            Valores locais. Para girar ou escalar em conjunto, agrupe primeiro.
          </small>
        </section>
        <section>
          <h4>
            <AlignHorizontalJustifyCenter size={13} /> Alinhar e distribuir
          </h4>
          <label className="property">
            Eixo
            <select
              aria-label="Eixo do alinhamento"
              value={axis}
              onChange={(e) => setAxis(Number(e.target.value) as 0 | 1 | 2)}
            >
              <option value={0}>X · horizontal</option>
              <option value={1}>Y · altura</option>
              <option value={2}>Z · profundidade</option>
            </select>
          </label>
          <div className="alignment-buttons">
            {(["min", "center", "max"] as const).map((mode, i) => (
              <button key={mode} onClick={() => onAction("align", axis, mode)}>
                {["Mínimo", "Centro", "Máximo"][i]}
              </button>
            ))}
          </div>
          <button
            className="outline-button"
            disabled={nodes.length < 3}
            onClick={() => onAction("distribute", axis)}
          >
            Distribuir igualmente
          </button>
          <small>
            Usa os centros de objetos com o mesmo pai. Bloqueados são
            protegidos.
          </small>
        </section>
        <section>
          <h4>Aparência e estado</h4>
          <label className="property">
            Cor
            <input
              type="color"
              aria-label="Cor da seleção"
              defaultValue={nodes[0].color}
              disabled={!editable.length}
              onChange={(e) => onPatch({ color: e.target.value })}
            />
          </label>
          <div className="multi-actions">
            <button
              disabled={!editable.length}
              onClick={() => onPatch({ physics: "static" })}
            >
              Ancorar
            </button>
            <button
              disabled={!editable.length}
              onClick={() => onPatch({ visible: false })}
            >
              Ocultar
            </button>
            <button onClick={() => onPatch({ locked: true })}>Bloquear</button>
            <button onClick={() => onPatch({ locked: false })}>
              Desbloquear
            </button>
          </div>
        </section>
      </fieldset>
      <p className="multi-selection-tip">
        Ctrl / ⌘ ou Shift + clique para selecionar mais objetos. Ctrl+G agrupa.
        Ctrl+Shift+G desagrupa.
      </p>
    </div>
  );
}
