import type { UIElement, PixelTexture } from "../engine/studio-model";
import { uid } from "../engine/model";
import { textureURL } from "../engine/GameUI";
export function newUI(
  kind: UIElement["kind"],
  patch: Partial<UIElement> = {},
): UIElement {
  return {
    id: uid(),
    name: kind,
    text: kind === "image" ? "" : "Novo " + kind,
    kind,
    x: 5,
    y: 5,
    w: 25,
    h: 10,
    color: "#e8eee9",
    background: kind === "text" ? "#00000000" : "#233d36",
    fontSize: 18,
    textureId: null,
    binding: "none",
    action: kind === "button" ? "event" : "none",
    screen: "always",
    visible: true,
    ...patch,
  };
}
export default function UIPanel({
  elements,
  textures,
  selected,
  onSelect,
  onChange,
  disabled,
}: {
  elements: UIElement[];
  textures: PixelTexture[];
  selected: string | null;
  onSelect: (id: string) => void;
  onChange: (elements: UIElement[]) => void;
  disabled: boolean;
}) {
  const element = elements.find((e) => e.id === selected);
  const patch = (p: Partial<UIElement>) =>
    onChange(elements.map((e) => (e.id === selected ? { ...e, ...p } : e)));
  return (
    <div className="ui-editor">
      <aside>
        <strong>Interface 2D · tela relativa</strong>
        <div className="ui-add">
          {(["panel", "text", "button", "image", "bar"] as const).map(
            (kind, i) => (
              <button
                key={kind}
                disabled={disabled || elements.length >= 64}
                onClick={() => {
                  const e = newUI(kind);
                  onChange([...elements, e]);
                  onSelect(e.id);
                }}
              >
                + {["Painel", "Texto", "Botão", "Imagem", "Barra"][i]}
              </button>
            ),
          )}
        </div>
        <select
          size={5}
          aria-label="Elementos 2D"
          value={selected ?? ""}
          onChange={(e) => onSelect(e.target.value)}
        >
          {elements.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        <button
          disabled={disabled || !element}
          onClick={() => onChange(elements.filter((e) => e.id !== selected))}
        >
          Excluir elemento 2D
        </button>
      </aside>
      <div className="ui-design-canvas" aria-label="Canvas de interface 2D">
        {elements.map((e) => (
          <div
            key={e.id}
            onPointerDown={(ev) => {
              if (disabled) return;
              onSelect(e.id);
              ev.currentTarget.setPointerCapture(ev.pointerId);
              ev.currentTarget.dataset.start = `${ev.clientX},${ev.clientY},${e.x},${e.y}`;
            }}
            onPointerUp={(ev) => {
              const start = ev.currentTarget.dataset.start;
              if (!start || disabled) return;
              delete ev.currentTarget.dataset.start;
              const [x, y, ox, oy] = start.split(",").map(Number),
                r = ev.currentTarget.parentElement!.getBoundingClientRect();
              onChange(
                elements.map((n) =>
                  n.id === e.id
                    ? {
                        ...n,
                        x: Math.max(
                          0,
                          Math.min(
                            100 - n.w,
                            ox + ((ev.clientX - x) / r.width) * 100,
                          ),
                        ),
                        y: Math.max(
                          0,
                          Math.min(
                            100 - n.h,
                            oy + ((ev.clientY - y) / r.height) * 100,
                          ),
                        ),
                      }
                    : n,
                ),
              );
            }}
            style={{
              position: "absolute",
              left: e.x + "%",
              top: e.y + "%",
              width: e.w + "%",
              height: e.h + "%",
              background: e.background,
              color: e.color,
              fontSize: Math.min(e.fontSize, 20),
              border:
                selected === e.id
                  ? "2px solid #8fe6bb"
                  : "1px dashed #ffffff33",
              opacity: e.visible ? 1 : 0.4,
              overflow: "hidden",
              whiteSpace: "pre-line",
              cursor: "move",
              backgroundImage:
                e.textureId && textures.find((t) => t.id === e.textureId)
                  ? `url(${textureURL(textures.find((t) => t.id === e.textureId)!)})`
                  : undefined,
              backgroundSize: "100% 100%",
              imageRendering: "pixelated",
            }}
          >
            {e.text}
          </div>
        ))}
      </div>
      <aside>
        {element ? (
          <>
            <label>
              Nome
              <input
                disabled={disabled}
                aria-label="Nome 2D"
                value={element.name}
                maxLength={80}
                onChange={(e) => patch({ name: e.target.value })}
              />
            </label>
            <label>
              Texto
              <textarea
                disabled={disabled}
                aria-label="Texto 2D"
                value={element.text}
                maxLength={300}
                onChange={(e) => patch({ text: e.target.value })}
              />
            </label>
            <div className="ui-fields">
              {(["x", "y", "w", "h", "fontSize"] as const).map((k) => (
                <label key={k}>
                  {k}
                  <input
                    aria-label={"UI " + k}
                    disabled={disabled}
                    type="number"
                    value={element[k]}
                    min={k === "fontSize" ? 8 : k === "w" || k === "h" ? 1 : 0}
                    max={k === "fontSize" ? 72 : 100}
                    onChange={(e) =>
                      patch({
                        [k]: Math.max(
                          k === "fontSize" ? 8 : k === "w" || k === "h" ? 1 : 0,
                          Math.min(
                            k === "fontSize" ? 72 : 100,
                            Number(e.target.value),
                          ),
                        ),
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <label>
              Cor
              <input
                type="color"
                value={element.color.slice(0, 7)}
                onChange={(e) => patch({ color: e.target.value })}
              />
            </label>
            <label>
              Fundo
              <input
                type="color"
                value={element.background.slice(0, 7)}
                onChange={(e) => patch({ background: e.target.value })}
              />
            </label>
            <label>
              Ação
              <select
                aria-label="Ação do botão 2D"
                disabled={disabled}
                value={element.action}
                onChange={(e) =>
                  patch({ action: e.target.value as UIElement["action"] })
                }
              >
                {["none", "event", "pause", "resume", "respawn", "hide"].map(
                  (a) => (
                    <option key={a}>{a}</option>
                  ),
                )}
              </select>
            </label>
            <label>
              Mostrar
              <select
                disabled={disabled}
                value={element.screen}
                onChange={(e) =>
                  patch({ screen: e.target.value as UIElement["screen"] })
                }
              >
                {["always", "playing", "paused"].map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                disabled={disabled}
                checked={element.visible}
                onChange={(e) => patch({ visible: e.target.checked })}
              />
              Visível inicialmente
            </label>
            <small>
              ID para scripts: {element.id}
              <br />
              engine.ui(id, patch); input.events recebe o ID do botão (ação
              event).
            </small>
          </>
        ) : (
          <p>
            Adicione e selecione um elemento. Arraste no canvas e solte para
            posicionar. Coordenadas em %.
          </p>
        )}
      </aside>
    </div>
  );
}
