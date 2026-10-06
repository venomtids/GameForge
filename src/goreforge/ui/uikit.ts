import { themeVariables, type UITheme } from "../config/theme";
import { clamp } from "../game/util";

/**
 * UI KIT "ULTRA-DEFORMÁVEL" DO GORE FORGE
 *
 * Uma árvore de dados (UINode) vira DOM com:
 *  - todas as cores/métricas vindas de variáveis CSS do tema (`--gf-*`), então
 *    trocar de tema é trocar um objeto — nada é reconstruído;
 *  - deformação por widget (`style.deform`): achatamento ao pressionar,
 *    deslocamento magnético no hover, oscilação elástica ao montar;
 *  - sobreposição de estilo por widget (`style`), inclusive em pixel/px;
 *  - atualização incremental por `bind` (só escreve no DOM o que mudou).
 *
 * Menus e HUD compartilham esta engine: qualquer painel novo é uma entrada de
 * dados, não uma tela escrita à mão.
 */
export type UIWidgetType =
  | "panel"
  | "row"
  | "stack"
  | "grid"
  | "label"
  | "title"
  | "button"
  | "icon"
  | "badge"
  | "bar"
  | "slider"
  | "toggle"
  | "tabs"
  | "item"
  | "spacer"
  | "divider"
  | "keyvalue";

export interface UIStyle {
  width: string;
  height: string;
  minWidth: string;
  maxWidth: string;
  minHeight: string;
  maxHeight: string;
  flex: string;
  gap: string;
  pad: string;
  marginTop: string;
  radius: string;
  border: string;
  bg: string;
  /** Cor do texto (alias amigável de `fg`). */
  color: string;
  fg: string;
  font: string;
  fontSize: string;
  fontWeight: string;
  letterSpacing: string;
  lineHeight: string;
  textAlign: string;
  textTransform: string;
  /** "nowrap" evita quebrar linhas em rótulos curtos (padrão de `label`). */
  whiteSpace: string;
  align: string;
  justify: string;
  opacity: string;
  overflowY: string;
  position: string;
  display: string;
  zIndex: string;
  pointerEvents: string;
  transform: string;
  deform: number;
  glow: number;
}

export interface UINode {
  id: string;
  type: UIWidgetType;
  text?: string;
  icon?: string;
  value?: number | string;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  /** Chave lida do objeto enviado em `flush()`. */
  bind?: string;
  /** Ações: `press`, `change`, `hover`, `mount`. */
  on?: { press?: string; change?: string; hover?: string };
  hidden?: boolean;
  /** Dados livres: usados por `item` (categoria, tags, payload). */
  data?: Record<string, unknown>;
  style?: Partial<UIStyle>;
  className?: string;
  children?: UINode[];
}

export interface BindValue {
  text?: string;
  value?: number;
  hidden?: boolean;
  color?: string;
  options?: string[];
}

export type ActionHandler = (action: string, value: number | string, node: UINode) => void;

interface Mounted {
  node: UINode;
  el: HTMLElement;
  fill?: HTMLElement;
  label?: HTMLElement;
  icon?: HTMLElement;
  children: Mounted[];
  last: string;
}

const px = (value: number) => `${value}px`;

/** Contêineres deixam `pointer-events` herdado do host. */
const CONTAINER_TYPES: UIWidgetType[] = ["panel", "row", "stack", "grid", "keyvalue", "tabs"];
const INTERACTIVE_TYPES: UIWidgetType[] = ["button", "item", "slider", "toggle"];

