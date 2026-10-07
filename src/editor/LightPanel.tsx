import { lightDefaults, type LightSettings } from "../engine/features07";
import type { Node3D } from "../engine/model";
export default function LightPanel({
  node,
  disabled,
  onChange,
}: {
  node: Node3D;
  disabled: boolean;
  onChange: (v: Partial<Node3D>) => void;
}) {
  const light: LightSettings = { ...lightDefaults, ...node.light },
    set = (patch: Partial<LightSettings>) =>
      onChange({ light: { ...light, ...patch } }),
    number = (
      label: string,
      key: keyof LightSettings,
      min: number,
      max: number,
      step = 1,
    ) => (
      <label key={key}>
        {label}
        <input
          type="range"
          aria-label={label}
          disabled={disabled || light.type === "none"}
          min={min}
          max={max}
          step={step}
          value={light[key] as number}
          onChange={(e) => set({ [key]: Number(e.target.value) } as never)}
        />
        <output>{(light[key] as number).toFixed(step < 1 ? 2 : 0)}</output>
      </label>
    );
  return (
    <details
      className="component-section features07"
      open={node.light.type !== "none"}
    >
      <summary>Luz do nó</summary>
      <label>
        Tipo de luz
        <select
          aria-label="Tipo de luz"
          disabled={disabled}
          value={light.type}
          onChange={(e) =>
            set({ type: e.target.value as LightSettings["type"] })
          }
        >
          <option value="none">Sem luz</option>
          <option value="point">Ponto (lâmpada)</option>
          <option value="spot">Holofote (cone)</option>
        </select>
      </label>
      <label>
        Cor da luz
        <input
          type="color"
          aria-label="Cor da luz"
          disabled={disabled || light.type === "none"}
          value={light.color}
          onChange={(e) => set({ color: e.target.value })}
        />
      </label>
      <label>
        <input
          type="checkbox"
          aria-label="Luz acesa"
          disabled={disabled || light.type === "none"}
          checked={light.enabled}
          onChange={(e) => set({ enabled: e.target.checked })}
        />
        Luz acesa
      </label>
      {number("Intensidade", "intensity", 0, 60, 0.5)}
      {number("Alcance", "distance", 0, 120, 1)}
      {number("Queda (decay)", "decay", 0, 3, 0.1)}
      {light.type === "spot" && number("Ângulo", "angle", 5, 90, 1)}
      {light.type === "spot" &&
        number("Suavidade (penumbra)", "penumbra", 0, 1, 0.05)}
      {number("Pisca (0–1)", "flicker", 0, 1, 0.05)}
      {number("Velocidade da piscada", "flickerSpeed", 0.5, 30, 0.5)}
      <label>
        <input
          type="checkbox"
          aria-label="Sombras da luz"
          disabled={disabled || light.type === "none"}
          checked={light.shadows}
          onChange={(e) => set({ shadows: e.target.checked })}
        />
        Sombras da luz (mais caro)
      </label>
      <p className="subtle">
        Scripts: engine.light(self.id, {"{"} intensity: 0 {"}"}) · engine.flicker(self.id, 3,
        0.7)
      </p>
    </details>
  );
}
