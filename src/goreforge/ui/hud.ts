import * as THREE from "three";
import type { GameContext } from "../game/context";
import { UI, type UINode } from "./uikit";
import { formatClock, formatNumber, projectToScreen } from "../game/util";
import { quickSlots, weaponFor } from "../config/weapons";

/**
 * HUD modular.
 *
 * Duas camadas:
 *  1. PAINÉIS (uikit): vida, munição, slots, zona, diagnóstico e placar. As
 *     posições vêm de `hudLayouts` (dado), então trocar o layout no menu move
 *     tudo sem tocar em código.
 *  2. OVERLAY (DOM direto): mira dinâmica, marcas de acerto, killfeed, avisos,
 *     números de dano projetados e tela de morte — coisas que mudam em
 *     coordenadas de tela e não são retângulos fixos.
 */
type Anchor = "tl" | "tr" | "bl" | "br" | "tc" | "bc" | "c";

interface WidgetPlacement {
  anchor: Anchor;
  dx: string;
  dy: string;
  scale?: number;
}

const anchors: Record<Anchor, string> = {
  tl: "left:var(--gf-pad);top:var(--gf-pad)",
  tr: "right:var(--gf-pad);top:var(--gf-pad)",
  bl: "left:var(--gf-pad);bottom:var(--gf-pad)",
  br: "right:var(--gf-pad);bottom:var(--gf-pad)",
  tc: "left:50%;top:var(--gf-pad);transform:translateX(-50%)",
  bc: "left:50%;bottom:var(--gf-pad);transform:translateX(-50%)",
  c: "left:50%;top:50%;transform:translate(-50%,-50%)",
};

/** Posições por layout — dado puro, editável no menu de Interface. */
export const hudLayouts: Record<string, Record<string, WidgetPlacement>> = {
  classico: {
    vitals: { anchor: "bl", dx: "0", dy: "0" },
    ammo: { anchor: "br", dx: "0", dy: "0" },
    slots: { anchor: "br", dx: "0", dy: "86px" },
    zone: { anchor: "tl", dx: "0", dy: "0" },
    diagnostics: { anchor: "tr", dx: "0", dy: "0" },
    score: { anchor: "tc", dx: "0", dy: "0" },
  },
  compacto: {
    vitals: { anchor: "bl", dx: "0", dy: "0", scale: 0.85 },
    ammo: { anchor: "br", dx: "0", dy: "0", scale: 0.85 },
    slots: { anchor: "br", dx: "0", dy: "62px", scale: 0.8 },
    zone: { anchor: "tl", dx: "0", dy: "0", scale: 0.85 },
    diagnostics: { anchor: "tr", dx: "0", dy: "0", scale: 0.8 },
    score: { anchor: "tc", dx: "0", dy: "0", scale: 0.85 },
  },
  minimalista: {
    vitals: { anchor: "bl", dx: "0", dy: "0", scale: 0.9 },
    ammo: { anchor: "br", dx: "0", dy: "0", scale: 0.9 },
    slots: { anchor: "bc", dx: "0", dy: "6px", scale: 0.75 },
    zone: { anchor: "tl", dx: "0", dy: "0", scale: 0.75 },
    diagnostics: { anchor: "tr", dx: "0", dy: "0", scale: 0.7 },
    score: { anchor: "tc", dx: "0", dy: "0", scale: 0.8 },
  },
  tatico: {
    vitals: { anchor: "bl", dx: "0", dy: "0" },
    ammo: { anchor: "bl", dx: "244px", dy: "0" },
    slots: { anchor: "bl", dx: "0", dy: "78px", scale: 0.85 },
    zone: { anchor: "tc", dx: "0", dy: "0", scale: 0.9 },
    diagnostics: { anchor: "tr", dx: "0", dy: "0" },
    /* tc + dy: fica abaixo do cabeçalho de zona, nunca sob o diagnóstico. */
    score: { anchor: "tc", dx: "0", dy: "74px", scale: 0.9 },
  },
};