function styleFor(
  node: UINode,
  theme: UITheme,
): string {
  const style = node.style ?? {};
  const parts: string[] = ["box-sizing:border-box", "position:relative"];
  const font = theme.font;
  parts.push(`font-family:${style.font ?? font}`);
  if (style.fontSize) parts.push(`font-size:${style.fontSize}`);
  if (style.width) parts.push(`width:${style.width}`);
  if (style.height) parts.push(`height:${style.height}`);
  if (style.minWidth) parts.push(`min-width:${style.minWidth}`);
  if (style.maxWidth) parts.push(`max-width:${style.maxWidth}`);
  if (style.minHeight) parts.push(`min-height:${style.minHeight}`);
  if (style.maxHeight) parts.push(`max-height:${style.maxHeight}`);
  if (style.flex) parts.push(`flex:${style.flex}`);
  if (style.marginTop) parts.push(`margin-top:${style.marginTop}`);
  if (style.gap) parts.push(`gap:${style.gap}`);
  if (style.pad) parts.push(`padding:${style.pad}`);
  if (style.radius) parts.push(`border-radius:${style.radius}`);
  if (style.border) parts.push(`border:${style.border}`);
  if (style.bg) parts.push(`background:${style.bg}`);
  if (style.fg) parts.push(`color:${style.fg}`);
  if (style.color) parts.push(`color:${style.color}`);
  if (style.fontWeight) parts.push(`font-weight:${style.fontWeight}`);
  if (style.letterSpacing) parts.push(`letter-spacing:${style.letterSpacing}`);
  if (style.lineHeight) parts.push(`line-height:${style.lineHeight}`);
  if (style.textAlign) parts.push(`text-align:${style.textAlign}`);
  if (style.textTransform) parts.push(`text-transform:${style.textTransform}`);
  if (style.whiteSpace) parts.push(`white-space:${style.whiteSpace}`);
  if (style.overflowY) parts.push(`overflow-y:${style.overflowY}`);
  if (style.position) parts.push(`position:${style.position}`);
  if (style.display) parts.push(`display:${style.display}`);
  if (style.zIndex) parts.push(`z-index:${style.zIndex}`);
  if (style.pointerEvents) parts.push(`pointer-events:${style.pointerEvents}`);
  if (style.align) parts.push(`align-items:${style.align}`);
  if (style.justify) parts.push(`justify-content:${style.justify}`);
  if (style.opacity) parts.push(`opacity:${style.opacity}`);
  if (style.glow) parts.push(`text-shadow:0 0 ${px(style.glow)} var(--gf-accent)`);
  const isFlex = ["panel", "row", "stack", "grid", "item", "keyvalue"].includes(node.type);
  if (isFlex)
    parts.push(
      `display:${node.type === "grid" ? "grid" : "flex"}`,
      node.type === "row" ? "flex-direction:row" : "flex-direction:column",
      "align-items:stretch",
    );
  if (node.type === "grid")
    parts.push(
      `grid-template-columns:repeat(auto-fill,minmax(${style.minWidth ?? "150px"},1fr))`,
      `gap:${style.gap ?? "var(--gf-gap)"}`,
    );
  if (node.type === "item") parts.push("flex-direction:column", "align-items:flex-start");
  return parts.join(";");
}

/** Engine de UI: monta a árvore e mantém o estado por `bind`. */
export class UI {
  private mounted = new Map<string, Mounted>();
  private variables: string[] = [];
  private action: ActionHandler = () => {};

  constructor(
    public root: HTMLElement,
    public theme: UITheme,
  ) {
    /* NUNCA sobrescrever o estilo do host: menus controlam `display` e o fundo
       do próprio contêiner (fechado = display:none). Só preenchemos o que falta. */
    this.root.classList.add("gf-ui");
    const style = this.root.style;
    if (!style.position) style.position = "absolute";
    if (!style.inset) style.inset = "0";
    if (!style.pointerEvents) style.pointerEvents = "none";
    if (!style.overflow) style.overflow = "hidden";
    if (!style.fontFamily) style.fontFamily = "var(--gf-font)";
    if (!style.color) style.color = "var(--gf-text)";
    this.setTheme(theme);
  }

  onAction(handler: ActionHandler) {
    this.action = handler;
  }

