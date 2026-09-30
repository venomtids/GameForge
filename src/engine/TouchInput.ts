/** Shared touch controls for the editor runtime AND the offline exported player. */
export class TouchInput {
  private root = document.createElement("div");
  private held = new Map<number, string>();
  private cleanups: (() => void)[] = [];
  private enabled = false;
  private visible = false;
  constructor(
    host: HTMLElement,
    private keys: Set<string>,
    private pressed: Set<string>,
    private released: Set<string>,
    private onAction?: (key: string) => void,
  ) {
    this.root.className = "touch-game-controls";
    this.root.setAttribute("aria-label", "Controles de toque do jogador");
    this.root.style.cssText =
      "position:absolute;inset:auto 0 max(26px,env(safe-area-inset-bottom)) 0;z-index:24;display:none;justify-content:space-between;align-items:end;padding:0 16px;pointer-events:none;user-select:none";
    const pad = document.createElement("div"),
      actions = document.createElement("div");
    pad.style.cssText =
      "display:grid;grid-template-columns:repeat(3,44px);grid-template-rows:repeat(2,44px);gap:4px";
    actions.style.cssText = "display:flex;gap:8px;align-items:end";
    this.root.append(pad, actions);
    const button = (
      label: string,
      key: string,
      text: string,
      parent: HTMLElement,
      grid?: string,
    ) => {
      const element = document.createElement("button");
      element.type = "button";
      element.textContent = text;
      element.setAttribute("aria-label", label);
      element.style.cssText =
        "margin:0;padding:0;pointer-events:auto;touch-action:none;border:1px solid #abd4bb66;background:#152d26b8;color:#def9e8;width:44px;height:44px;border-radius:12px;font:600 17px system-ui;backdrop-filter:blur(6px)" +
        (grid ? `;grid-area:${grid}` : "");
      const down = (e: PointerEvent) => {
        if (!this.enabled) return;
        e.preventDefault();
        e.stopPropagation();
        element.setPointerCapture(e.pointerId);
        this.held.set(e.pointerId, key);
        this.keys.add(key);
        this.pressed.add(key);
        this.onAction?.(key);
        element.style.background = "#659a72db";
      };
      const up = (e: PointerEvent) => {
        e.preventDefault();
        this.held.delete(e.pointerId);
        if (![...this.held.values()].includes(key)) {
          this.keys.delete(key);
          this.released.add(key);
        }
        element.style.background = "#152d26b8";
      };
      element.addEventListener("pointerdown", down);
      element.addEventListener("pointerup", up);
      element.addEventListener("pointercancel", up);
      element.addEventListener("lostpointercapture", up);
      this.cleanups.push(() => {
        element.removeEventListener("pointerdown", down);
        element.removeEventListener("pointerup", up);
        element.removeEventListener("pointercancel", up);
        element.removeEventListener("lostpointercapture", up);
      });
      parent.append(element);
    };
    button("Mover para frente", "w", "↑", pad, "1 / 2");
    button("Mover para esquerda", "a", "←", pad, "2 / 1");
    button("Mover para trás", "s", "↓", pad, "2 / 2");
    button("Mover para direita", "d", "→", pad, "2 / 3");
    button("Correr", "shift", "»", actions);
    button("Pular", " ", "↟", actions);
    button("Retornar ao checkpoint", "r", "↺", actions);
    host.append(this.root);
    const blur = () => this.release();
    window.addEventListener("blur", blur);
    this.cleanups.push(() => window.removeEventListener("blur", blur));
  }
  private release() {
    for (const key of this.held.values()) {
      this.keys.delete(key);
      this.released.add(key);
    }
    this.held.clear();
  }
  setEnabled(enabled: boolean) {
    const visible =
      enabled && (matchMedia("(pointer: coarse)").matches || innerWidth <= 760);
    if (this.enabled && (!enabled || !visible)) this.release();
    this.enabled = enabled;
    if (this.visible !== visible) {
      this.root.style.display = visible ? "flex" : "none";
      this.visible = visible;
    }
  }
  dispose() {
    this.release();
    this.cleanups.forEach((f) => f());
    this.root.remove();
  }
}