export class Hud {
  private hudRoot = document.createElement("div");
  private overlay = document.createElement("div");
  private ui: UI;
  private crosshair!: HTMLDivElement;
  private crossLines: HTMLDivElement[] = [];
  private hitMarker!: HTMLDivElement;
  private feedList!: HTMLDivElement;
  private toastList!: HTMLDivElement;
  private numberLayer!: HTMLDivElement;
  private hitDirections: HTMLDivElement[] = [];
  private visible = true;
  private deathScreen!: HTMLDivElement;
  private hint!: HTMLDivElement;
  private reloadRing!: HTMLDivElement;
  private lastZone = "";
  private decalCount = 0;

  constructor(
    host: HTMLElement,
    private ctx: GameContext,
  ) {
    this.hudRoot.dataset.gfManaged = "1";
    this.hudRoot.style.cssText = "position:absolute;inset:0;pointer-events:none";
    this.overlay.dataset.gfManaged = "1";
    this.overlay.style.cssText = "position:absolute;inset:0;pointer-events:none";
    host.append(this.overlay, this.hudRoot);
    this.ui = new UI(this.hudRoot, ctx.store.theme);
    this.buildOverlay();
    this.buildLayout(ctx.settings.hudLayout);
  }

  /* ---------------------------------------------------------------- DOM --- */
  private buildOverlay() {
    this.crosshair = document.createElement("div");
    this.crosshair.dataset.gfPart = "crosshair";
    this.crosshair.style.cssText =
      "position:absolute;left:50%;top:50%;width:42px;height:42px;transform:translate(-50%,-50%);pointer-events:none";
    for (let i = 0; i < 4; i++) {
      const line = document.createElement("div");
      line.style.cssText =
        "position:absolute;background:var(--gf-accent);box-shadow:0 0 3px var(--gf-shadow);transition:none";
      if (i === 0) line.style.cssText += ";width:2px;height:8px;left:20px";
      if (i === 1) line.style.cssText += ";width:2px;height:8px;left:20px;bottom:0";
      if (i === 2) line.style.cssText += ";height:2px;width:8px;top:20px";
      if (i === 3) line.style.cssText += ";height:2px;width:8px;top:20px;right:0";
      this.crosshair.append(line);
      this.crossLines.push(line);
    }
    const dot = document.createElement("div");
    dot.style.cssText =
      "position:absolute;left:19px;top:19px;width:4px;height:4px;border-radius:50%;background:var(--gf-accent)";
    this.crosshair.append(dot);

    this.hitMarker = document.createElement("div");
    this.hitMarker.style.cssText =
      "position:absolute;left:50%;top:50%;width:26px;height:26px;transform:translate(-50%,-50%) rotate(45deg);opacity:0;transition:opacity 60ms linear";
    for (let i = 0; i < 2; i++) {
      const stroke = document.createElement("div");
      stroke.style.cssText = `position:absolute;${
        i === 0 ? "left:12px;top:0;width:2px;height:26px" : "top:12px;left:0;height:2px;width:26px"
      };background:var(--gf-danger);opacity:0.9`;
      this.hitMarker.append(stroke);
    }

    this.reloadRing = document.createElement("div");
    this.reloadRing.style.cssText =
      "position:absolute;left:50%;top:calc(50% + 46px);transform:translateX(-50%);height:3px;width:120px;background:var(--gf-panel-solid);border:1px solid var(--gf-border);border-radius:2px;overflow:hidden;opacity:0";
    const reloadFill = document.createElement("div");
    reloadFill.dataset.gfPart = "reload-fill";
    reloadFill.style.cssText = "height:100%;width:0;background:var(--gf-warning)";
    this.reloadRing.append(reloadFill);

    this.feedList = document.createElement("div");
    this.feedList.style.cssText =
      "position:absolute;right:var(--gf-pad);top:188px;display:flex;flex-direction:column;align-items:flex-end;gap:4px;max-width:330px";
    this.toastList = document.createElement("div");
    this.toastList.style.cssText =
      "position:absolute;left:50%;bottom:132px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:5px";
    this.numberLayer = document.createElement("div");
    this.numberLayer.style.cssText = "position:absolute;inset:0";

    for (let i = 0; i < 1; i++) {
      const indicator = document.createElement("div");
      indicator.style.cssText =
        "position:absolute;left:50%;top:50%;width:96px;height:96px;margin:-48px 0 0 -48px;opacity:0;transition:opacity 120ms linear";
      const arc = document.createElement("div");
      arc.style.cssText =
        "position:absolute;left:50%;top:0;width:0;height:0;margin-left:-16px;border-left:16px solid transparent;border-right:16px solid transparent;border-bottom:12px solid var(--gf-danger);filter:drop-shadow(0 0 6px var(--gf-danger))";
      indicator.append(arc);
      this.hitDirections.push(indicator);
      this.overlay.append(indicator);
    }

    this.deathScreen = document.createElement("div");
    this.deathScreen.style.cssText =
      "position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:linear-gradient(0deg, rgba(60,0,0,0.55), rgba(0,0,0,0.75));pointer-events:auto;text-align:center";
    this.deathScreen.innerHTML = `
      <div style="font-size:clamp(28px,6vw,64px);font-weight:800;letter-spacing:0.12em;color:var(--gf-danger);text-shadow:0 0 22px var(--gf-danger)">VOCÊ MORREU</div>
      <div data-death-info style="color:var(--gf-text-dim);font-size:0.95em"></div>
      <button data-death-respawn style="pointer-events:auto;cursor:pointer;font:inherit;font-size:1.05em;padding:10px 22px;border-radius:var(--gf-radius);border:1px solid var(--gf-border);background:var(--gf-panel);color:var(--gf-text)">Renascer (R)</button>`;
    const respawnButton = this.deathScreen.querySelector<HTMLButtonElement>("[data-death-respawn]");
    respawnButton?.addEventListener("click", () => this.ctx.player.respawn());
    this.overlay.append(this.deathScreen);

    this.hint = document.createElement("div");
    this.hint.style.cssText =
      "position:absolute;left:50%;top:64%;transform:translateX(-50%);padding:8px 16px;border:1px solid var(--gf-border);border-radius:var(--gf-radius);background:var(--gf-panel);color:var(--gf-text);font-size:0.9em;letter-spacing:0.06em;white-space:nowrap;backdrop-filter:blur(var(--gf-blur));opacity:0;transition:opacity 220ms ease";
    this.hint.textContent = "CLIQUE PARA JOGAR · TAB abre o menu de spawn";
    this.overlay.append(this.hint);

    this.overlay.append(
      this.crosshair,
      this.hitMarker,
      this.reloadRing,
      this.feedList,
      this.toastList,
      this.numberLayer,
    );
  }