  /** Troca o tema escrevendo só variáveis CSS: nenhum widget é recriado. */
  setTheme(theme: UITheme, global = true) {
    this.theme = theme;
    const vars = themeVariables(theme);
    for (const key of this.variables) this.root.style.removeProperty(key);
    this.variables = Object.keys(vars);
    for (const [key, value] of Object.entries(vars)) this.root.style.setProperty(key, value);
    /* Elementos fora do root da UI (overlay do HUD, hints, telas de morte)
       também usam as variáveis --gf-*: publicamos no documento quando o tema é
       único para todo o jogo. */
    if (global && typeof document !== "undefined")
      for (const [key, value] of Object.entries(vars))
        document.documentElement.style.setProperty(key, value);
  }

  mount(tree: UINode[]) {
    const seen = new Set<string>();
    for (const child of [...this.root.children]) {
      if ((child as HTMLElement).dataset.gfManaged === "1") child.remove();
    }
    this.mounted.clear();
    for (const node of tree) {
      if (node.hidden) continue;
      const built = this.build(node, seen);
      if (built) this.root.append(built.el);
    }
  }

  private build(node: UINode, seen: Set<string>): Mounted | null {
    if (seen.has(node.id)) throw new Error(`UI: id duplicado "${node.id}"`);
    seen.add(node.id);
    const el = document.createElement(node.type === "button" || node.type === "item" ? "button" : "div");
    el.dataset.gfManaged = "1";
    el.dataset.gfId = node.id;
    if (node.type === "button") (el as HTMLButtonElement).type = "button";
    el.style.cssText = styleFor(node, this.theme);
    if (node.className) el.className = node.className;
    /* Contêineres herdam do host (menu = auto, HUD = none); rótulos e barras
       nunca capturam o mouse; só widgets interativos são clicáveis. Assim uma
       tela fechada não rouba o clique de quem está mirando no jogo. */
    if (!CONTAINER_TYPES.includes(node.type))
      el.style.pointerEvents = INTERACTIVE_TYPES.includes(node.type) ? "auto" : "none";
    const mounted: Mounted = { node, el, children: [], last: "" };

    switch (node.type) {
      case "label":
      case "title":
      case "icon":
      case "badge":
      case "keyvalue": {
        el.style.fontSize =
          node.style?.fontSize ??
          (node.type === "title" ? "calc(var(--gf-font-size) * 1.25)" : "var(--gf-font-size)");
        if (node.type === "title") el.style.fontWeight = "700";
        if (node.type === "badge") {
          el.style.padding = "1px 6px";
          el.style.borderRadius = "calc(var(--gf-radius) * 0.8)";
          el.style.background = "var(--gf-accent-soft)";
          el.style.color = "var(--gf-accent)";
          el.style.fontSize = "0.78em";
          el.style.letterSpacing = "0.06em";
          el.style.textTransform = "uppercase";
        }
        if (node.type === "keyvalue") {
          el.style.display = "flex";
          el.style.justifyContent = "space-between";
          el.style.gap = "var(--gf-gap)";
        }
        if (node.style?.whiteSpace) el.style.whiteSpace = node.style.whiteSpace;
        else if (node.type === "label" || node.type === "badge") el.style.whiteSpace = "nowrap";
        el.textContent = node.text ?? "";
        break;
      }
      case "spacer":
        el.style.flex = "1 1 auto";
        break;
      case "divider":
        el.style.height = "1px";
        el.style.background = "var(--gf-border)";
        el.style.margin = "4px 0";
        break;
      case "bar": {
        el.style.background = node.style?.bg ?? "color-mix(in srgb, var(--gf-panel-solid) 70%, transparent)";
        el.style.border = `var(--gf-border) solid var(--gf-border)`;
        el.style.overflow = "hidden";
        el.style.minHeight = "14px";
        const fill = document.createElement("div");
        fill.style.cssText =
          "position:absolute;left:0;top:0;bottom:0;width:100%;background:var(--gf-accent);transition:width 90ms linear";
        const label = document.createElement("span");
        label.style.cssText =
          "position:relative;z-index:1;padding:1px 7px;font-variant-numeric:tabular-nums;text-shadow:0 1px 2px var(--gf-shadow)";
        el.append(fill, label);
        mounted.fill = fill;
        mounted.label = label;
        label.textContent = node.text ?? "";
        break;
      }
      case "button": {
        el.style.cursor = "pointer";
        el.style.background = node.style?.bg ?? "var(--gf-panel)";
        el.style.color = node.style?.fg ?? node.style?.color ?? "var(--gf-text)";
        el.style.padding = node.style?.pad ?? "6px 12px";
        el.style.borderRadius = node.style?.radius ?? "var(--gf-radius)";
        el.style.border = node.style?.border ?? "var(--gf-border) solid var(--gf-border)";
        el.style.backdropFilter = "blur(var(--gf-blur))";
        el.style.textAlign = "center";
        el.style.font = "inherit";
        el.style.fontSize = "var(--gf-font-size)";
        el.style.display = "flex";
        el.style.alignItems = "center";
        el.style.justifyContent = "center";
        el.style.gap = "6px";
        if (node.icon) {
          const icon = document.createElement("span");
          icon.textContent = node.icon;
          icon.style.pointerEvents = "none";
          el.append(icon);
          mounted.icon = icon;
        }
        const text = document.createElement("span");
        text.textContent = node.text ?? "";
        text.style.pointerEvents = "none";
        el.append(text);
        mounted.label = text;
        this.attachDeform(mounted);
        el.addEventListener("click", () => this.action(node.on?.press ?? node.id, node.value ?? 0, node));
        break;
      }
      case "item": {
        el.style.cursor = "pointer";
        el.style.background = node.style?.bg ?? "var(--gf-panel)";
        el.style.border = node.style?.border ?? "var(--gf-border) solid var(--gf-border)";
        el.style.borderRadius = node.style?.radius ?? "var(--gf-radius)";
        el.style.padding = node.style?.pad ?? "var(--gf-pad)";
        el.style.color = "var(--gf-text)";
        el.style.textAlign = "left";
        el.style.gap = "4px";
        el.style.font = "inherit";
        el.style.fontSize = "var(--gf-font-size)";
        const head = document.createElement("div");
        head.style.cssText = "display:flex;align-items:center;gap:8px;font-weight:600;pointer-events:none";
        const icon = document.createElement("span");
        icon.textContent = node.icon ?? "▪";
        icon.style.fontSize = "1.35em";
        const name = document.createElement("span");
        name.textContent = node.text ?? node.id;
        head.append(icon, name);
        const desc = document.createElement("div");
        desc.style.cssText =
          "font-size:0.82em;color:var(--gf-text-dim);line-height:1.35;pointer-events:none";
        desc.textContent = String(node.data?.description ?? "");
        el.append(head, desc);
        mounted.icon = icon;
        mounted.label = name;
        this.attachDeform(mounted);
        el.addEventListener("click", () => this.action(node.on?.press ?? node.id, node.value ?? 0, node));
        break;
      }
      case "slider": {
        el.style.display = "flex";
        el.style.alignItems = "center";
        el.style.gap = "var(--gf-gap)";
        const label = document.createElement("span");
        label.style.cssText = "min-width:96px;color:var(--gf-text-dim);font-size:0.85em";
        label.textContent = node.text ?? node.id;
        const input = document.createElement("input");
        input.type = "range";
        input.min = String(node.min ?? 0);
        input.max = String(node.max ?? 1);
        input.step = String(node.step ?? 0.01);
        input.value = String(node.value ?? 0);
        input.style.cssText = "flex:1;accent-color:var(--gf-accent);background:transparent";
        const output = document.createElement("span");
        output.style.cssText =
          "min-width:46px;text-align:right;font-variant-numeric:tabular-nums;color:var(--gf-accent)";
        output.textContent = String(node.value ?? 0);
        input.addEventListener("input", () =>
          this.action(node.on?.change ?? node.id, Number(input.value), node),
        );
        input.addEventListener("click", (event) => event.stopPropagation());
        el.append(label, input, output);
        mounted.label = label;
        mounted.fill = output;
        break;
      }
      case "toggle": {
        el.style.display = "flex";
        el.style.alignItems = "center";
        el.style.justifyContent = "space-between";
        el.style.gap = "var(--gf-gap)";
        const label = document.createElement("span");
        label.textContent = node.text ?? node.id;
        const knob = document.createElement("span");
        knob.style.cssText =
          "width:42px;height:22px;border-radius:11px;border:1px solid var(--gf-border);background:var(--gf-panel-solid);position:relative;cursor:pointer;transition:background 120ms ease";
        const dot = document.createElement("span");
        dot.style.cssText =
          "position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:var(--gf-text-dim);transition:all 140ms cubic-bezier(.34,1.56,.64,1)";
        knob.append(dot);
        const state = { on: !!node.value };
        const paint = () => {
          knob.style.background = state.on ? "var(--gf-accent-soft)" : "var(--gf-panel-solid)";
          dot.style.left = state.on ? "22px" : "2px";
          dot.style.background = state.on ? "var(--gf-accent)" : "var(--gf-text-dim)";
        };
        paint();
        knob.addEventListener("click", () => {
          state.on = !state.on;
          paint();
          this.action(node.on?.change ?? node.id, state.on ? 1 : 0, node);
        });
        el.append(label, knob);
        mounted.label = label;
        mounted.fill = knob;
        break;
      }
      case "tabs": {
        el.style.display = "flex";
        el.style.flexWrap = "wrap";
        el.style.gap = "4px";
        for (const option of node.options ?? []) {
          const tab = document.createElement("button");
          tab.type = "button";
          tab.textContent = option;
          tab.dataset.tab = option;
          tab.style.cssText =
            "cursor:pointer;font:inherit;font-size:0.85em;padding:4px 10px;border-radius:var(--gf-radius);border:1px solid var(--gf-border);background:transparent;color:var(--gf-text-dim);transition:all 120ms ease";
          tab.addEventListener("click", () => this.action(node.on?.press ?? node.id, option, node));
          el.append(tab);
        }
        break;
      }
      default:
        break;
    }

    for (const child of node.children ?? []) {
      const mountedChild = this.build(child, seen);
      if (mountedChild) {
        el.append(mountedChild.el);
        mounted.children.push(mountedChild);
      }
    }
    if (node.type === "panel") {
      if (!node.style?.bg) el.style.background = "var(--gf-panel)";
      if (!node.style?.border) el.style.border = "var(--gf-border) solid var(--gf-border)";
      if (!node.style?.radius) el.style.borderRadius = "var(--gf-radius)";
      if (!node.style?.pad) el.style.padding = "var(--gf-pad)";
      el.style.backdropFilter = "blur(var(--gf-blur))";
      el.style.boxShadow = "0 12px 30px var(--gf-shadow)";
      if (this.theme.deform.popIn > 0)
        el.animate(
          [
            { transform: "scale(0.92) translateY(6px)", opacity: 0 },
            { transform: "scale(1.01) translateY(0)", opacity: 1, offset: 0.7 },
            { transform: "scale(1)", opacity: 1 },
          ],
          { duration: this.theme.deform.popIn, easing: "cubic-bezier(.2,.9,.25,1.2)" },
        );
    }
    this.mounted.set(node.id, mounted);
    /* `bind` é um ALIAS do nó: `flush({ hp: ... })` escreve no widget que
       declarou `bind: "hp"` sem o chamador precisar conhecer ids de DOM. */
    if (node.bind) this.mounted.set(node.bind, mounted);
    return mounted;
  }

