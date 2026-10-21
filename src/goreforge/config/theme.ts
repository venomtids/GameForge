/**
 * Tema e "deformação" da interface 2D do GORE FORGE.
 *
 * A UI inteira (HUD, menu de spawn, pausa) é desenhada a partir destes campos:
 * cores, métricas e parâmetros de deformação.  Trocar de tema = trocar um
 * objeto; ajustar em tempo real = escrever nas mesmas chaves (`--gf-*`).
 * Nenhum widget tem cor fixa no código: todos leem as variáveis CSS.
 */
export interface UITheme {
  id: string;
  label: string;
  description: string;
  /** Fontes e textura de fundo (CSS puro). */
  font: string;
  fontMono: string;
  backdrop: string;
  colors: {
    accent: string;
    accentSoft: string;
    danger: string;
    warning: string;
    ok: string;
    panel: string;
    panelSolid: string;
    text: string;
    textDim: string;
    border: string;
    hp: string;
    armor: string;
    ammo: string;
    blood: string;
    shadow: string;
  };
  metrics: {
    radius: number;
    gap: number;
    pad: number;
    scale: number;
    border: number;
    blur: number;
    fontSize: number;
    letterSpacing: number;
    skew: number;
    glow: number;
    opacity: number;
  };
  deform: {
    /** Achata/espreme o botão ao pressionar (fração da escala). */
    press: number;
    /** Deslocamento magnético no hover. */
    hover: number;
    /** Oscilação elástica ao abrir painéis. */
    wobble: number;
    /** Duração da animação de entrada (ms). */
    popIn: number;
    /** Intensidade das linhas de varredura do fundo. */
    scanlines: number;
    /** Vinheta escura nas bordas. */
    vignette: number;
  };
}

