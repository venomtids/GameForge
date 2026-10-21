import type { Project } from "../engine/model";
import { shadowDefaults } from "../engine/features06";
export default function ShadowPanel({
  settings,
  onChange,
  disabled,
}: {
  settings: Project["settings"];
  onChange: (s: Project["settings"]) => void;
  disabled: boolean;
}) {
  const s = { ...shadowDefaults, ...settings.shadows };
  const patch = (v: Partial<typeof s>) =>
    onChange({ ...settings, shadows: { ...s, ...v } });
  return (
    <section className="shadow-panel">
      <strong>Sombras & iluminação</strong>
      {(["enabled", "follow"] as const).map((k) => (
        <label key={k}>
          <input
            type="checkbox"
            disabled={disabled}
            checked={s[k]}
            onChange={(e) => patch({ [k]: e.target.checked })}
          />
          {k === "enabled" ? "Ativar sombras" : "Acompanhar câmera / jogador"}
        </label>
      ))}
      <label>
        Filtro
        <select
          aria-label="Filtro de sombras"
          disabled={disabled}
          value={s.filter}
          onChange={(e) => patch({ filter: e.target.value as typeof s.filter })}
        >
          <option value="soft">PCF suave · recomendado</option>
          <option value="vsm">VSM · desfoque ajustável</option>
        </select>
      </label>
      <label>
        Resolução
        <select
          aria-label="Resolução de sombras"
          disabled={disabled}
          value={s.resolution}
          onChange={(e) =>
            patch({ resolution: Number(e.target.value) as typeof s.resolution })
          }
        >
          {[512, 1024, 2048, 4096].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>
      {(
        [
          ["coverage", "Cobertura (m)", 10, 150, 1],
          ["softness", "Desfoque VSM", 0, 8, 0.5],
          ["intensity", "Intensidade da sombra", 0, 1, 0.05],
          ["bias", "Bias", -0.01, 0.01, 0.0001],
          ["normalBias", "Normal bias", 0, 0.2, 0.005],
          ["sunPower", "Luz do sol", 0, 8, 0.1],
          ["ambientPower", "Luz ambiente", 0, 5, 0.1],
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
            disabled={disabled || (key === "softness" && s.filter !== "vsm")}
            value={s[key]}
            onChange={(e) => {
              const v = e.target.valueAsNumber;
              if (Number.isFinite(v))
                patch({ [key]: Math.max(min, Math.min(max, v)) });
            }}
          />
        </label>
      ))}
      <small>
        Menor cobertura aumenta a definição. Bias corrige manchas; valores altos
        descolam sombras. O desfoque só atua no VSM, que pode deixar passar luz
        em paredes finas. 4096 exige mais da GPU.
      </small>
      <button disabled={disabled} onClick={() => patch(shadowDefaults)}>
        Restaurar iluminação
      </button>
    </section>
  );
}