  /** Monta os painéis do HUD conforme o layout escolhido (dado). */
  buildLayout(layoutId: string) {
    const layout = hudLayouts[layoutId] ?? hudLayouts.classico;
    const place = (id: string, node: UINode) => {
      const placement = layout[id] ?? { anchor: "tl" as Anchor, dx: "0", dy: "0" };
      return {
        ...node,
        style: {
          ...node.style,
          width: node.style?.width ?? "max-content",
          transform: placement.scale ? `scale(${placement.scale})` : undefined,
        },
        className: `gf-hud-${id}`,
        data: { ...node.data, placement },
      };
    };
    const tree: UINode[] = [
      place("vitals", {
        id: "hud-vitals",
        type: "panel",
        style: { width: "228px", gap: "5px", pad: "8px 10px" },
        children: [
          {
            id: "hud-vitals-name",
            type: "keyvalue",
            children: [
              { id: "hud-vitals-label", type: "label", text: "SUJEITO DA FORJA", bind: "vitalsLabel" },
              { id: "hud-vitals-state", type: "badge", text: "PRONTO", bind: "vitalsState" },
            ],
          },
          {
            id: "hud-hp-bar",
            type: "bar",
            value: 1,
            text: "100",
            bind: "hp",
            style: { height: "16px" },
          },
          {
            id: "hud-armor-bar",
            type: "bar",
            value: 0.6,
            text: "50",
            bind: "armor",
            style: { height: "9px" },
          },
          { id: "hud-vitals-meta", type: "label", text: "········", bind: "vitalsMeta", style: { fontSize: "0.78em" } },
        ],
      }),
      place("ammo", {
        id: "hud-ammo",
        type: "panel",
        style: { width: "210px", gap: "3px", pad: "8px 10px", align: "flex-end" },
        children: [
          { id: "hud-ammo-name", type: "label", text: "FUZIL F-90", bind: "weaponName" },
          {
            id: "hud-ammo-count",
            type: "label",
            text: "30 / 240",
            bind: "ammo",
            style: { fontSize: "1.7em", fontWeight: "700" },
          },
          { id: "hud-ammo-mode", type: "badge", text: "AUTO", bind: "fireMode" },
          { id: "hud-ammo-tool", type: "label", text: "", bind: "toolHint", style: { fontSize: "0.78em" } },
        ],
      }),
      place("slots", {
        id: "hud-slots",
        type: "row",
        style: { gap: "4px", pad: "0" },
        children: quickSlots.map((_id, index) => ({
          id: `hud-slot-${index}`,
          type: "badge",
          text: `${index + 1}`,
          bind: `slot${index}`,
          style: { fontSize: "0.8em", minWidth: "26px", align: "center" },
        })),
      }),
      place("zone", {
        id: "hud-zone",
        type: "panel",
        style: { width: "280px", gap: "2px", pad: "7px 10px" },
        children: [
          { id: "hud-zone-name", type: "title", text: "PÁTIO DA FORJA", bind: "zoneName" },
          { id: "hud-zone-hint", type: "label", text: "", bind: "zoneHint", style: { fontSize: "0.78em" } },
        ],
      }),
      place("diagnostics", {
        id: "hud-diagnostics",
        type: "panel",
        style: { width: "212px", gap: "1px", pad: "7px 10px", fontSize: "0.74em" },
        children: [
          { id: "hud-diag-fps", type: "label", text: "60 fps", bind: "diagFps" },
          { id: "hud-diag-physics", type: "label", text: "0 corpos", bind: "diagPhysics" },
          { id: "hud-diag-rigs", type: "label", text: "0 rigs", bind: "diagRigs" },
          { id: "hud-diag-fx", type: "label", text: "0 partículas", bind: "diagFx" },
          { id: "hud-diag-spawned", type: "label", text: "0 criados", bind: "diagSpawned" },
        ],
      }),
      place("score", {
        id: "hud-score",
        type: "panel",
        style: { width: "260px", gap: "1px", pad: "6px 10px", fontSize: "0.85em" },
        children: [
          { id: "hud-score-main", type: "title", text: "0 pts", bind: "score" },
          { id: "hud-score-meta", type: "label", text: "0 abates", bind: "scoreMeta", style: { fontSize: "0.8em" } },
        ],
      }),
    ];
    this.ui.mount(tree);
    this.applyPlacements(layout);
    this.applyScale(this.ctx.settings.hudScale);
    this.applyOpacity(this.ctx.settings.hudOpacity);
  }