  /** Deformação de feedback: acha o widget no clique e no hover. */
  private attachDeform(mounted: Mounted) {
    const amount = (mounted.node.style?.deform ?? 1) * this.theme.deform.press;
    const hover = this.theme.deform.hover;
    const el = mounted.el;
    const base = mounted.node.style?.transform ?? "";
    el.addEventListener("pointerdown", () => {
      el.style.transform = `scale(${1 - amount}, ${1 - amount * 0.4}) ${base}`;
    });
    const reset = () => {
      el.style.transform = base;
    };
    el.addEventListener("pointerup", reset);
    el.addEventListener("pointerleave", reset);
    el.addEventListener("pointercancel", reset);
    if (hover > 0) {
      el.addEventListener("pointerenter", () => {
        el.style.transform = `translateY(-${hover}px) ${base}`;
        el.style.boxShadow = `0 0 ${hover * 2}px var(--gf-accent-soft)`;
      });
      el.addEventListener("pointerleave", () => {
        el.style.boxShadow = "none";
      });
    }
  }

  /** Atualização por quadro: só toca no DOM quando o valor muda. */
  flush(values: Record<string, BindValue>) {
    for (const [key, value] of Object.entries(values)) {
      const mounted = this.mounted.get(key);
      if (!mounted) continue;
      const signature = JSON.stringify(value);
      if (signature === mounted.last) continue;
      mounted.last = signature;
      if (value.text !== undefined) {
        if (mounted.label) mounted.label.textContent = value.text;
        else mounted.el.textContent = value.text;
      }
      if (value.value !== undefined && mounted.fill) {
        if (mounted.fill instanceof HTMLInputElement) {
          if (mounted.fill.type === "range") mounted.fill.value = String(value.value);
        } else if (mounted.fill.tagName === "SPAN") {
          if (mounted.node.type === "slider") mounted.fill.textContent = value.text ?? String(value.value);
          else mounted.fill.textContent = value.text ?? mounted.fill.textContent;
        } else {
          mounted.fill.style.width = `${clamp(value.value, 0, 1) * 100}%`;
          if (mounted.node.type === "bar")
            mounted.fill.style.background = value.color ?? "var(--gf-accent)";
        }
      }
      if (value.color !== undefined) mounted.el.style.color = value.color;
      if (value.hidden !== undefined) mounted.el.hidden = value.hidden;
    }
  }