export const themes: Record<string, UITheme> = {
  ferro: {
    id: "ferro",
    label: "Ferro Sujo",
    description: "Aço enferrujado, amarelo de advertência e sujeira industrial.",
    font: "'Inter Variable', system-ui, sans-serif",
    fontMono: "ui-monospace, 'SFMono-Regular', monospace",
    backdrop:
      "radial-gradient(circle at 50% 40%, #2a2118 0%, #140f0c 60%, #0a0806 100%)",
    colors: {
      accent: "#ffb020",
      accentSoft: "#ffb02033",
      danger: "#ff3b30",
      warning: "#ffd166",
      ok: "#7ee081",
      panel: "#1b1712d9",
      panelSolid: "#181410",
      text: "#f6ead6",
      textDim: "#a99a83",
      border: "#ffb02055",
      hp: "#ff4d4d",
      armor: "#69d2ff",
      ammo: "#ffd166",
      blood: "#8f1d10",
      shadow: "#000000cc",
    },
    metrics: {
      radius: 4,
      gap: 6,
      pad: 10,
      scale: 1,
      border: 1,
      blur: 3,
      fontSize: 15,
      letterSpacing: 0.4,
      skew: 0,
      glow: 0.35,
      opacity: 0.96,
    },
    deform: {
      press: 0.06,
      hover: 2,
      wobble: 0.6,
      popIn: 160,
      scanlines: 0.12,
      vignette: 0.5,
    },
  },
  sangue: {
    id: "sangue",
    label: "Sangue Frio",
    description: "Vermelho profundo, alto contraste e vinheta pesada.",
    font: "'Inter Variable', system-ui, sans-serif",
    fontMono: "ui-monospace, monospace",
    backdrop:
      "radial-gradient(circle at 50% 30%, #3a0d0d 0%, #170506 55%, #080203 100%)",
    colors: {
      accent: "#ff2e2e",
      accentSoft: "#ff2e2e36",
      danger: "#ff7b00",
      warning: "#ffcc00",
      ok: "#8df5a5",
      panel: "#1a0508d9",
      panelSolid: "#150306",
      text: "#ffe9e9",
      textDim: "#b98e8e",
      border: "#ff2e2e66",
      hp: "#ff5252",
      armor: "#8fb8ff",
      ammo: "#ffcc66",
      blood: "#b3170d",
      shadow: "#000000e0",
    },
    metrics: {
      radius: 3,
      gap: 7,
      pad: 11,
      scale: 1,
      border: 1,
      blur: 4,
      fontSize: 15,
      letterSpacing: 0.6,
      skew: -1,
      glow: 0.55,
      opacity: 0.95,
    },
    deform: {
      press: 0.09,
      hover: 3,
      wobble: 0.9,
      popIn: 140,
      scanlines: 0.2,
      vignette: 0.75,
    },
  },
  toxico: {
    id: "toxico",
    label: "Tóxico",
    description: "Verde ácido, gelatina fluorescente e brilho alto.",
    font: "'Inter Variable', system-ui, sans-serif",
    fontMono: "ui-monospace, monospace",
    backdrop:
      "radial-gradient(circle at 50% 45%, #10302a 0%, #071613 60%, #020906 100%)",
    colors: {
      accent: "#5cff9d",
      accentSoft: "#5cff9d30",
      danger: "#ff5c8a",
      warning: "#ffe066",
      ok: "#5cff9d",
      panel: "#062018d9",
      panelSolid: "#04160f",
      text: "#ddfff0",
      textDim: "#7fb59c",
      border: "#5cff9d55",
      hp: "#5cff9d",
      armor: "#7fd4ff",
      ammo: "#ffe066",
      blood: "#2fae72",
      shadow: "#000000cc",
    },
    metrics: {
      radius: 14,
      gap: 8,
      pad: 12,
      scale: 1.02,
      border: 1,
      blur: 8,
      fontSize: 15,
      letterSpacing: 0.3,
      skew: 0,
      glow: 0.7,
      opacity: 0.94,
    },
    deform: {
      press: 0.12,
      hover: 3,
      wobble: 1.3,
      popIn: 220,
      scanlines: 0.08,
      vignette: 0.35,
    },
  },
  neon: {
    id: "neon",
    label: "Neon Noturno",
    description: "Ciano/magenta, cantos retos, leitura rápida e fria.",
    font: "'Inter Variable', system-ui, sans-serif",
    fontMono: "ui-monospace, monospace",
    backdrop:
      "radial-gradient(circle at 50% 40%, #101a3a 0%, #070b1c 60%, #02030a 100%)",
    colors: {
      accent: "#31e7ff",
      accentSoft: "#31e7ff2e",
      danger: "#ff2fb4",
      warning: "#ffd166",
      ok: "#7cf6c0",
      panel: "#080f24d9",
      panelSolid: "#060b1b",
      text: "#e8f6ff",
      textDim: "#88a3c4",
      border: "#31e7ff55",
      hp: "#ff2fb4",
      armor: "#31e7ff",
      ammo: "#ffd166",
      blood: "#a02070",
      shadow: "#000000d9",
    },
    metrics: {
      radius: 0,
      gap: 6,
      pad: 10,
      scale: 0.98,
      border: 1,
      blur: 6,
      fontSize: 14,
      letterSpacing: 1.1,
      skew: 0,
      glow: 0.8,
      opacity: 0.96,
    },
    deform: {
      press: 0.04,
      hover: 2,
      wobble: 0.4,
      popIn: 120,
      scanlines: 0.16,
      vignette: 0.4,
    },
  },
  militar: {
    id: "militar",
    label: "Campo Militar",
    description: "Verde-oliva, tipografia densa e HUD de baixa distração.",
    font: "'Inter Variable', system-ui, sans-serif",
    fontMono: "ui-monospace, monospace",
    backdrop:
      "radial-gradient(circle at 50% 40%, #1d2417 0%, #0f1309 60%, #050703 100%)",
    colors: {
      accent: "#c8d96f",
      accentSoft: "#c8d96f2e",
      danger: "#ff6b4a",
      warning: "#ffc14d",
      ok: "#9be07f",
      panel: "#13180ed9",
      panelSolid: "#10140b",
      text: "#eef3d8",
      textDim: "#9aa382",
      border: "#c8d96f4d",
      hp: "#ff7a52",
      armor: "#a9c6ff",
      ammo: "#ffc14d",
      blood: "#7a2a12",
      shadow: "#000000cc",
    },
    metrics: {
      radius: 2,
      gap: 5,
      pad: 9,
      scale: 0.97,
      border: 1,
      blur: 2,
      fontSize: 14,
      letterSpacing: 0.2,
      skew: 0,
      glow: 0.2,
      opacity: 0.97,
    },
    deform: {
      press: 0.03,
      hover: 1,
      wobble: 0.3,
      popIn: 110,
      scanlines: 0.06,
      vignette: 0.3,
    },
  },
  gelatina: {
    id: "gelatina",
    label: "Gelatina",
    description: "Rosa translúcido, cantos enormes e deformação exagerada.",
    font: "'Inter Variable', system-ui, sans-serif",
    fontMono: "ui-monospace, monospace",
    backdrop:
      "radial-gradient(circle at 50% 40%, #2c1230 0%, #170a1d 60%, #08030a 100%)",
    colors: {
      accent: "#ff8ad4",
      accentSoft: "#ff8ad436",
      danger: "#ff4d6d",
      warning: "#ffd0a1",
      ok: "#8ef7c6",
      panel: "#200d24d9",
      panelSolid: "#1a0a1f",
      text: "#ffeaf7",
      textDim: "#c298b8",
      border: "#ff8ad455",
      hp: "#ff8ad4",
      armor: "#9be7ff",
      ammo: "#ffd0a1",
      blood: "#c2317e",
      shadow: "#000000cc",
    },
    metrics: {
      radius: 22,
      gap: 9,
      pad: 13,
      scale: 1.04,
      border: 2,
      blur: 10,
      fontSize: 15,
      letterSpacing: 0.4,
      skew: 0,
      glow: 0.6,
      opacity: 0.93,
    },
    deform: {
      press: 0.18,
      hover: 5,
      wobble: 1.8,
      popIn: 300,
      scanlines: 0,
      vignette: 0.4,
    },
  },
};

