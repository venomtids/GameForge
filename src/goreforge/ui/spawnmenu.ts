import type { GameContext } from "../game/context";
import { UI, type UINode } from "./uikit";
import {
  searchSpawnables,
  spawnCategories,
  spawnUnitCount,
  spawnableFor,
  spawnables,
  type Spawnable,
} from "../config/spawnables";
import { tools, quickSlots, weaponFor } from "../config/weapons";

/**
 * MENU DE SPAWN — o coração do sandbox.
 *
 * Todo o conteúdo vem de `config/spawnables.ts` (dados). O menu monta abas por
 * categoria, busca por nome/tag, favoritos, recentes e controles de escala e
 * velocidade de criação. Armas e ferramentas aparecem nas mesmas abas.
 */
export class SpawnMenu {
  panel: UINode;
  private ui: UI;
  private category: string = spawnCategories[0];
  private query = "";
  private lastRebuild = "";
  private searchInput!: HTMLInputElement;
  private gridHost!: HTMLElement;
  private footerHost!: HTMLElement;
  open = false;

  constructor(
    private ctx: GameContext,
    host: HTMLElement,
    private action: (action: string, value?: number | string, node?: UINode) => void,
  ) {
    const root = document.createElement("div");
    root.dataset.gfManaged = "1";
    root.style.cssText =
      "position:absolute;inset:0;display:none;place-items:center;pointer-events:auto;background:rgba(4,4,6,0.45);backdrop-filter:blur(2px)";
    root.dataset.gfPart = "spawn-backdrop";
    host.append(root);
    this.ui = new UI(root, ctx.store.theme);
    this.ui.onAction((a, v, node) => this.action(a, v, node));
    this.panel = {
      id: "spawn-panel",
      type: "panel",
      style: {
        width: "min(980px, 94vw)",
        height: "min(640px, 86vh)",
        gap: "10px",
        pad: "14px",
      },
      children: [
        {
          id: "spawn-head",
          type: "row",
          style: { align: "center", justify: "space-between", gap: "10px" },
          children: [
            { id: "spawn-title", type: "title", text: "MENU DE SPAWN", style: { fontSize: "1.1em" } },
            {
              id: "spawn-subtitle",
              type: "label",
              text: "",
              bind: "spawnSubtitle",
              style: { fontSize: "0.8em", color: "var(--gf-text-dim)" },
            },
            { id: "spawn-close", type: "button", text: "Fechar (Tab)", icon: "✕", style: { pad: "5px 10px" } },
          ],
        },
        { id: "spawn-search-row", type: "row", style: { gap: "8px" } },
        { id: "spawn-tabs", type: "tabs", options: [...spawnCategories, "Armas", "Ferramentas", "Favoritos"] },
        {
          id: "spawn-body",
          type: "row",
          style: { flex: "1", gap: "12px", minHeight: "0" },
        },
        { id: "spawn-footer", type: "row", style: { gap: "8px", align: "center" } },
      ],
    };
    this.ui.mount([this.panel]);
    this.searchInput = document.createElement("input");
    this.searchInput.type = "search";
    this.searchInput.placeholder = "Buscar item, tag ou categoria…";
    this.searchInput.setAttribute("aria-label", "Buscar no menu de spawn");
    this.searchInput.style.cssText =
      "flex:1;font:inherit;font-size:0.9em;padding:6px 10px;border-radius:var(--gf-radius);border:1px solid var(--gf-border);background:var(--gf-panel-solid);color:var(--gf-text)";
    this.searchInput.addEventListener("input", () => {
      this.query = this.searchInput.value;
      this.rebuild();
    });
    this.ui.element("spawn-search-row")?.append(this.searchInput);
    const filters = document.createElement("div");
    filters.style.cssText = "display:flex;gap:6px";
    for (const [label, mode] of [
      ["Mira", "crosshair"],
      ["No pé", "player"],
    ] as const) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.dataset.mode = mode;
      button.style.cssText =
        "cursor:pointer;font:inherit;font-size:0.8em;padding:4px 10px;border-radius:var(--gf-radius);border:1px solid var(--gf-border);background:transparent;color:var(--gf-text-dim)";
      button.addEventListener("click", () => this.action("spawn-mode", mode));
      filters.append(button);
    }
    this.ui.element("spawn-search-row")?.append(filters);
    this.gridHost = this.ui.element("spawn-body")!;
    this.footerHost = this.ui.element("spawn-footer")!;
  }

  toggle() {
    if (this.open) this.close();
    else this.show();
  }

  show() {
    this.open = true;
    (this.ui.root as HTMLElement).style.display = "grid";
    this.refresh();
    this.ui.root.animate(
      [
        { opacity: 0, transform: "scale(0.98)" },
        { opacity: 1, transform: "scale(1)" },
      ],
      { duration: Math.max(90, this.ctx.store.theme.deform.popIn), easing: "ease-out" },
    );
    this.ctx.world.audio.play("ui.abrir", 0.5, 1);
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.searchInput.blur();
    (this.ui.root as HTMLElement).style.display = "none";
    this.ctx.world.audio.play("ui.fechar", 0.5, 1);
  }

  setTheme(theme = this.ctx.store.theme) {
    this.ui.setTheme(theme);
  }

  /** Troca de categoria (ação `spawn-tabs` vinda do UI kit). */
  setCategory(category: string) {
    const all: string[] = [...spawnCategories, "Armas", "Ferramentas", "Favoritos"];
    if (!all.includes(category) || this.category === category) return;
    this.category = category;
    this.query = "";
    this.searchInput.value = "";
    this.rebuild();
  }

  /** Força a reconstrução no próximo refresh. */
  rebuild() {
    this.lastRebuild = "";
    this.refresh();
  }

  /** Recria grade/rodapé quando categoria, busca ou inventário mudam. */
  refresh() {
    const signature = `${this.category}|${this.query}|${this.ctx.store.spawnFavorites.join(",")}|${this.ctx.store.spawnRecent.join(",")}|${this.ctx.store.spawnMode}|${this.ctx.store.spawnScale.toFixed(2)}`;
    if (signature === this.lastRebuild) return;
    this.lastRebuild = signature;
    this.ui.markTab("spawn-tabs", this.category);
    this.buildGrid();
    this.buildFooter();
    this.ui.flush({
      spawnSubtitle: {
        text: `${spawnables.length} itens · gelatina, explosivos, NPCs e ferramentas da engine`,
      },
    });
  }

  private itemsFor(): { kind: "spawn" | "weapon" | "tool"; item: Spawnable | string }[] {
    if (this.category === "Armas")
      return quickSlots.map((id) => ({ kind: "weapon" as const, item: id }));
    if (this.category === "Ferramentas")
      return tools.map((id) => ({ kind: "tool" as const, item: id }));
    if (this.category === "Favoritos")
      return this.ctx.store.spawnFavorites
        .map((id) => spawnables.find((s) => s.id === id))
        .filter((s): s is Spawnable => !!s)
        .map((item) => ({ kind: "spawn" as const, item }));
    const list = this.query
      ? searchSpawnables(this.query)
      : spawnables.filter((s) => s.category === this.category);
    return list.map((item) => ({ kind: "spawn" as const, item }));
  }

  private buildGrid() {
    const grid = document.createElement("div");
    grid.style.cssText =
      "flex:1;display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px;overflow-y:auto;padding-right:6px;align-content:start";
    for (const entry of this.itemsFor()) {
      const card = document.createElement("button");
      card.type = "button";
      const isWeapon = entry.kind !== "spawn";
      const spec = isWeapon ? weaponFor(entry.item as string) : null;
      const item = isWeapon ? null : (entry.item as Spawnable);
      const selected = !isWeapon && item!.id === this.ctx.store.spawnSelection;
      card.dataset.item = isWeapon ? String(entry.item) : item!.id;
      card.style.cssText = `cursor:pointer;text-align:left;display:flex;flex-direction:column;gap:4px;padding:9px 10px;border-radius:var(--gf-radius);border:1px solid ${
        selected ? "var(--gf-accent)" : "var(--gf-border)"
      };background:var(--gf-panel);color:var(--gf-text);font:inherit;transition:transform 90ms ease`;
      const favorite = !isWeapon && this.ctx.store.spawnFavorites.includes(item!.id);
      card.innerHTML = `
        <span style="display:flex;align-items:center;gap:8px;font-weight:600">
          <span style="font-size:1.35em">${isWeapon ? spec!.icon : item!.icon}</span>
          <span>${isWeapon ? spec!.name : item!.name}</span>
        </span>
        <span style="font-size:0.78em;color:var(--gf-text-dim);line-height:1.35">${
          isWeapon ? spec!.description : item!.description
        }</span>
        <span style="font-size:0.72em;color:var(--gf-accent)">${
          isWeapon
            ? spec!.kind === "tool"
              ? "ferramenta"
              : `dano ${spec!.damage} · ${spec!.rpm} rpm`
            : `${item!.category}${item!.hp ? ` · ${item!.hp} de resistência` : ""}${spawnUnitCount(item!) > 1 ? ` · ${spawnUnitCount(item!)} corpos` : ""}`
        }</span>`;
      card.addEventListener("click", (event) => {
        if (event.shiftKey && item) {
          this.action("favorite", item.id);
          return;
        }
        this.action(
          isWeapon ? (entry.kind === "tool" ? "equip-tool" : "equip") : "spawn",
          isWeapon ? String(entry.item) : item!.id,
        );
        if (!isWeapon) this.lastRebuild = "";
        this.refresh();
      });
      card.addEventListener("pointerenter", () => (card.style.transform = "translateY(-2px)"));
      card.addEventListener("pointerleave", () => (card.style.transform = "none"));
      if (favorite) {
        const star = document.createElement("span");
        star.textContent = "★";
        star.style.cssText =
          "position:absolute;top:6px;right:8px;color:var(--gf-warning);font-size:0.85em";
        card.append(star);
      }
      grid.append(card);
    }
    if (!grid.children.length) {
      const empty = document.createElement("div");
      empty.style.cssText = "color:var(--gf-text-dim);font-size:0.9em;padding:12px";
      empty.textContent = this.query
        ? `Nada encontrado para "${this.query}".`
        : this.category === "Favoritos"
          ? "Marque itens com Shift+clique para favoritar."
          : "Categoria vazia.";
      grid.append(empty);
    }
    this.gridHost.replaceChildren(grid);
  }

  private buildFooter() {
    const store = this.ctx.store;
    this.footerHost.replaceChildren();
    const info = document.createElement("span");
    info.style.cssText = "font-size:0.8em;color:var(--gf-text-dim);flex:1";
    const selected = spawnableFor(store.spawnSelection);
    info.textContent = `Selecionado: ${selected.icon} ${selected.name} · modo ${
      store.spawnMode === "crosshair" ? "na mira" : "no pé"
    } · escala ${store.spawnScale.toFixed(2)}x`;
    const slider = (label: string, value: number, min: number, max: number, onChange: (v: number) => void) => {
      const wrap = document.createElement("label");
      wrap.style.cssText =
        "display:flex;align-items:center;gap:6px;font-size:0.78em;color:var(--gf-text-dim)";
      wrap.textContent = label;
      const input = document.createElement("input");
      input.type = "range";
      input.min = String(min);
      input.max = String(max);
      input.step = "0.05";
      input.value = String(value);
      input.style.cssText = "width:110px;accent-color:var(--gf-accent)";
      input.addEventListener("input", () => onChange(Number(input.value)));
      wrap.append(input);
      return wrap;
    };
    const button = (label: string, action: string, value = "") => {
      const el = document.createElement("button");
      el.type = "button";
      el.textContent = label;
      el.style.cssText =
        "cursor:pointer;font:inherit;font-size:0.8em;padding:5px 10px;border-radius:var(--gf-radius);border:1px solid var(--gf-border);background:transparent;color:var(--gf-text)";
      el.addEventListener("click", () => this.action(action, value));
      return el;
    };
    const scale = spawnUnitCount(selected);
    this.footerHost.append(
      info,
      slider("escala", store.spawnScale, 0.25, 3, (v) => this.action("spawn-scale", v)),
      slider("empurrão", store.spawnSpeed, 0, 12, (v) => this.action("spawn-speed", v)),
      button(`Criar (${scale})`, "spawn", selected.id),
      button("Horda", "spawn-horde"),
      button("Cenário", "spawn-arena"),
      button("Limpar criados", "clear-spawned"),
      button("Reiniciar pátio", "restart"),
    );
  }

  resize() {
    this.lastRebuild = "";
    this.refresh();
  }

  dispose() {
    this.ui.destroy();
    (this.ui.root as HTMLElement).remove();
  }
}