  element(id: string) {
    return this.mounted.get(id)?.el ?? null;
  }

  setHidden(id: string, hidden: boolean) {
    const mounted = this.mounted.get(id);
    if (mounted) mounted.el.hidden = hidden;
  }

  /** Marca a aba ativa em um grupo de `tabs`. */
  markTab(id: string, active: string) {
    const mounted = this.mounted.get(id);
    if (!mounted) return;
    for (const tab of mounted.el.children) {
      const element = tab as HTMLElement;
      const on = element.dataset.tab === active;
      element.style.background = on ? "var(--gf-accent-soft)" : "transparent";
      element.style.color = on ? "var(--gf-accent)" : "var(--gf-text-dim)";
      element.style.borderColor = on ? "var(--gf-accent)" : "var(--gf-border)";
    }
  }

  /** Monitor decorativo opcional (scanlines/vinheta do tema). */
  overlay() {
    const overlay = document.createElement("div");
    overlay.dataset.gfManaged = "1";
    overlay.style.cssText =
      "position:absolute;inset:0;pointer-events:none;background:" +
      "repeating-linear-gradient(0deg, rgba(0,0,0,var(--gf-scanlines)) 0 1px, transparent 1px 3px)," +
      "radial-gradient(circle at 50% 50%, transparent 45%, rgba(0,0,0,var(--gf-vignette)) 100%)";
    return overlay;
  }

  destroy() {
    this.root.replaceChildren();
    this.mounted.clear();
  }
}