export const themeIds = Object.keys(themes);

function color(value: unknown, fallback: string) {
  return typeof value === "string" &&
    /^#[\da-f]{6}([\da-f]{2})?$/i.test(value.trim())
    ? value.trim()
    : fallback;
}

function bounds(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

const metricLimits: Record<keyof UITheme["metrics"], [number, number]> = {
  radius: [0, 40],
  gap: [0, 32],
  pad: [0, 32],
  scale: [0.5, 2],
  border: [0, 6],
  blur: [0, 24],
  fontSize: [9, 30],
  letterSpacing: [0, 4],
  skew: [-6, 6],
  glow: [0, 2],
  opacity: [0.4, 1],
};
const deformLimits: Record<keyof UITheme["deform"], [number, number]> = {
  press: [0, 0.4],
  hover: [0, 12],
  wobble: [0, 3],
  popIn: [0, 900],
  scanlines: [0, 1],
  vignette: [0, 1],
};

/** Aceita um tema parcial (JSON do usuário) e devolve um tema completo válido. */
export function validateTheme(raw: unknown, base = themes.ferro): UITheme {
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    any
  >;
  const colors = { ...base.colors };
  for (const key of Object.keys(colors) as (keyof UITheme["colors"])[])
    colors[key] = color(input.colors?.[key], base.colors[key]);
  const metrics = { ...base.metrics };
  for (const key of Object.keys(metrics) as (keyof UITheme["metrics"])[])
    metrics[key] = bounds(
      input.metrics?.[key],
      base.metrics[key],
      metricLimits[key][0],
      metricLimits[key][1],
    );
  const deform = { ...base.deform };
  for (const key of Object.keys(deform) as (keyof UITheme["deform"])[])
    deform[key] = bounds(
      input.deform?.[key],
      base.deform[key],
      deformLimits[key][0],
      deformLimits[key][1],
    );
  return {
    id:
      typeof input.id === "string" && input.id.length <= 24
        ? input.id
        : base.id,
    label:
      typeof input.label === "string" && input.label.length <= 40
        ? input.label
        : base.label,
    description:
      typeof input.description === "string" && input.description.length <= 160
        ? input.description
        : base.description,
    font:
      typeof input.font === "string" && input.font.length <= 120
        ? input.font
        : base.font,
    fontMono:
      typeof input.fontMono === "string" && input.fontMono.length <= 120
        ? input.fontMono
        : base.fontMono,
    backdrop:
      typeof input.backdrop === "string" && input.backdrop.length <= 240
        ? input.backdrop
        : base.backdrop,
    colors,
    metrics,
    deform,
  };
}

/** Tema do catálogo com id desconhecido cai no padrão em vez de quebrar. */
export function themeFor(id: string): UITheme {
  return themes[id] ?? themes.ferro;
}

/** Variáveis CSS consumidas por todos os widgets (`var(--gf-...)`). */
export function themeVariables(theme: UITheme): Record<string, string> {
  const vars: Record<string, string> = {
    "--gf-font": theme.font,
    "--gf-font-mono": theme.fontMono,
    "--gf-backdrop": theme.backdrop,
    "--gf-scale": String(theme.metrics.scale),
    "--gf-radius": `${theme.metrics.radius}px`,
    "--gf-gap": `${theme.metrics.gap}px`,
    "--gf-pad": `${theme.metrics.pad}px`,
    "--gf-border": `${theme.metrics.border}px`,
    "--gf-blur": `${theme.metrics.blur}px`,
    "--gf-font-size": `${theme.metrics.fontSize}px`,
    "--gf-tracking": `${theme.metrics.letterSpacing}px`,
    "--gf-skew": `${theme.metrics.skew}deg`,
    "--gf-glow": String(theme.metrics.glow),
    "--gf-opacity": String(theme.metrics.opacity),
    "--gf-press": String(theme.deform.press),
    "--gf-hover": `${theme.deform.hover}px`,
    "--gf-wobble": String(theme.deform.wobble),
    "--gf-pop": `${theme.deform.popIn}ms`,
    "--gf-scanlines": String(theme.deform.scanlines),
    "--gf-vignette": String(theme.deform.vignette),
  };
  for (const [key, value] of Object.entries(theme.colors))
    vars[`--gf-${key.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())}`] = value;
  return vars;
}

/** Serializa tema + layout para download/importação no menu. */
export function serializeTheme(theme: UITheme) {
  return JSON.stringify(
    {
      id: theme.id,
      label: theme.label,
      description: theme.description,
      font: theme.font,
      fontMono: theme.fontMono,
      backdrop: theme.backdrop,
      colors: theme.colors,
      metrics: theme.metrics,
      deform: theme.deform,
    },
    null,
    2,
  );
}
