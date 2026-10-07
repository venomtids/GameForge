import { useState } from "react";
import type { Brush } from "../engine/design";
import type { Node3D } from "../engine/model";
import { terrainDefaults, type TerrainOptions } from "../engine/terrain06";
export default function TerrainPanel({
  brush,
  onBrush,
  node,
  disabled,
  onCreate,
  onGenerate,
}: {
  brush: Brush;
  onBrush: (b: Brush) => void;
  node?: Node3D;
  disabled: boolean;
  onCreate: (o: TerrainOptions) => void;
  onGenerate: (o: TerrainOptions) => void;
}) {
  const [options, setOptions] = useState(terrainDefaults);
  return (
    <div className="terrain-panel">
      <section>
        <strong>Terreno contínuo · gerar</strong>
        <label>
          Formato
          <select
            aria-label="Formato do terreno"
            value={options.preset}
            disabled={disabled}
            onChange={(e) =>
              setOptions({
                ...options,
                preset: e.target.value as TerrainOptions["preset"],
              })
            }
          >
            <option value="flat">Plano</option>
            <option value="hills">Colinas</option>
            <option value="mountains">Montanhas</option>
            <option value="dunes">Dunas</option>
          </select>
        </label>
        <label>
          Resolução
          <select
            aria-label="Resolução do terreno"
            value={options.resolution}
            disabled={disabled}
            onChange={(e) =>
              setOptions({
                ...options,
                resolution: Number(
                  e.target.value,
                ) as TerrainOptions["resolution"],
              })
            }
          >
            {[17, 33, 65].map((n) => (
              <option key={n} value={n}>
                {n} × {n} vértices
              </option>
            ))}
          </select>
        </label>
        {(
          [
            ["size", "Tamanho (m)", 4, 100, 1],
            ["amplitude", "Amplitude", 0, 15, 0.5],
            ["frequency", "Frequência", 0.25, 8, 0.25],
            ["seed", "Semente", 0, 9999, 1],
          ] as const
        ).map(([key, label, min, max, step]) => (
          <label key={key}>
            {label}
            <input
              aria-label={label}
              type="number"
              min={min}
              max={max}
              step={step}
              disabled={disabled}
              value={options[key]}
              onChange={(e) => {
                const v = e.target.valueAsNumber;
                if (Number.isFinite(v))
                  setOptions({
                    ...options,
                    [key]: Math.max(min, Math.min(max, v)),
                  });
              }}
            />
          </label>
        ))}
        <label>
          Cor base
          <input
            type="color"
            aria-label="Cor base do terreno"
            disabled={disabled}
            value={options.color}
            onChange={(e) => setOptions({ ...options, color: e.target.value })}
          />
        </label>
        <button disabled={disabled} onClick={() => onCreate(options)}>
          Criar terreno
        </button>
        <button
          disabled={disabled || !node?.surface}
          onClick={() => {
            if (
              confirm(
                "Regenerar o terreno selecionado? A escultura e a pintura atuais serão substituídas. Ctrl+Z desfaz.",
              )
            )
              onGenerate(options);
          }}
        >
          Regenerar seleção…
        </button>
      </section>
      <section>
        <strong>Pincel · clique e arraste</strong>
        <div className="terrain-modes">
          {(
            [
              ["select", "Selecionar"],
              ["raise", "Elevar"],
              ["lower", "Abaixar"],
              ["smooth", "Suavizar"],
              ["flatten", "Nivelar"],
              ["terrainPaint", "Pintar"],
              ["noise", "Ruído"],
              ["terrace", "Terraços"],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              className={brush.mode === mode ? "active" : ""}
              disabled={disabled}
              onClick={() => onBrush({ ...brush, mode })}
            >
              {label}
            </button>
          ))}
        </div>
        <label>
          Forma
          <select
            aria-label="Forma do pincel"
            disabled={disabled}
            value={brush.shape ?? "circle"}
            onChange={(e) =>
              onBrush({
                ...brush,
                shape: e.target.value as "circle" | "square",
              })
            }
          >
            <option value="circle">Circular</option>
            <option value="square">Quadrado</option>
          </select>
        </label>
        {(
          [
            ["radius", "Raio", 0.5, 20, 0.5, 3],
            ["strength", "Força / opacidade", 0.01, 3, 0.05, 0.5],
            ["hardness", "Dureza", 0, 1, 0.05, 0],
            ["height", "Altura de nivelamento", -20, 40, 0.25, 1],
            ["terraceStep", "Degrau dos terraços", 0.25, 10, 0.25, 1],
            ["seed", "Semente do ruído", 0, 9999, 1, 1],
            ["minHeight", "Altura mínima", -20, 40, 1, -20],
            ["maxHeight", "Altura máxima", -20, 40, 1, 40],
          ] as const
        ).map(([key, label, min, max, step, fallback]) => (
          <label key={key}>
            {label}
            <input
              aria-label={label}
              type="number"
              disabled={disabled}
              min={min}
              max={max}
              step={step}
              value={brush[key] ?? fallback}
              onChange={(e) => {
                let v = e.target.valueAsNumber;
                if (!Number.isFinite(v)) return;
                v = Math.max(min, Math.min(max, v));
                if (key === "minHeight") v = Math.min(v, brush.maxHeight ?? 40);
                if (key === "maxHeight")
                  v = Math.max(v, brush.minHeight ?? -20);
                onBrush({ ...brush, [key]: v });
              }}
            />
          </label>
        ))}
        <label>
          Cor do pincel
          <input
            type="color"
            aria-label="Cor do pincel de terreno"
            disabled={disabled}
            value={brush.color}
            onChange={(e) => onBrush({ ...brush, color: e.target.value })}
          />
        </label>
      </section>
      <section>
        <strong>{node?.surface ? node.name : "Como usar"}</strong>
        <p>
          Crie ou selecione um terreno. Escolha um pincel e arraste com o botão
          esquerdo sobre a superfície. Um traço inteiro equivale a uma ação de
          desfazer.
        </p>
        <p>
          Ctrl+Z desfaz • F enquadra • botão direito navega • Esc cancela o
          traço.
        </p>
        <small>
          Geração determinística por semente. A grade de 65 × 65 dá mais
          detalhes. Alturas: −20 a 40. Máscara de altura limita o resultado do
          pincel. Use escala X = Z para manter a colisão fiel. Essa ferramenta
          não altera o volume de blocos do Bosque Vivo.
        </small>
        {node?.surface && (
          <p>
            {node.surface.resolution} × {node.surface.resolution} ·{" "}
            {node.surface.size} m
          </p>
        )}
      </section>
    </div>
  );
}
