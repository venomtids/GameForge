import { useEffect, useRef, useState, type KeyboardEvent } from "react";
export type RenderQuality = "auto" | "economy" | "high";
export interface StudioPreferences {
  leftWidth: number;
  rightWidth: number;
  dockHeight: number;
  explorer: boolean;
  inspector: boolean;
  quality: RenderQuality;
  previewSky: boolean;
  translationSnap: number;
  rotationSnap: number;
  scaleSnap: number;
}
const key = "gameforge.studio.preferences.v1";
export const preferenceDefaults: StudioPreferences = {
  leftWidth: 230,
  rightWidth: 290,
  dockHeight: 240,
  explorer: true,
  inspector: true,
  quality: "auto",
  previewSky: false,
  translationSnap: 0.5,
  rotationSnap: 15,
  scaleSnap: 0.1,
};
const clamp = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === "number" && Number.isFinite(v)
    ? Math.min(max, Math.max(min, v))
    : fallback;
export function parsePreferences(raw: string | null): StudioPreferences {
  try {
    const p = JSON.parse(raw ?? "{}");
    return {
      leftWidth: clamp(p.leftWidth, 180, 360, 230),
      rightWidth: clamp(p.rightWidth, 240, 420, 290),
      dockHeight: clamp(p.dockHeight, 140, 600, 240),
      explorer: typeof p.explorer === "boolean" ? p.explorer : true,
      inspector: typeof p.inspector === "boolean" ? p.inspector : true,
      previewSky: typeof p.previewSky === "boolean" ? p.previewSky : false,
      quality: ["auto", "economy", "high"].includes(p.quality)
        ? p.quality
        : "auto",
      translationSnap: clamp(p.translationSnap, 0.05, 10, 0.5),
      rotationSnap: clamp(p.rotationSnap, 1, 90, 15),
      scaleSnap: clamp(p.scaleSnap, 0.01, 1, 0.1),
    };
  } catch {
    return { ...preferenceDefaults };
  }
}
export function useStudioPreferences() {
  const [preferences, setPreferences] = useState(() => {
    try {
      return parsePreferences(localStorage.getItem(key));
    } catch {
      return { ...preferenceDefaults };
    }
  });
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(preferences));
      } catch {
        /* UI still works in private browsing. */
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [preferences]);
  const setPreference = <K extends keyof StudioPreferences>(
    name: K,
    value: StudioPreferences[K],
  ) => setPreferences((p) => ({ ...p, [name]: value }));
  return {
    preferences,
    setPreference,
    resetLayout: () => setPreferences({ ...preferenceDefaults }),
  };
}

export function ResizeHandle({
  label,
  value,
  min,
  max,
  direction,
  onChange,
  vertical = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  direction: 1 | -1;
  onChange: (value: number) => void;
  vertical?: boolean;
}) {
  const origin = useRef<{ coordinate: number; value: number } | null>(null);
  const keyboard = (e: KeyboardEvent) => {
    const positive = vertical ? "ArrowDown" : "ArrowRight",
      negative = vertical ? "ArrowUp" : "ArrowLeft";
    if (e.key === positive || e.key === negative) {
      e.preventDefault();
      onChange(
        Math.max(
          min,
          Math.min(max, value + (e.key === positive ? 10 : -10) * direction),
        ),
      );
    }
    if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      onChange(e.key === "Home" ? min : max);
    }
  };
  return (
    <div
      className={`resize-handle ${vertical ? "horizontal" : "vertical"}`}
      role="separator"
      aria-label={label}
      aria-orientation={vertical ? "horizontal" : "vertical"}
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onKeyDown={keyboard}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        origin.current = {
          coordinate: vertical ? e.clientY : e.clientX,
          value,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
        e.preventDefault();
      }}
      onPointerMove={(e) => {
        if (!origin.current) return;
        const coordinate = vertical ? e.clientY : e.clientX;
        onChange(
          Math.max(
            min,
            Math.min(
              max,
              origin.current.value +
                (coordinate - origin.current.coordinate) * direction,
            ),
          ),
        );
      }}
      onPointerUp={() => {
        origin.current = null;
      }}
      onPointerCancel={() => {
        origin.current = null;
      }}
      onLostPointerCapture={() => {
        origin.current = null;
      }}
    >
      <span />
    </div>
  );
}
