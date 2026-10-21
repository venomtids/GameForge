import { useEffect, useRef, useState } from "react";
import {
  Diamond,
  Film,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Square,
  Trash2,
} from "lucide-react";
import {
  movementClip,
  recordKeyframe,
  type AnimationClip,
} from "../engine/animation";
import type { Node3D } from "../engine/model";
function KeyNumber({
  value,
  label,
  min,
  max,
  onCommit,
}: {
  value: number;
  label: string;
  min: number;
  max: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(Math.round(value * 1000) / 1000));
  const cancel = useRef(false);
  useEffect(() => {
    setDraft(String(Math.round(value * 1000) / 1000));
  }, [value]);
  return (
    <input
      type="number"
      step="0.1"
      aria-label={label}
      min={min}
      max={max}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (cancel.current) {
          cancel.current = false;
          return;
        }
        const number = Number(draft);
        if (draft.trim() && Number.isFinite(number))
          onCommit(Math.max(min, Math.min(max, number)));
        else setDraft(String(value));
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          cancel.current = true;
          setDraft(String(value));
          e.currentTarget.blur();
        }
      }}
    />
  );
}
export default function AnimationPanel({
  node,
  disabled,
  playing,
  onChange,
  onPreview,
}: {
  node?: Node3D;
  disabled: boolean;
  playing: boolean;
  onChange: (animation: AnimationClip | null) => void;
  onPreview: (time: number | null) => void;
}) {
  const [time, setTime] = useState(0),
    [running, setRunning] = useState(false),
    [selectedFrame, setSelectedFrame] = useState(0);
  const currentTime = useRef(0),
    preview = useRef(onPreview);
  preview.current = onPreview;
  const clip = node?.animation;
  useEffect(() => {
    setRunning(false);
    setTime(0);
    currentTime.current = 0;
    setSelectedFrame(0);
    preview.current(null);
    return () => preview.current(null);
  }, [node?.id]);
  useEffect(() => {
    if (playing) {
      setRunning(false);
      preview.current(null);
    }
  }, [playing]);
  useEffect(() => {
    if (!running || !clip) return;
    const start = performance.now(),
      offset = currentTime.current;
    let frame = 0,
      lastUI = 0;
    const tick = (now: number) => {
      let t = offset + (now - start) / 1000;
      if (t >= clip.duration) {
        if (clip.loop) t %= clip.duration;
        else {
          currentTime.current = clip.duration;
          setTime(clip.duration);
          preview.current(clip.duration);
          setRunning(false);
          return;
        }
      }
      currentTime.current = t;
      preview.current(t);
      if (now - lastUI > 50) {
        setTime(t);
        lastUI = now;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, clip?.duration, clip?.loop]);
  const scrub = (t: number) => {
    setRunning(false);
    currentTime.current = t;
    setTime(t);
    preview.current(t);
  };
  if (!node)
    return (
      <div className="animation-empty">
        <Film size={34} />
        <strong>Dê movimento à sua ideia.</strong>
        <p>
          Selecione um objeto na cena para criar e editar sua animação por
          keyframes.
        </p>
        <span>
          Transformações locais · interpolação · loops · exportação offline
        </span>
      </div>
    );
  if (!clip)
    return (
      <div className="animation-empty">
        <Film size={34} />
        <strong>Anime {node.name}</strong>
        <p>
          Crie poses em diferentes momentos. O Studio cuida do movimento entre
          elas.
        </p>
        <button
          className="primary"
          disabled={disabled}
          onClick={() => onChange(movementClip(node))}
        >
          <Plus size={15} /> Criar animação
        </button>
        <span>
          Comece com um movimento suave de 4 segundos e personalize cada pose.
        </span>
      </div>
    );
  const frameIndex = Math.min(selectedFrame, clip.frames.length - 1),
    keyframe = clip.frames[frameIndex];
  const field = (key: "position" | "rotation" | "scale", label: string) => (
    <label className="keyframe-vector">
      <span>{label}</span>
      <div>
        {["X", "Y", "Z"].map((axis, i) => (
          <label key={axis} className={`vector vector-${axis.toLowerCase()}`}>
            <span>{axis}</span>
            <KeyNumber
              label={`Keyframe ${label} ${axis}`}
              value={keyframe[key][i]}
              min={key === "scale" ? 0.01 : -10000}
              max={key === "scale" ? 100 : 10000}
              onCommit={(value) => {
                const frames = structuredClone(clip.frames);
                frames[frameIndex][key][i] = value;
                onChange({ ...clip, frames });
                scrub(keyframe.time);
              }}
            />
          </label>
        ))}
      </div>
    </label>
  );
  return (
    <div className="animation-panel">
      <fieldset disabled={disabled} className="animation-controls">
        <div className="animation-title">
          <Film size={17} />
          <strong>{node.name}</strong>
          <span>TRANSFORM TRACK</span>
        </div>
        <label>
          Nome{" "}
          <input
            aria-label="Nome da animação"
            key={node.id + clip.name}
            defaultValue={clip.name}
            maxLength={80}
            onBlur={(e) => {
              if (e.target.value !== clip.name)
                onChange({ ...clip, name: e.target.value || "Animação" });
            }}
          />
        </label>
        <label>
          Duração (s)
          <KeyNumber
            label="Duração da animação"
            value={clip.duration}
            min={Math.max(0.1, clip.frames[clip.frames.length - 1].time)}
            max={120}
            onCommit={(duration) => onChange({ ...clip, duration })}
          />
        </label>
        <label>
          Interpolação
          <select
            aria-label="Interpolação da animação"
            value={clip.interpolation}
            onChange={(e) =>
              onChange({
                ...clip,
                interpolation: e.target.value as AnimationClip["interpolation"],
              })
            }
          >
            <option value="smooth">Suave</option>
            <option value="linear">Linear</option>
            <option value="step">Passo a passo</option>
          </select>
        </label>
        <div className="animation-checks">
          <label>
            <input
              type="checkbox"
              aria-label="Repetir animação"
              checked={clip.loop}
              onChange={(e) => onChange({ ...clip, loop: e.target.checked })}
            />{" "}
            Repetir
          </label>
          <label>
            <input
              type="checkbox"
              aria-label="Animação ao iniciar"
              checked={clip.autoplay}
              onChange={(e) =>
                onChange({ ...clip, autoplay: e.target.checked })
              }
            />{" "}
            Tocar no jogo
          </label>
        </div>
        <button
          className="danger-button"
          onClick={() => {
            if (
              confirm("Remover esta animação? Você pode desfazer com Ctrl+Z.")
            ) {
              setRunning(false);
              preview.current(null);
              onChange(null);
            }
          }}
        >
          <Trash2 size={12} /> Remover animação
        </button>
      </fieldset>
      <div className="timeline-editor">
        <header>
          <div className="timeline-transport">
            <button
              aria-label={
                running
                  ? "Pausar prévia da animação"
                  : "Reproduzir prévia da animação"
              }
              disabled={disabled}
              className={running ? "active" : ""}
              onClick={() => {
                if (!running && currentTime.current >= clip.duration) scrub(0);
                setRunning(!running);
              }}
            >
              {running ? <Pause size={15} /> : <Play size={15} />}
            </button>
            <button
              aria-label="Parar prévia da animação"
              disabled={playing}
              onClick={() => {
                setRunning(false);
                setTime(0);
                currentTime.current = 0;
                preview.current(null);
              }}
            >
              <Square size={13} />
            </button>
            <button
              aria-label="Voltar ao início da animação"
              disabled={playing}
              onClick={() => scrub(0)}
            >
              <RotateCcw size={14} />
            </button>
            <output>
              {time.toFixed(2)}
              <small> / {clip.duration.toFixed(2)} s</small>
            </output>
          </div>
          <button
            className="outline-button"
            disabled={disabled || clip.frames.length >= 120}
            onClick={() => {
              onChange(recordKeyframe(clip, time, node));
              setSelectedFrame(
                clip.frames.filter((f) => f.time < time - 0.001).length,
              );
            }}
          >
            <Diamond size={12} /> Capturar pose
          </button>
        </header>
        <div className="timeline-ruler">
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i}>{((i * clip.duration) / 8).toFixed(1)}s</span>
          ))}
        </div>
        <div className="timeline-track">
          <span className="timeline-track-label">
            <Diamond size={11} /> Transformação
          </span>
          <div className="timeline-keyframes">
            <div
              className="timeline-playhead"
              style={{ left: `${(time / clip.duration) * 100}%` }}
            />
            {clip.frames.map((f, i) => (
              <button
                key={f.time}
                className={frameIndex === i ? "selected" : ""}
                style={{ left: `${(f.time / clip.duration) * 100}%` }}
                aria-label={`Keyframe em ${f.time} s`}
                disabled={playing}
                onClick={() => {
                  setSelectedFrame(i);
                  scrub(f.time);
                }}
              >
                <Diamond size={13} fill="currentColor" />
              </button>
            ))}
          </div>
        </div>
        <input
          type="range"
          className="timeline-scrubber"
          aria-label="Tempo da animação"
          min={0}
          max={clip.duration}
          step={0.01}
          value={time}
          disabled={playing}
          onChange={(e) => scrub(Number(e.target.value))}
        />
        <fieldset className="keyframe-properties" disabled={disabled}>
          <header>
            <strong>
              <Diamond size={12} /> Pose em {keyframe.time.toFixed(2)} s
            </strong>
            <button
              className="icon-button"
              aria-label="Excluir keyframe selecionado"
              disabled={clip.frames.length <= 1}
              onClick={() => {
                onChange({
                  ...clip,
                  frames: clip.frames.filter((_, i) => i !== frameIndex),
                });
                setSelectedFrame(Math.max(0, frameIndex - 1));
              }}
            >
              <Trash2 size={13} />
            </button>
          </header>
          {field("position", "Posição")}
          {field("rotation", "Rotação")}
          {field("scale", "Escala")}
        </fieldset>
        <p className="animation-hint">
          A prévia não altera a pose original. Capturar pose grava os valores do
          Inspetor. Escala de colisores não é animada; corpos dinâmicos e
          terrenos não usam keyframes no jogo.
        </p>
        {(node.physics === "dynamic" ||
          node.surface ||
          node.deform.type !== "none") && (
          <p className="animation-warning">
            Este objeto usa física dinâmica, deformação ou terreno. A animação é
            apenas uma prévia; use física “Nenhuma” ou “Estático” para
            reproduzi-la no jogo.
          </p>
        )}
      </div>
    </div>
  );
}
