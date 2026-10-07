import type { World } from "./World";
import type { UIElement, PixelTexture } from "./studio-model";
export function textureURL(t: PixelTexture) {
  const c = document.createElement("canvas");
  c.width = c.height = t.size;
  const ctx = c.getContext("2d")!;
  t.pixels.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(i % t.size, Math.floor(i / t.size), 1, 1);
  });
  return c.toDataURL();
}
/** Generic scene interface renderer; all game-specific HUD values come from project scripts. */
export class GameUI {
  root = document.createElement("div");
  elements = new Map<
    string,
    { node: HTMLElement; fill?: HTMLElement; last: string }
  >();
  signature = "";
  hidden = new Set<string>();
  constructor(
    parent: HTMLElement,
    private world: World,
    private pause: (value: boolean) => void,
  ) {
    this.root.className = "game-ui";
    this.root.style.cssText =
      "position:absolute;inset:0;pointer-events:none;z-index:6;overflow:hidden";
    parent.append(this.root);
  }
  rebuild() {
    this.root.replaceChildren();
    this.elements.clear();
    this.hidden.clear();
    for (const e of this.world.ui) {
      const node = document.createElement(
        e.kind === "button" ? "button" : "div",
      );
      node.dataset.uiId = e.id;
      node.setAttribute("aria-label", e.name);
      node.style.cssText = `position:absolute;box-sizing:border-box;left:${e.x}%;top:${e.y}%;width:${e.w}%;height:${e.h}%;font-family:system-ui,sans-serif;font-size:${e.fontSize}px;white-space:pre-line;overflow:hidden;line-height:1.3;padding:5px 8px;border-radius:5px;border:${e.kind === "button" ? "1px solid #ffffff44" : "0"};pointer-events:${e.kind === "button" ? "auto" : "none"};text-align:${e.kind === "button" ? "center" : "left"};`;
      let fill: HTMLElement | undefined;
      if (e.kind === "bar") {
        fill = document.createElement("div");
        fill.style.cssText = "position:absolute;inset:0;right:auto;z-index:0";
        node.append(fill);
        const label = document.createElement("span");
        label.style.cssText =
          "position:relative;z-index:1;text-shadow:0 1px 2px black";
        node.append(label);
      }
      this.root.append(node);
      this.elements.set(e.id, { node, fill, last: "" });
      if (e.textureId) {
        const texture = this.world.settings.textures?.find(
          (t) => t.id === e.textureId,
        );
        if (texture) {
          node.style.backgroundImage = `url(${textureURL(texture)})`;
          node.style.backgroundSize = "100% 100%";
          node.style.imageRendering = "pixelated";
        }
      }
      if (e.kind === "button")
        node.onclick = () => {
          if (e.action === "event") this.world.events.push(e.id);
          if (e.action === "resume") this.pause(false);
          if (e.action === "pause") this.pause(true);
          if (e.action === "respawn") this.world.respawn();
          if (e.action === "hide") this.hidden.add(e.id);
        };
    }
  }
  update(playing: boolean, paused: boolean) {
    this.root.hidden = !playing;
    const sig = this.world.sceneId + JSON.stringify(this.world.ui);
    if (sig !== this.signature) {
      this.signature = sig;
      this.rebuild();
    }
    if (!playing) return;
    for (const original of this.world.ui) {
      const item = this.elements.get(original.id)!;
      const patch = this.world.uiPatches.get(original.id) ?? {};
      const e = { ...original, ...patch } as UIElement & { value?: number };
      item.node.hidden =
        !e.visible ||
        this.hidden.has(e.id) ||
        (e.screen === "playing" && paused) ||
        (e.screen === "paused" && !paused);
      const value = JSON.stringify(e);
      if (value === item.last) continue;
      item.last = value;
      item.node.style.color = e.color;
      item.node.style.backgroundColor = e.background;
      if (item.fill) {
        item.fill.style.width = `${Math.max(0, Math.min(1, e.value ?? 1)) * 100}%`;
        item.fill.style.backgroundColor = e.color;
        item.node.style.color = "#ffffff";
        item.node.lastElementChild!.textContent = e.text;
      } else item.node.textContent = e.text;
    }
  }
  dispose() {
    this.root.remove();
  }
}
