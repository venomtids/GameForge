import { useEffect, useRef, useState } from "react";
import type { PixelTexture } from "../engine/studio-model";
import { uid } from "../engine/model";
export default function PixelPanel({
  textures,
  onCommit,
  onAdd,
  onAttach,
  disabled,
  canObject,
  canUI,
}: {
  textures: PixelTexture[];
  onCommit: (t: PixelTexture) => void;
  onAdd: (t: PixelTexture) => void;
  onAttach: (id: string, target: "object" | "ui") => void;
  disabled: boolean;
  canObject: boolean;
  canUI: boolean;
}) {
  const [id, setId] = useState(""),
    [color, setColor] = useState("#ffb36d"),
    [tool, setTool] = useState("pencil"),
    [size, setSize] = useState<16 | 32 | 64>(32);
  const texture = textures.find((t) => t.id === id) ?? textures[0],
    canvas = useRef<HTMLCanvasElement>(null),
    draft = useRef<PixelTexture | null>(null),
    last = useRef<[number, number] | null>(null),
    file = useRef<HTMLInputElement>(null);
  const draw = (t: PixelTexture) => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 320, 320);
    const zoom = 320 / t.size;
    t.pixels.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(
        (i % t.size) * zoom,
        Math.floor(i / t.size) * zoom,
        zoom,
        zoom,
      );
    });
    if (t.size <= 32) {
      ctx.strokeStyle = "#ffffff18";
      ctx.beginPath();
      for (let i = 0; i <= t.size; i++) {
        ctx.moveTo(i * zoom, 0);
        ctx.lineTo(i * zoom, 320);
        ctx.moveTo(0, i * zoom);
        ctx.lineTo(320, i * zoom);
      }
      ctx.stroke();
    }
  };
  useEffect(() => {
    draft.current = texture ? structuredClone(texture) : null;
    if (texture) draw(texture);
  }, [texture]);
  const paint = (e: React.PointerEvent<HTMLCanvasElement>, start = false) => {
    const t = draft.current;
    if (!t || disabled) return;
    const r = e.currentTarget.getBoundingClientRect(),
      x = Math.max(
        0,
        Math.min(
          t.size - 1,
          Math.floor(((e.clientX - r.left) / r.width) * t.size),
        ),
      ),
      y = Math.max(
        0,
        Math.min(
          t.size - 1,
          Math.floor(((e.clientY - r.top) / r.height) * t.size),
        ),
      ),
      index = y * t.size + x;
    if (tool === "pick") {
      setColor(t.pixels[index].slice(0, 7));
      return;
    }
    const ink = tool === "erase" ? "#00000000" : color;
    if (tool === "fill" && start) {
      const old = t.pixels[index];
      if (old !== ink) {
        const stack = [index];
        while (stack.length) {
          const i = stack.pop()!;
          if (t.pixels[i] !== old) continue;
          t.pixels[i] = ink;
          const xx = i % t.size,
            yy = Math.floor(i / t.size);
          if (xx) stack.push(i - 1);
          if (xx < t.size - 1) stack.push(i + 1);
          if (yy) stack.push(i - t.size);
          if (yy < t.size - 1) stack.push(i + t.size);
        }
      }
    } else if (tool !== "fill") {
      const a = last.current ?? [x, y],
        steps = Math.max(Math.abs(x - a[0]), Math.abs(y - a[1]), 1);
      for (let i = 0; i <= steps; i++)
        t.pixels[
          Math.round(a[1] + ((y - a[1]) * i) / steps) * t.size +
            Math.round(a[0] + ((x - a[0]) * i) / steps)
        ] = ink;
    }
    last.current = [x, y];
    draw(t);
  };
  return (
    <div className="pixel-panel">
      <aside>
        <strong>Pixel Studio · 1 pixel</strong>
        <select
          aria-label="Textura selecionada"
          value={texture?.id ?? ""}
          onChange={(e) => setId(e.target.value)}
        >
          {textures.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} · {t.size}²
            </option>
          ))}
        </select>
        <select
          aria-label="Resolução da nova textura"
          value={size}
          onChange={(e) => setSize(Number(e.target.value) as 16 | 32 | 64)}
        >
          {[16, 32, 64].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button
          disabled={disabled || textures.length >= 48}
          onClick={() => {
            const t: PixelTexture = {
              id: uid(),
              name: "Textura " + (textures.length + 1),
              size,
              pixels: Array(size * size).fill("#ffffff"),
            };
            onAdd(t);
            setId(t.id);
          }}
        >
          Nova textura
        </button>
        <input
          aria-label="Cor pixel"
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
        />
        {Object.entries({
          pencil: "Pincel 1 px",
          erase: "Borracha",
          fill: "Preencher",
          pick: "Conta-gotas",
        }).map(([k, v]) => (
          <button
            key={k}
            className={tool === k ? "active" : ""}
            onClick={() => setTool(k)}
          >
            {v}
          </button>
        ))}
      </aside>
      <div className="pixel-canvas-wrap">
        <canvas
          width={320}
          height={320}
          ref={canvas}
          aria-label="Pintura pixel a pixel"
          onPointerDown={(e) => {
            if (disabled || !texture) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            draft.current = structuredClone(texture);
            last.current = null;
            paint(e, true);
          }}
          onPointerMove={(e) => {
            if (
              e.buttons === 1 &&
              e.currentTarget.hasPointerCapture(e.pointerId)
            )
              paint(e);
          }}
          onPointerUp={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
              e.currentTarget.releasePointerCapture(e.pointerId);
              if (draft.current && tool !== "pick")
                onCommit(structuredClone(draft.current));
              last.current = null;
            }
          }}
        />
      </div>
      <aside>
        <strong>Usar a textura</strong>
        <button
          disabled={disabled || !texture || !canObject}
          onClick={() => onAttach(texture!.id, "object")}
        >
          Aplicar no objeto 3D
        </button>
        <button
          disabled={disabled || !texture || !canUI}
          onClick={() => onAttach(texture!.id, "ui")}
        >
          Aplicar no elemento 2D
        </button>
        <p>
          Selecione o objeto na árvore, ou selecione um elemento na aba
          Interface 2D. Transparência pela borracha. Ctrl+Z desfaz cada traço.
        </p>
        <button
          disabled={!texture}
          onClick={() => {
            const c = document.createElement("canvas");
            c.width = c.height = texture!.size;
            const ctx = c.getContext("2d")!;
            texture!.pixels.forEach((color, i) => {
              ctx.fillStyle = color;
              ctx.fillRect(
                i % texture!.size,
                Math.floor(i / texture!.size),
                1,
                1,
              );
            });
            const a = document.createElement("a");
            a.href = c.toDataURL();
            a.download = texture!.name + ".png";
            a.click();
          }}
        >
          Exportar PNG
        </button>
        <button
          disabled={disabled || !texture}
          onClick={() => file.current?.click()}
        >
          Importar PNG (redimensiona)
        </button>
        <input
          hidden
          ref={file}
          type="file"
          accept="image/png"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f || !texture || f.size > 4_000_000) return;
            try {
              const img = await createImageBitmap(f);
              const c = document.createElement("canvas");
              c.width = c.height = texture.size;
              const ctx = c.getContext("2d")!;
              ctx.imageSmoothingEnabled = false;
              ctx.drawImage(img, 0, 0, texture.size, texture.size);
              img.close();
              const data = ctx.getImageData(
                0,
                0,
                texture.size,
                texture.size,
              ).data;
              const pixels = texture.pixels.map(
                (_, i) =>
                  "#" +
                  [...data.slice(i * 4, i * 4 + 4)]
                    .map((v) => v.toString(16).padStart(2, "0"))
                    .join(""),
              );
              onCommit({ ...texture, pixels });
            } catch {
              alert("PNG inválido.");
            }
          }}
        />
      </aside>
    </div>
  );
}
