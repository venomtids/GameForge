import ShadowPanel from "./ShadowPanel";
import { torchDefaults } from "../engine/features07";
import type { Project, SceneData } from "../engine/model";
import type { VoxelConfig } from "../engine/studio-model";
export function blankVolume(): VoxelConfig {
  const size = 32,
    blocks = Array(size * size * 24).fill(0);
  for (let y = 0; y < 3; y++)
    for (let z = 0; z < size; z++)
      for (let x = 0; x < size; x++)
        blocks[x + size * (z + size * y)] = y === 2 ? 1 : 2;
  return {
    size,
    height: 24,
    blocks,
    palette: [
      { name: "Grama", color: "#6b984e", solid: true, textureId: null },
      { name: "Terra", color: "#936b4d", solid: true, textureId: null },
      { name: "Pedra", color: "#8e979a", solid: true, textureId: null },
    ],
  };
}
export default function WorldPanel({
  settings,
  scene,
  onSettings,
  onVoxel,
  block,
  onBlock,
  disabled,
}: {
  settings: Project["settings"];
  scene: SceneData;
  onSettings: (s: Project["settings"]) => void;
  onVoxel: (v: VoxelConfig) => void;
  block: number;
  onBlock: (b: number) => void;
  disabled: boolean;
}) {
  const sky = settings.sky ?? {
    enabled: false,
    sunElevation: 45,
    sunAzimuth: 30,
    clouds: true,
  };
  return (
    <div className="world-panel">
      <ShadowPanel
        settings={settings}
        disabled={disabled}
        onChange={onSettings}
      />
      <section>
        <strong>Céu & sol</strong>
        <label>
          <input
            type="checkbox"
            disabled={disabled}
            checked={sky.enabled}
            onChange={(e) =>
              onSettings({
                ...settings,
                sky: { ...sky, enabled: e.target.checked },
              })
            }
          />
          Céu atmosférico
        </label>
        <label>
          <input
            type="checkbox"
            disabled={disabled}
            checked={sky.clouds}
            onChange={(e) =>
              onSettings({
                ...settings,
                sky: { ...sky, clouds: e.target.checked },
              })
            }
          />
          Nuvens
        </label>
        {(["sunElevation", "sunAzimuth"] as const).map((k) => (
          <label key={k}>
            {k === "sunElevation" ? "Altura do sol" : "Direção do sol"}
            <input
              disabled={disabled}
              aria-label={k}
              type="range"
              min={k === "sunElevation" ? 0 : -180}
              max={k === "sunElevation" ? 90 : 180}
              value={sky[k]}
              onChange={(e) =>
                onSettings({
                  ...settings,
                  sky: { ...sky, [k]: Number(e.target.value) },
                })
              }
            />
            {sky[k]}°
          </label>
        ))}
      </section>
      <section>
        <strong>Volume de blocos · ferramenta genérica</strong>
        {!scene.voxel ? (
          <button disabled={disabled} onClick={() => onVoxel(blankVolume())}>
            Criar volume editável 32 × 24 × 32
          </button>
        ) : (
          <>
            <p>
              {scene.voxel.size} × 24 × {scene.voxel.size} · botão direito sobre
              um bloco: colocar/remover.
            </p>
            <label>
              Bloco para colocar
              <select
                aria-label="Bloco ativo"
                value={block}
                onChange={(e) => onBlock(Number(e.target.value))}
              >
                {scene.voxel.palette.map((m, i) => (
                  <option value={i + 1} key={i}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Textura do bloco
              <select
                aria-label="Textura do bloco"
                disabled={disabled}
                value={scene.voxel.palette[block - 1]?.textureId ?? ""}
                onChange={(e) =>
                  onVoxel({
                    ...scene.voxel!,
                    palette: scene.voxel!.palette.map((m, i) =>
                      i === block - 1
                        ? { ...m, textureId: e.target.value || null }
                        : m,
                    ),
                  })
                }
              >
                <option value="">Cor sólida</option>
                {settings.textures?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <small>
              Geometria e colisão são da engine. Inventário, crafting, vida e
              fome pertencem aos scripts do projeto, não a este componente.
            </small>
          </>
        )}
      </section>
      <section>
        <strong>Mapas-base</strong>
        <p>
          Em Novo: Gramado com céu, Colinas contínuas e Galeria de formas. O
          jogo Bosque Vivo é um arquivo de projeto separado.
        </p>
        <p>
          Botão direito + WASD: voar. Q/E: descer/subir. Shift: acelerar. Clique
          direito curto: menu contextual. Ajustes em Configurações do projeto.
        </p>
      </section>
      <section>
        <strong>Lanterna do jogador</strong>
        <p>
          Lanterna presa à câmera. Scripts ligam e desligam com
          engine.torch(true) ou engine.torch(false, {"{"} intensity: 4 {"}"}).
        </p>
        {(() => {
          const torch = settings.torch ?? torchDefaults,
            set = (patch: Partial<typeof torch>) =>
              onSettings({ ...settings, torch: { ...torch, ...patch } }),
            slider = (
              label: string,
              key: "intensity" | "distance" | "angle" | "penumbra",
              min: number,
              max: number,
              step: number,
            ) => (
              <label key={key}>
                {label}
                <input
                  type="range"
                  aria-label={label}
                  disabled={disabled}
                  min={min}
                  max={max}
                  step={step}
                  value={torch[key]}
                  onChange={(e) =>
                    set({ [key]: Number(e.target.value) } as never)
                  }
                />
                <output>{torch[key].toFixed(step < 1 ? 2 : 0)}</output>
              </label>
            );
          return (
            <>
              <label>
                <input
                  type="checkbox"
                  aria-label="Lanterna ligada ao iniciar"
                  disabled={disabled}
                  checked={torch.enabled}
                  onChange={(e) => set({ enabled: e.target.checked })}
                />
                Ligada ao iniciar o jogo
              </label>
              <label>
                Cor do facho
                <input
                  type="color"
                  aria-label="Cor da lanterna"
                  disabled={disabled}
                  value={torch.color}
                  onChange={(e) => set({ color: e.target.value })}
                />
              </label>
              {slider("Intensidade da lanterna", "intensity", 0, 60, 0.5)}
              {slider("Alcance da lanterna", "distance", 1, 120, 1)}
              {slider("Ângulo da lanterna", "angle", 5, 90, 1)}
              {slider("Suavidade da lanterna", "penumbra", 0, 1, 0.05)}
              <label>
                <input
                  type="checkbox"
                  aria-label="Sombras da lanterna"
                  disabled={disabled}
                  checked={torch.shadows}
                  onChange={(e) => set({ shadows: e.target.checked })}
                />
                Sombras da lanterna
              </label>
            </>
          );
        })()}
      </section>
      <section>
        <strong>Texturas</strong>
        <p>
          Texturas de pixel (Pixel Studio) se repetem em cada peça; aqui você
          define quantos metros cada tile cobre.
        </p>
        <label>
          Metros por tile
          <input
            type="range"
            aria-label="Metros por tile"
            disabled={disabled}
            min={0.5}
            max={6}
            step={0.25}
            value={settings.textureTile ?? 1.5}
            onChange={(e) =>
              onSettings({ ...settings, textureTile: Number(e.target.value) })
            }
          />
          <output>{(settings.textureTile ?? 1.5).toFixed(2)}</output>
        </label>
      </section>
      <section>
        <strong>Áudio</strong>
        <label>
          Volume geral
          <input
            type="range"
            aria-label="Volume geral"
            disabled={disabled}
            min={0}
            max={1}
            step={0.05}
            value={settings.volume ?? 0.9}
            onChange={(e) =>
              onSettings({ ...settings, volume: Number(e.target.value) })
            }
          />
          <output>{(settings.volume ?? 0.9).toFixed(2)}</output>
        </label>
        <p>
          Sons são sintetizados na hora (sem arquivos): engine.sound("porta.abrir")
          e camadas em repetição com engine.loop("coracao", 0.6).
        </p>
      </section>
    </div>
  );
}
