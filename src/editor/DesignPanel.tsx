import { materials, type Brush, type BrushMode } from "../engine/design";
import type { Node3D } from "../engine/model";
export default function DesignPanel({
  brush,
  onBrush,
  onTerrain,
  onSmoothTerrain,
  node,
  onArrange,
  onApply,
  disabled,
}: {
  brush: Brush;
  onBrush: (b: Brush) => void;
  onTerrain: () => void;
  onSmoothTerrain: () => void;
  node?: Node3D;
  onArrange: (axis: 0 | 1 | 2, distribute: boolean) => void;
  onApply: () => void;
  disabled: boolean;
}) {
  return (
    <div className="design-panel">
      <section>
        <strong>Design & pintura</strong>
        <p>
          Clique na cena para aplicar. Cada clique pode ser desfeito com Ctrl+Z.
        </p>
        <div className="brush-tools">
          {Object.entries({
            select: "Selecionar",
            paint: "Pintar objeto",
            eyedropper: "Conta-gotas",
            terrainPaint: "Pintar terreno",
            raise: "Elevar",
            lower: "Rebaixar",
            smooth: "Suavizar",
            flatten: "Nivelar",
          }).map(([k, v]) => (
            <button
              key={k}
              disabled={disabled}
              className={brush.mode === k ? "active" : ""}
              onClick={() => onBrush({ ...brush, mode: k as BrushMode })}
            >
              {v}
            </button>
          ))}
        </div>
        <button disabled={disabled} onClick={onSmoothTerrain}>
          + Terreno contínuo 33 × 33
        </button>
        <button disabled={disabled} onClick={onTerrain}>
          + Terreno 8 × 8 (64 blocos)
        </button>
      </section>
      <section>
        <strong>Paleta de materiais</strong>
        <div className="swatches">
          {Object.entries(materials).map(([k, v]) => (
            <button
              key={k}
              title={v.name}
              aria-label={"Material " + v.name}
              disabled={disabled}
              onClick={() =>
                onBrush({
                  ...brush,
                  color: v.color,
                  roughness: v.roughness,
                  metalness: v.metalness,
                })
              }
            >
              <i style={{ background: v.color }} />
              {v.name}
            </button>
          ))}
        </div>
        <label>
          Cor do pincel{" "}
          <input
            type="color"
            aria-label="Cor do pincel"
            disabled={disabled}
            value={brush.color}
            onChange={(e) => onBrush({ ...brush, color: e.target.value })}
          />
        </label>
        <button disabled={disabled || !node} onClick={onApply}>
          Aplicar material à seleção / grupo
        </button>
      </section>
      <section>
        <strong>Pincel de terreno</strong>
        {(
          [
            ["radius", "Raio (unidades locais)", 1, 8, 0.5],
            ["strength", "Força", 0.1, 3, 0.1],
            ["height", "Altura para nivelar", 0.1, 30, 0.1],
          ] as const
        ).map(([k, label, min, max, step]) => (
          <label key={k}>
            {label}
            <input
              aria-label={label}
              type="number"
              min={min}
              max={max}
              step={step}
              value={brush[k]}
              disabled={disabled}
              onChange={(e) =>
                onBrush({
                  ...brush,
                  [k]: Math.max(
                    min,
                    Math.min(max, Number(e.target.value) || min),
                  ),
                })
              }
            />
          </label>
        ))}
        <small>
          Superfície contínua com colisão e pintura por vértice, ou blocos
          antigos. Use vista Superior para pintar.
        </small>
      </section>
      <section>
        <strong>Layout do grupo</strong>
        <p>
          {node?.kind === "group"
            ? node.name
            : "Selecione um grupo. Atua nos filhos diretos desbloqueados."}
        </p>
        {(["X", "Y", "Z"] as const).map((a, i) => (
          <div className="layout-row" key={a}>
            <button
              disabled={disabled || node?.kind !== "group"}
              onClick={() => onArrange(i as 0 | 1 | 2, false)}
            >
              Alinhar {a}
            </button>
            <button
              disabled={disabled || node?.kind !== "group"}
              onClick={() => onArrange(i as 0 | 1 | 2, true)}
            >
              Distribuir {a}
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}
