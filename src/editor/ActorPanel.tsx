import { deformDefaults } from "../engine/features06";
import { jellyPreset, jellyPresets } from "../engine/jelly-presets";
import type { Node3D } from "../engine/model";
export default function ActorPanel({
  node: n,
  disabled,
  onChange,
  onPrimary,
  primary,
}: {
  node: Node3D;
  disabled: boolean;
  onChange: (v: Partial<Node3D>) => void;
  onPrimary: () => void;
  primary: boolean;
}) {
  const actor = (v: Partial<Node3D["actor"]>) =>
    onChange({ actor: { ...n.actor, ...v } });
  return (
    <details
      className="component-section features06"
      open={
        n.actor.humanoid || n.actor.bot !== "off" || n.deform.type !== "none"
      }
    >
      <summary>Personagem, bot & física</summary>
      {(["castShadow", "receiveShadow"] as const).map((k) => (
        <label key={k}>
          <input
            type="checkbox"
            disabled={disabled}
            checked={n[k]}
            onChange={(e) => onChange({ [k]: e.target.checked })}
          />
          {k === "castShadow" ? "Projetar sombra" : "Receber sombra"}
        </label>
      ))}
      {n.kind !== "group" && n.kind !== "terrain" && (
        <>
          <label>
            <input
              type="checkbox"
              checked={n.actor.humanoid}
              disabled={disabled}
              onChange={(e) => actor({ humanoid: e.target.checked })}
            />
            Corpo articulado
          </label>
          {n.actor.humanoid && (
            <>
              <label>
                Pele
                <input
                  aria-label="Cor da pele"
                  type="color"
                  value={n.actor.skin}
                  disabled={disabled}
                  onChange={(e) => actor({ skin: e.target.value })}
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={n.actor.ragdollOnDeath}
                  disabled={disabled}
                  onChange={(e) => actor({ ragdollOnDeath: e.target.checked })}
                />
                Ragdoll ao ficar sem vida
              </label>
            </>
          )}
          {n.behavior === "player" && (
            <button disabled={disabled || primary} onClick={onPrimary}>
              {primary ? "Jogador principal" : "Usar como jogador principal"}
            </button>
          )}
          <label>
            Bot pronto
            <select
              aria-label="Comportamento do bot"
              disabled={disabled || n.behavior === "player"}
              value={n.actor.bot}
              onChange={(e) =>
                onChange({
                  actor: {
                    ...n.actor,
                    bot: e.target.value as Node3D["actor"]["bot"],
                  },
                  ...(e.target.value === "off"
                    ? {}
                    : { physics: "dynamic", restitution: 0 }),
                })
              }
            >
              <option value="off">Desligado / controle por script</option>
              <option value="patrol">Patrulhar</option>
              <option value="follow">Seguir jogador</option>
              <option value="attack">Seguir e atacar</option>
            </select>
          </label>
          {(n.actor.humanoid || n.actor.bot !== "off") &&
            (
              [
                ["health", "Vida inicial", 1, 1000, 1],
                ["animationSpeed", "Ritmo dos passos", 0.1, 3, 0.1],
                ...(n.actor.bot !== "off"
                  ? ([
                      ["radius", "Raio da patrulha", 0.5, 30, 0.5],
                      ["detection", "Alcance de detecção", 1, 60, 1],
                      ["attackRange", "Alcance do ataque", 0.5, 5, 0.1],
                      ["damage", "Dano por ataque", 0, 100, 1],
                      ["cooldown", "Intervalo de ataques (s)", 0.2, 10, 0.1],
                    ] as const)
                  : []),
              ] as const
            ).map(([key, label, min, max, step]) => (
              <label key={key}>
                {label}
                <input
                  aria-label={label}
                  type="number"
                  disabled={disabled}
                  min={min}
                  max={max}
                  step={step}
                  value={n.actor[key]}
                  onChange={(e) => {
                    const v = e.target.valueAsNumber;
                    if (Number.isFinite(v))
                      actor({ [key]: Math.max(min, Math.min(max, v)) });
                  }}
                />
              </label>
            ))}
          <label>
            Simulação deformável
            <select
              aria-label="Simulação deformável"
              disabled={disabled}
              value={n.deform.type}
              onChange={(e) =>
                onChange({
                  deform: {
                    ...n.deform,
                    type: e.target.value as Node3D["deform"]["type"],
                  },
                  ...(e.target.value === "none" ||
                  (e.target.value === "jelly" && n.physics === "static")
                    ? {}
                    : { physics: "dynamic" }),
                })
              }
            >
              <option value="none">Corpo rígido normal</option>
              <option value="ragdoll">Ragdoll · juntas físicas</option>
              <option value="jelly">Gelatina · corpo elástico</option>
            </select>
          </label>
          {n.deform.type === "jelly" && (
            <div
              style={{
                display: "flex",
                gap: 6,
                flexWrap: "wrap",
                marginBottom: 8,
              }}
            >
              {(Object.keys(jellyPresets) as (keyof typeof jellyPresets)[]).map(
                (key) => (
                  <button
                    key={key}
                    style={{ flex: "1 1 74px" }}
                    disabled={disabled}
                    aria-label={`Gelatina ${jellyPresets[key].label.toLowerCase()}`}
                    onClick={() =>
                      onChange({ deform: { ...n.deform, ...jellyPreset(key) } })
                    }
                  >
                    {jellyPresets[key].label}
                  </button>
                ),
              )}
            </div>
          )}
          {n.deform.type === "jelly" &&
            (
              [
                ["stiffness", "Rigidez das molas", 5, 180, 5],
                ["damping", "Amortecimento", 0.1, 8, 0.1],
                ["volume", "Recuperação de volume", 0, 1, 0.05],
                ["maxStretch", "Limite de esticamento", 1.1, 2.5, 0.05],
                ["intensity", "Intensidade da gelatina", 0, 3, 0.1],
                ["movementInfluence", "Reação ao movimento", 0, 4, 0.1],
                ["distanceFalloff", "Distribuição pelo pivô", 0.1, 4, 0.1],
                ["radiusConstraint", "Preservação do raio", 0, 1, 0.05],
                ["performance", "Economia da malha", 0, 1, 0.1],
                ["fluidity", "Fluidez da gota (confinada)", 0, 1, 0.05],
              ] as const
            ).map(([key, label, min, max, step]) => (
              <label key={key}>
                {label}
                <input
                  type="number"
                  aria-label={label}
                  disabled={disabled}
                  min={min}
                  max={max}
                  step={step}
                  value={n.deform[key] ?? deformDefaults[key]}
                  onChange={(e) => {
                    const v = e.target.valueAsNumber;
                    if (Number.isFinite(v))
                      onChange({
                        deform: {
                          ...n.deform,
                          [key]: Math.max(min, Math.min(max, v)),
                        },
                      });
                  }}
                />
              </label>
            ))}
          {n.deform.type === "jelly" && (
            <>
              {(["maintainRadius", "useLOD", "surfaceCollision"] as const).map(
                (key) => (
                  <label className="check" key={key}>
                    <input
                      type="checkbox"
                      aria-label={
                        key === "useLOD"
                          ? "LOD automático da gelatina"
                          : key === "surfaceCollision"
                            ? "Contato por triângulos deformados"
                            : "Manter raio da gelatina"
                      }
                      disabled={disabled}
                      checked={n.deform[key] ?? deformDefaults[key] ?? true}
                      onChange={(e) =>
                        onChange({
                          deform: { ...n.deform, [key]: e.target.checked },
                        })
                      }
                    />
                    {key === "useLOD"
                      ? "LOD automático · só detalhe visual"
                      : "Manter raio em torno do pivô"}
                  </label>
                ),
              )}
              {(["lodNear", "lodFar"] as const).map((key) => (
                <label key={key}>
                  {key === "lodNear" ? "LOD próximo" : "LOD distante"}
                  <input
                    type="number"
                    aria-label={
                      key === "lodNear" ? "LOD próximo" : "LOD distante"
                    }
                    min={key === "lodNear" ? 1 : 10}
                    max={key === "lodNear" ? 50 : 200}
                    disabled={disabled}
                    value={n.deform[key] ?? deformDefaults[key]}
                    onChange={(e) => {
                      if (!Number.isFinite(e.target.valueAsNumber)) return;
                      const v =
                        key === "lodNear"
                          ? Math.min(n.deform.lodFar ?? 80, 51) - 1
                          : Math.max(n.deform.lodNear ?? 14, 9) + 1;
                      onChange({
                        deform: {
                          ...n.deform,
                          [key]:
                            key === "lodNear"
                              ? Math.max(1, Math.min(v, e.target.valueAsNumber))
                              : Math.min(
                                  200,
                                  Math.max(v, e.target.valueAsNumber),
                                ),
                        },
                      });
                    }}
                  />
                </label>
              ))}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: 6,
                }}
              >
                {(["X", "Y", "Z"] as const).map((axis, i) => (
                  <label key={axis}>
                    Pivô {axis}
                    <input
                      type="number"
                      aria-label={`Pivô da gelatina ${axis}`}
                      min={-2}
                      max={2}
                      step={0.1}
                      disabled={disabled}
                      value={n.deform.pivot?.[i] ?? 0}
                      onChange={(e) => {
                        if (!Number.isFinite(e.target.valueAsNumber)) return;
                        const pivot: [number, number, number] = [
                          ...(n.deform.pivot ?? [0, 0, 0]),
                        ];
                        pivot[i] = Math.max(
                          -2,
                          Math.min(2, e.target.valueAsNumber),
                        );
                        onChange({ deform: { ...n.deform, pivot } });
                      }}
                    />
                  </label>
                ))}
              </div>
              {n.behavior !== "player" && !n.actor.humanoid && (
                <label className="check">
                  <input
                    type="checkbox"
                    aria-label="Plataforma de gelatina ancorada"
                    disabled={disabled}
                    checked={n.physics === "static"}
                    onChange={(e) =>
                      onChange({
                        physics: e.target.checked ? "static" : "dynamic",
                      })
                    }
                  />
                  Plataforma ancorada · apoio sólido
                </label>
              )}
              <small>
                Volume dividido em 6 tetraedros XPBD (FEM simplificado); Fluidez
                produz uma gota viscosa confinada, não água/fluido livre. O
                contato por triângulos complementa colisores existentes para
                gelatinas livres e o jogador; plataformas ainda usam apoio
                sólido plano.
              </small>
              <small>
                {n.behavior === "player" || n.actor.humanoid
                  ? "Colisor estável + articulações e vértices com molas. Acelerar, parar, virar, saltar e aterrissar fazem o corpo oscilar. Pés protegidos."
                  : n.physics === "static"
                    ? "Mais mole: cede ao peso, balança e recebe impactos localizados. Restituição ≥ 0,4 ativa impulso. O topo mantém um apoio plano aproximado, sem atravessar os pés."
                    : "Forma original preservada: 8 pontos físicos + molas por vértice, inércia de movimento/rotação, raio e volume. LOD reduz só o detalhe, nunca a colisão."}
              </small>
            </>
          )}
          <small>
            Velocidade: use o campo Speed / Velocidade do componente. Bots usam
            direção local, não navegação por malha. Ragdolls: 6 corpos; gelatina
            livre/ancorada: 8 partículas / 28 molas. Máximo de 12 rigs
            físicos/elásticos ativos, incluindo jogadores de gelatina. R renasce
            o jogador.
          </small>
        </>
      )}
    </details>
  );
}
