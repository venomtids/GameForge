import type { GameContext } from "./context";

/**
 * Entrada unificada (teclado + mouse + roda + toque).
 *
 * O CameraRig da engine continua cuidando do olhar/pointer lock em primeira
 * pessoa; aqui só registramos estado e "bordas" (pressionado/solto neste
 * quadro), o que deixa o resto do jogo livre de `keydown` espalhado.
 */
export class Input {
  keys = new Set<string>();
  mouse = { left: false, right: false, middle: false };
  wheel = 0;
  lookDeltaX = 0;
  lookDeltaY = 0;
  touch = false;
  private edges = new Set<string>();
  private released = new Set<string>();
  private cleanups: (() => void)[] = [];
  private lastYaw = 0;
  private lastPitch = 0;

  constructor(private ctx: GameContext) {
    const canvas = ctx.renderer.domElement;
    const isTyping = (target: EventTarget | null) =>
      !!(target as HTMLElement | null)?.closest?.("input,textarea,select,[contenteditable]");

    const keydown = (event: KeyboardEvent) => {
      const key = this.normalize(event.key);
      if (isTyping(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
      if (
        [
          "w",
          "a",
          "s",
          "d",
          "q",
          "e",
          "r",
          "f",
          "g",
          "c",
          "v",
          "x",
          "z",
          "tab",
          "space",
          "shift",
          "control",
          "escape",
          "arrowup",
          "arrowdown",
          "arrowleft",
          "arrowright",
        ].includes(key) ||
        /^[1-9]$/.test(key)
      )
        event.preventDefault();
      if (event.repeat) return;
      this.keys.add(key);
      this.edges.add(key);
    };
    const keyup = (event: KeyboardEvent) => {
      const key = this.normalize(event.key);
      this.keys.delete(key);
      this.released.add(key);
    };
    const blur = () => {
      this.keys.clear();
      this.mouse.left = false;
      this.mouse.right = false;
      this.mouse.middle = false;
    };
    const pointerdown = (event: PointerEvent) => {
      if (event.pointerType === "touch") this.touch = true;
      if (isTyping(event.target)) return;
      if (event.button === 0) this.mouse.left = true;
      if (event.button === 1) this.mouse.middle = true;
      if (event.button === 2) this.mouse.right = true;
      this.edges.add(`mouse${event.button}`);
      if (event.button === 1) event.preventDefault();
    };
    const pointerup = (event: PointerEvent) => {
      if (event.button === 0) this.mouse.left = false;
      if (event.button === 1) this.mouse.middle = false;
      if (event.button === 2) this.mouse.right = false;
      this.released.add(`mouse${event.button}`);
    };
    const wheel = (event: WheelEvent) => {
      if (this.ctx.menuOpen) return;
      this.wheel += Math.sign(event.deltaY);
      event.preventDefault();
    };
    const contextmenu = (event: MouseEvent) => event.preventDefault();

    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    window.addEventListener("blur", blur);
    window.addEventListener("pointerup", pointerup);
    canvas.addEventListener("pointerdown", pointerdown);
    canvas.addEventListener("wheel", wheel, { passive: false });
    canvas.addEventListener("contextmenu", contextmenu);
    this.cleanups.push(
      () => window.removeEventListener("keydown", keydown),
      () => window.removeEventListener("keyup", keyup),
      () => window.removeEventListener("blur", blur),
      () => window.removeEventListener("pointerup", pointerup),
      () => canvas.removeEventListener("pointerdown", pointerdown),
      () => canvas.removeEventListener("wheel", wheel),
      () => canvas.removeEventListener("contextmenu", contextmenu),
    );
  }

  private normalize(key: string) {
    const lower = key.toLowerCase();
    if (lower === " " || lower === "spacebar") return "space";
    if (lower === "esc") return "escape";
    return lower;
  }

  /** Pressionado neste quadro (borda, uma vez por toque de tecla). */
  pressed(action: string) {
    return this.edges.has(action);
  }

  down(action: string) {
    if (action.startsWith("mouse")) {
      const button = Number(action.slice(5));
      return button === 0 ? this.mouse.left : button === 1 ? this.mouse.middle : this.mouse.right;
    }
    return this.keys.has(action);
  }

  releasedThisFrame(action: string) {
    return this.released.has(action);
  }

  /** Chamado pelo loop principal DEPOIS de todos os sistemas lerem as bordas. */
  sampleLook() {
    const dx = this.ctx.rig.yaw - this.lastYaw;
    const dy = this.ctx.rig.pitch - this.lastPitch;
    this.lastYaw = this.ctx.rig.yaw;
    this.lastPitch = this.ctx.rig.pitch;
    this.lookDeltaX = dx;
    this.lookDeltaY = dy;
    return { dx, dy };
  }

  endFrame() {
    this.edges.clear();
    this.released.clear();
    this.wheel = 0;
  }

  get pointerLocked() {
    return (
      typeof document !== "undefined" &&
      document.pointerLockElement === this.ctx.renderer.domElement
    );
  }

  dispose() {
    this.cleanups.forEach((fn) => fn());
    this.cleanups = [];
  }
}