  private applyPlacements(layout: Record<string, WidgetPlacement>) {
    for (const [id, placement] of Object.entries(layout)) {
      const el = this.hudRoot.querySelector<HTMLElement>(`.gf-hud-${id}`);
      if (!el) continue;
      el.style.position = "absolute";
      el.style.cssText = `${el.style.cssText.split(";position:absolute")[0]};position:absolute;${anchors[placement.anchor]}`;
      if (placement.dx !== "0") el.style.marginLeft = placement.dx;
      if (placement.dy !== "0") el.style.marginTop = placement.dy;
      if (placement.scale) el.style.scale = String(placement.scale * this.ctx.settings.hudScale);
    }
  }

  applyScale(scale: number) {
    this.overlay.style.fontSize = `${14 * scale}px`;
    for (const el of this.hudRoot.querySelectorAll<HTMLElement>("[data-gf-managed]"))
      if (el.parentElement === this.hudRoot) el.style.fontSize = `${14 * scale}px`;
  }

  applyOpacity(opacity: number) {
    this.hudRoot.style.opacity = String(opacity);
  }

  setTheme(theme = this.ctx.store.theme) {
    this.ui.setTheme(theme);
  }

  setVisible(visible: boolean) {
    this.visible = visible;
    this.overlay.style.display = visible ? "block" : "none";
    this.hudRoot.style.display = visible ? "block" : "none";
  }

  /* ------------------------------------------------------------- update --- */
  update(_dt: number, fps: number) {
    if (!this.visible) return;
    const store = this.ctx.store;
    const player = this.ctx.player;
    const spec = weaponFor(store.weapon);
    const ammo = store.ammoOf();
    if (store.zoneName !== this.lastZone) {
      this.lastZone = store.zoneName;
      this.ctx.store.pushToast(`Zona: ${store.zoneName}`, "info");
    }

    this.ui.flush({
      vitalsLabel: { text: store.zoneName ? "SUJEITO DA FORJA" : "SUJEITO" },
      vitalsState: {
        text: store.godMode ? "DEUS" : !store.alive ? "MORTO" : player.state.toUpperCase(),
      },
      hp: {
        value: store.health / Math.max(1, store.settings.maxHealth),
        text: `${Math.ceil(store.health)}`,
        color: store.health < 30 ? "var(--gf-danger)" : "var(--gf-hp)",
      },
      armor: {
        value: store.armor / Math.max(1, store.settings.maxArmor || 1),
        text: `${Math.ceil(store.armor)}`,
        color: "var(--gf-armor)",
      },
      vitalsMeta: {
        text: `vel ${player.speed.toFixed(1)} m/s · dash ${player.dashing ? "ATIVO" : "pronto"} · ${store.noclip ? "NOCLIP" : player.grounded ? "no chão" : "no ar"}`,
      },
      weaponName: { text: spec.name.toUpperCase() },
      ammo: {
        text: spec.magazine > 0 ? `${ammo.mag} / ${ammo.reserve}` : "∞",
        color: ammo.mag === 0 && spec.magazine > 0 ? "var(--gf-danger)" : "var(--gf-ammo)",
      },
      fireMode: {
        text:
          spec.kind === "tool"
            ? "FERRAMENTA"
            : spec.kind === "melee"
              ? "CORPO A CORPO"
              : spec.auto
                ? "AUTO"
                : "SEMI",
      },
      toolHint: {
        text:
          spec.kind === "tool"
            ? this.ctx.tools.holding
              ? "segurando — direito arremessa"
              : "esquerdo usa · direito alterna"
            : "",
      },
      zoneName: { text: store.zoneName.toUpperCase() || this.ctx.meta.name },
      zoneHint: { text: store.zoneHint },
      diagFps: { text: `${fps.toFixed(0)} fps · ${store.particles} partículas` },
      diagPhysics: { text: `${store.bodies} corpos · ${this.decalCount} marcas` },
      diagRigs: { text: `${store.rigs} rigs (máx 12)` },
      diagFx: { text: `${store.spawned} criados · ${this.ctx.combat.projectileCount} projéteis` },
      diagSpawned: {
        text: `destruídos ${store.destroyed} · gore ${store.gibs} · pilha ${this.ctx.store.spawnedNow}`,
      },
      score: { text: `${formatNumber(store.score)} pts` },
      scoreMeta: {
        text: `${store.kills} abates · ${store.headshots} headshots · combo x${store.combo} · ${formatClock(this.ctx.time)}`,
      },
      ...Object.fromEntries(
        quickSlots.map((id, index) => {
          const weapon = weaponFor(id);
          return [
            `slot${index}`,
            {
              text: `${index + 1} ${weapon.icon}`,
              color: id === store.weapon ? "var(--gf-accent)" : "var(--gf-text-dim)",
            },
          ];
        }),
      ),
    });
    this.decalCount = this.ctx.decals.count;

    /* --------------------------------------------------------- overlay --- */
    const spreadGap = 2.4 + this.ctx.combat.spread * 2.6 + player.speedRatio() * 5;
    this.crossLines[0].style.bottom = `${16 + spreadGap}px`;
    this.crossLines[0].style.top = "0";
    this.crossLines[1].style.top = `${16 + spreadGap}px`;
    this.crossLines[1].style.bottom = "0";
    this.crossLines[2].style.right = `${16 + spreadGap}px`;
    this.crossLines[3].style.left = `${16 + spreadGap}px`;
    const hidden = !store.alive || this.ctx.menuOpen || !!this.ctx.tools.holding;
    this.crosshair.style.opacity = hidden ? "0.15" : "1";
    this.hitMarker.style.opacity = String(store.hitMarker > 0 ? 1 : 0);
    this.hitMarker.style.scale = String(1 + store.hitMarker * 0.6);

    const reloading = store.reloading > 0;
    this.reloadRing.style.opacity = reloading ? "1" : "0";
    if (reloading) {
      const fill = this.reloadRing.querySelector<HTMLElement>("[data-gf-part='reload-fill']")!;
      fill.style.width = `${(1 - store.reloading / Math.max(0.001, spec.reload)) * 100}%`;
    }

    /* killfeed */
    this.feedList.replaceChildren(
      ...store.feed.map((item) => {
        const row = document.createElement("div");
        const color =
          item.kind === "headshot"
            ? "var(--gf-danger)"
            : item.kind === "explosion"
              ? "var(--gf-warning)"
              : item.kind === "destroy"
                ? "var(--gf-ok)"
                : "var(--gf-accent)";
        row.style.cssText = `padding:4px 9px;border-left:3px solid ${color};background:var(--gf-panel);border-radius:calc(var(--gf-radius) * 0.7);font-size:0.82em;opacity:${Math.min(1, item.life / 1.2)};text-align:right;backdrop-filter:blur(var(--gf-blur))`;
        row.innerHTML = `<strong style="color:${color}">${item.text}</strong><br><span style="color:var(--gf-text-dim);font-size:0.9em">${item.detail}</span>`;
        return row;
      }),
    );

    /* avisos */
    this.toastList.replaceChildren(
      ...store.toasts.map((toast) => {
        const row = document.createElement("div");
        const color =
          toast.kind === "bad"
            ? "var(--gf-danger)"
            : toast.kind === "good"
              ? "var(--gf-ok)"
              : toast.kind === "record"
                ? "var(--gf-warning)"
                : "var(--gf-accent)";
        row.style.cssText = `padding:5px 12px;border:1px solid var(--gf-border);border-left:3px solid ${color};background:var(--gf-panel);border-radius:var(--gf-radius);font-size:0.86em;opacity:${Math.min(1, toast.life / 0.8)};backdrop-filter:blur(var(--gf-blur))`;
        row.textContent = toast.text;
        return row;
      }),
    );

    /* números de dano projetados */
    const width = this.ctx.renderer.domElement.clientWidth;
    const height = this.ctx.renderer.domElement.clientHeight;
    const nodes: HTMLElement[] = [];
    for (const number of store.numbers) {
      const point = new THREE.Vector3(number.x, number.y, number.z);
      const screen = projectToScreen(point, this.ctx.camera, width, height);
      if (!screen.visible) continue;
      const el = document.createElement("div");
      const rise = (1.1 - number.life) * 34;
      const color =
        number.kind === "headshot"
          ? "var(--gf-danger)"
          : number.kind === "gib"
            ? "var(--gf-warning)"
            : "var(--gf-text)";
      el.style.cssText = `position:absolute;left:${screen.x}px;top:${screen.y - rise}px;transform:translate(-50%,-50%);font-weight:700;font-size:${number.kind === "headshot" ? "1.15em" : "0.95em"};color:${color};text-shadow:0 1px 3px var(--gf-shadow);opacity:${Math.min(1, number.life / 0.5)}`;
      el.textContent = `${Math.round(number.value)}`;
      nodes.push(el);
    }
    this.numberLayer.replaceChildren(...nodes);

    /* indicador direcional de dano */
    const indicator = this.hitDirections[0];
    if (store.hitDirection.life > 0) {
      const angle = THREE.MathUtils.radToDeg(store.hitDirection.angle - this.ctx.rig.yaw);
      indicator.style.transform = `rotate(${angle}deg)`;
      indicator.style.opacity = String(Math.min(1, store.hitDirection.life));
    } else {
      indicator.style.opacity = "0";
    }

    /* morte + dica de clique */
    const deathVisible = !store.alive;
    this.deathScreen.style.display = deathVisible ? "flex" : "none";
    if (deathVisible) {
      const info = this.deathScreen.querySelector<HTMLElement>("[data-death-info]");
      if (info)
        info.textContent = `${store.deaths} mortes · ${store.kills} abates · renascendo em ${store.respawnIn.toFixed(1)}s`;
    }
    const wantHint =
      store.alive && !this.ctx.menuOpen && !this.ctx.input.pointerLocked && this.ctx.input.touch === false;
    this.hint.style.opacity = wantHint ? "1" : "0";
  }

  dispose() {
    this.ui.destroy();
    this.hudRoot.remove();
    this.overlay.remove();
  }
}
