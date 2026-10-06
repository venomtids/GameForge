import * as THREE from "three";
import { World, addLighting } from "../../engine/World";
import { CameraRig } from "../../engine/CameraRig";
import { AdaptiveResolution } from "../../engine/render-quality";
import { configureLighting } from "../../engine/Lighting";
import { arenaProject, type ArenaMeta } from "../arena";
import {
  goreforgeDefaults,
  goreLevels,
  gorePresetPatch,
  saveSettings,
  type GameSettings,
  type QualityMode,
} from "../config/settings";

type HudLayoutId = GameSettings["hudLayout"];
import { serializeTheme, themes, validateTheme, type UITheme } from "../config/theme";
import { quickSlots, tools, weaponFor } from "../config/weapons";
import { spawnables } from "../config/spawnables";
import { GameStore } from "../game/state";
import { Effects } from "../game/fx";
import { Decals } from "../game/decals";
import { Spawner } from "../game/spawner";
import { Destruction } from "../game/destruction";
import { Gibs } from "../game/gibs";
import { Combat } from "../game/combat";
import { PlayerController } from "../game/player";
import { Tools } from "../game/tools";
import { Input } from "../game/input";
import { ViewModel } from "../game/viewmodel";
import type { GameContext, UIHost } from "../game/context";
import { clamp, rng } from "../game/util";
import { Hud, hudLayouts } from "../ui/hud";
import { SpawnMenu } from "../ui/spawnmenu";
import { PauseMenu } from "../ui/pause";
import type { UINode } from "../ui/uikit";

export interface RuntimeOptions {
  container?: HTMLElement;
  canvas?: HTMLCanvasElement;
  /** Inicia o loop automaticamente (padrão: true). */
  autoStart?: boolean;
  /** Semente da aleatoriedade do jogo (o mesmo valor = mesma sessão). */
  seed?: number;
}

const GORE_LABELS = [...goreLevels];

/** Itens que o botão "Cenário" repõe no pátio. */
const ARENA_ITEMS = ["wall", "tower-scaffold", "torre", "block", "crate", "plank"];
/** Corpos que o botão "Horda" solta. */
const HORDE_ITEMS = ["npc-horde", "npc-hunter", "npc-patrol", "jelly-man"];

/**
 * GORE FORGE — runtime do jogo.
 *
 * É o único lugar que conhece TODOS os sistemas ao mesmo tempo. O trabalho dele:
 *
 *  1. montar o `GameContext` compartilhado (World da engine + sistemas do jogo);
 *  2. rodar o loop na ordem correta (física → jogador → efeitos → UI);
 *  3. traduzir as ações de UI (strings vindas dos menus) em mutações de estado —
 *     por isso menu/ HUD são 100% dados e não têm regra de jogo embutida.
 *
 * Nada aqui reimplementa física: o movimento do jogador entra na engine pelo
 * hook `World.playerStep`, e spawn/destruição/armas usam `World.command`.
 */
export class GameRuntime implements UIHost {
  readonly store = new GameStore();
  readonly world: World;
  readonly rig: CameraRig;
  readonly scene = new THREE.Scene();
  readonly renderer: THREE.WebGLRenderer;
  readonly camera: THREE.PerspectiveCamera;
  readonly meta: ArenaMeta;
  readonly project: ReturnType<typeof arenaProject>["project"];
  readonly resolution: AdaptiveResolution;

  readonly fx: Effects;
  readonly decals: Decals;
  readonly spawner: Spawner;
  readonly destruction: Destruction;
  readonly gibs: Gibs;
  readonly combat: Combat;
  readonly player: PlayerController;
  readonly tools: Tools;
  readonly input: Input;
  readonly viewmodel: ViewModel;

  readonly hud: Hud;
  readonly spawnMenu: SpawnMenu;
  readonly pauseMenu: PauseMenu;

  readonly ctx: GameContext;
  readonly random: () => number;
  readonly maxSpawned: number;

  private lightingDispose: (() => void) | null = null;
  private frameHandle = 0;
  private last = 0;
  private fpsSum = 0;
  private fpsFrames = 0;
  private running = false;
  private themeSignature = "";
  private cleanups: (() => void)[] = [];

  constructor(readonly options: RuntimeOptions = {}) {
    this.store.settings = { ...goreforgeDefaults, ...this.store.settings };
    const built = arenaProject();
    this.project = built.project;
    this.meta = built.meta;
    this.random = rng(options.seed ?? 20261006);
    this.maxSpawned = Math.max(120, this.store.settings.npcLimit * 14);

    /* ------------------------------------------------------------ engine --- */
    const canvas = options.canvas ?? document.createElement("canvas");
    canvas.style.cssText = "display:block;width:100%;height:100%;touch-action:none;outline:none";
    /* Reaproveita o rig de luz do Studio, mas com um ajuste de jogo: o jogo é
       mais fechado (pátio com gore) e o céu do ambiente lavava os materiais. */
    this.lightingDispose = addLighting(this.scene);
    for (const name of ["studio-ambient", "studio-fill"] as const) {
      const light = this.scene.getObjectByName(name);
      if (light instanceof THREE.Light) light.intensity *= name === "studio-ambient" ? 0.62 : 0.5;
    }
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.resolution = new AdaptiveResolution(window.devicePixelRatio || 1);
    this.renderer.setPixelRatio(this.resolution.ratio);
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene.background = new THREE.Color(this.project.settings.background ?? "#4a4a52");

    this.world = new World(this.scene);
    this.rig = new CameraRig(canvas);
    this.rig.configure(this.project.settings);
    this.rig.playing = true;
    this.rig.set("first");
    this.camera = this.rig.perspective;

    const container = options.container ?? document.body;
    container.append(canvas);
    this.world.load(this.project.scenes[0], this.project.settings, true);

    /* ------------------------------------------------------------- ctx ----- */
    const ctx = {} as GameContext;
    Object.assign(ctx, {
      world: this.world,
      rig: this.rig,
      scene: this.scene,
      camera: this.camera,
      renderer: this.renderer,
      meta: this.meta,
      settings: this.store.settings,
      store: this.store,
      time: 0,
      paused: false,
      menuOpen: false,
      rng: this.random,
    });
    /* Asserção consciente: os serviços abaixo recebem o MESMO objeto `ctx`,
       então qualquer referência cruzada que eles guardem continua válida. */
    this.ctx = ctx;
    ctx.ui = this;

    this.fx = new Effects(ctx);
    this.decals = new Decals(ctx);
    this.spawner = new Spawner(ctx);
    this.destruction = new Destruction(ctx);
    this.gibs = new Gibs(ctx);
    this.combat = new Combat(ctx);
    this.player = new PlayerController(ctx);
    this.tools = new Tools(ctx);
    this.input = new Input(ctx);
    this.viewmodel = new ViewModel(ctx);
    ctx.fx = this.fx;
    ctx.decals = this.decals;
    ctx.spawner = this.spawner;
    ctx.destruction = this.destruction;
    ctx.gibs = this.gibs;
    ctx.combat = this.combat;
    ctx.player = this.player;
    ctx.tools = this.tools;
    ctx.input = this.input;

    /* A engine deixa o passo do jogador para o jogo: devolvemos `true` para
       assumir o movimento por completo (dash, escorregão, pulo duplo). */
    this.world.playerStep = (context) => this.player.step(context);

    /* ------------------------------------------------------------- UI ------ */
    this.hud = new Hud(container, ctx);
    this.spawnMenu = new SpawnMenu(ctx, container, (a, v, n) => this.dispatch(a, v, n));
    this.pauseMenu = new PauseMenu(ctx, container, (a, v, n) => this.dispatch(a, v, n));
    this.applyTheme(this.store.theme, false);
    this.hud.setVisible(true);
    this.hud.applyScale(this.store.settings.hudScale);
    this.hud.applyOpacity(this.store.settings.hudOpacity);

    this.bindDom(canvas);
    this.registerArena();
    this.equip(this.store.weapon, true);
  }

  /* ================================================================= DOM === */

  private bindDom(canvas: HTMLCanvasElement) {
    const onResize = () => this.resize();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (this.spawnMenu.open) this.spawnMenu.close();
        else this.setPaused(!this.ctx.paused);
        return;
      }
      if (event.key === "Tab") {
        event.preventDefault();
        /* Fechar a pausa antes: o menu de spawn é uma tela do jogo, não um
           motivo para pausar a simulação. */
        if (this.pauseMenu.open) this.pauseMenu.close();
        this.spawnMenu.toggle();
        this.input.keys.clear();
        return;
      }
      if (event.key === "F5") {
        event.preventDefault();
        this.restart();
      }
    };
    const onCanvasDown = () => {
      if (this.ctx.paused || this.ctx.menuOpen) return;
      void this.rig.capture();
      this.ctx.world.audio.play("ui.clique", 0.3, 1);
    };
    const onBlur = () => this.input.keys.clear();
    const onVisibility = () => {
      if (document.hidden) this.input.keys.clear();
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);
    canvas.addEventListener("pointerdown", onCanvasDown);
    this.cleanups.push(
      () => window.removeEventListener("resize", onResize),
      () => window.removeEventListener("keydown", onKeyDown),
      () => window.removeEventListener("blur", onBlur),
      () => document.removeEventListener("visibilitychange", onVisibility),
      () => canvas.removeEventListener("pointerdown", onCanvasDown),
    );
  }

  /* ============================================================ start/stop */

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      this.frameHandle = requestAnimationFrame(loop);
      this.frame(now);
    };
    this.frameHandle = requestAnimationFrame(loop);
    this.store.pushToast("GORE FORGE — clique para capturar o mouse", "info");
    this.pushFeed("Pátio da Forja", "Tab abre o menu de spawn", "info");
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.frameHandle);
  }

  dispose() {
    this.stop();
    this.cleanups.forEach((fn) => fn());
    this.cleanups = [];
    this.input.dispose();
    this.viewmodel.dispose();
    this.tools.dispose();
    this.fx.dispose();
    this.decals.dispose();
    this.hud.dispose();
    this.spawnMenu.dispose();
    this.pauseMenu.dispose();
    this.world.dispose();
    this.lightingDispose?.();
    this.renderer.dispose();
  }

  resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.rig.resize(width / Math.max(1, height));
    this.renderer.setSize(width, height, false);
    this.hud.applyScale(this.store.settings.hudScale);
    this.spawnMenu.resize();
    this.pauseMenu.close();
  }

  /* ================================================================ loop == */

  private frame(now: number) {
    const dt = clamp((now - this.last) / 1000, 0, 0.05);
    this.last = now;
    const store = this.store;
    const ctx = this.ctx;
    /* `store.applySettings` troca o objeto de settings: o ctx precisa apontar
       para a versão atual, senão os sistemas ficariam com valores antigos. */
    if (ctx.settings !== store.settings) ctx.settings = store.settings;
    ctx.menuOpen = this.spawnMenu.open || this.pauseMenu.open;
    ctx.paused = ctx.menuOpen || document.hidden;
    /* Menu aberto = mouse livre para clicar nos widgets (a captura volta com um
       clique no canvas). Sem isso o navegador continua entregando o mouse ao
       canvas e nenhum botão do menu recebe o clique. */
    if (ctx.menuOpen && document.pointerLockElement) this.rig.release();

    if (!document.hidden) {
      this.readHotkeys();
      if (!ctx.paused) {
        ctx.time += dt;
        const keys = this.input.keys as Set<string>;
        this.combat.update(dt);
        this.tools.update(dt);
        this.world.update(dt, keys, this.rig.yaw);
        this.player.update(dt);
        this.fx.update(dt);
        this.decals.update(dt);
        this.destruction.update(dt);
        store.tick(dt);
        this.updateZones();
        this.updateDiagnostics();
      }
      this.spawnMenu.refresh();
      this.applyTheme(store.theme);
    }

    this.rig.paused = ctx.paused;
    this.rig.update(this.world, dt);
    this.world.refresh();
    /* Sensação de câmera depois que a engine posicionou a câmera no jogador. */
    if (!ctx.paused) this.player.applyCameraFeel(dt);
    /* O modelo em primeira pessoa decide depois da engine: com ele ativo, os
       braços genéricos da engine saem de cena (senão seriam dois pares). */
    this.viewmodel.update(dt);
    configureLighting(this.scene, this.renderer, this.project.settings, this.focus());

    this.hud.update(dt, store.fps);
    this.rig.render(this.renderer, this.scene);

    this.fpsSum += dt;
    this.fpsFrames++;
    if (this.fpsSum >= 0.5) {
      store.fps = this.fpsFrames / this.fpsSum;
      const mode = store.settings.quality;
      const ratio = this.resolution.sample(store.fps, mode);
      if (Math.abs(this.renderer.getPixelRatio() - ratio) > 0.01)
        this.renderer.setPixelRatio(ratio);
      this.fpsSum = 0;
      this.fpsFrames = 0;
    }

    if (ctx.time - this.lastDiagnosticsAt > 0.25) {
      this.lastDiagnosticsAt = ctx.time;
      this.store.bodies = this.world.bodies.size;
      store.rigs = this.world.physicalRigs.size + this.world.jellyCharacters.size;
      store.particles = this.fx.particleCount;
      store.decals = this.decals.count;
      store.spawnedNow = this.spawner.count;
      store.score = this.computeScore();
    }

    this.input.endFrame();
  }

  private lastDiagnosticsAt = 0;

  private focus() {
    const player = this.world.playerId ? this.world.objects.get(this.world.playerId) : null;
    return player?.getWorldPosition(this.focusVector) ?? this.rig.controls.target;
  }

  private focusVector = new THREE.Vector3();

  private computeScore() {
    const s = this.store;
    return Math.round(s.damageDealt + s.kills * 120 + s.destroyed * 25 + s.gibs * 8 + s.bestCombo * 40);
  }

  /* ============================================================= inputs === */

  private readHotkeys() {
    const input = this.input;
    const store = this.store;
    if (this.spawnMenu.open || this.pauseMenu.open) return;
    if (input.pressed("p")) this.setPaused(true);

    /* armas 1..9, ferramentas na tecla 0 (cicla na lista de dados) */
    for (let i = 1; i <= 9; i++) {
      if (input.pressed(String(i)) && quickSlots[i - 1]) this.equip(quickSlots[i - 1]);
    }
    if (input.pressed("0")) {
      store.toolIndex = (store.toolIndex + 1) % tools.length;
      this.equip(tools[store.toolIndex]);
    }
    if (input.wheel) store.cycleWeapon(input.wheel);
    if (input.pressed("r")) this.combat.reload();
    if (input.pressed("f")) this.toggleTorch();
    if (input.pressed("v")) this.store.godMode = !this.store.godMode;
    if (input.pressed("x")) {
      store.noclip = !store.noclip;
      this.player.noclip = store.noclip;
      this.pushFeed("Noclip", store.noclip ? "ligado" : "desligado", "info");
    }
    if (input.pressed("b")) this.cycleHudLayout();

    /* gatilhos */
    if (input.down("mouse0") && !store.firing) this.combat.triggerDown();
    if (!input.down("mouse0") && store.firing) this.combat.triggerUp();
    if (input.pressed("mouse2")) {
      const spec = this.combat.currentSpec;
      if (spec.tool === "physgun") this.tools.release("throw");
      else store.ads = !store.ads;
    }
    if (input.pressed("mouse1")) {
      const spec = this.combat.currentSpec;
      if (spec.kind === "tool" && spec.tool) this.tools.trigger(spec.tool, { down: true });
      else store.ads = !store.ads;
    }
  }

  private cycleHudLayout() {
    const ids = Object.keys(hudLayouts) as HudLayoutId[];
    const current = ids.indexOf(this.store.settings.hudLayout);
    const next = ids[(current + 1) % ids.length];
    this.applySettings({ hudLayout: next });
    this.store.pushToast(`HUD: ${next}`, "info");
  }

  private toggleTorch() {
    const torch = this.world.torch;
    this.world.command({ type: "torch", enabled: !torch.enabled });
    this.store.pushToast(torch.enabled ? "Lanterna desligada" : "Lanterna ligada", "info");
  }

  /* ================================================================ API === */

  equip(id: string, silent = false) {
    const store = this.store;
    store.equip(id);
    this.viewmodel.equip(id);
    if (!silent) {
      this.world.audio.play(weaponFor(id).sfx.equip, 0.55, 1);
      this.pushFeed(weaponFor(id).name, `${weaponFor(id).description}`, "info");
    }
  }

  applySettings(patch: Partial<GameSettings>) {
    const store = this.store;
    store.applySettings(patch);
    this.ctx.settings = store.settings;
    if (patch.hudScale !== undefined) this.hud.applyScale(patch.hudScale);
    if (patch.hudOpacity !== undefined) this.hud.applyOpacity(patch.hudOpacity);
    if (patch.volume !== undefined) this.world.audio.setVolume(patch.volume);
    if (patch.quality !== undefined) {
      const ratio = this.resolution.setMode(patch.quality as QualityMode);
      this.renderer.setPixelRatio(ratio);
    }
    if (patch.particles !== undefined) this.fx.setQuality(patch.particles);
    if (patch.quality !== undefined) this.renderer.shadowMap.needsUpdate = true;
    if (patch.npcLimit !== undefined) this.spawner.setBudget(patch.npcLimit);
    if (patch.viewmodel !== undefined) {
      this.rig.arms.visible = patch.viewmodel && this.rig.mode === "first";
    }
    this.pauseMenu.rebuild();
  }

  applyTheme(theme: UITheme, persist = true) {
    if (theme !== this.store.theme) return;
    const signature = `${theme.id}:${JSON.stringify(theme.metrics)}:${JSON.stringify(theme.deform)}`;
    if (signature === this.themeSignature) return;
    this.themeSignature = signature;
    this.hud.setTheme(theme);
    this.spawnMenu.setTheme(theme);
    this.pauseMenu.setTheme(theme);
    this.overlayTheme();
    if (persist) this.store.applyTheme(theme);
  }

  private overlayTheme() {
    const theme = this.store.theme;
    document.documentElement.style.setProperty("--gf-page-bg", theme.colors.panelSolid);
    this.scene.background = new THREE.Color(this.project.settings.background ?? "#4a4a52");
  }

  private registerArena() {
    for (const [id, profile] of Object.entries(this.meta.breakables))
      this.destruction.track(id, profile);

    this.world.onEvent = (text) => this.pushFeed("Engine", text, "info");
    this.applyTheme(this.store.theme, false);
  }

  /** Recarrega a cena inteira: mesma partida do zero, sem recarregar a página. */
  restart() {
    this.world.load(this.project.scenes[0], this.project.settings, true);
    this.world.playerStep = (context) => this.player.step(context);
    this.combat.reset();
    this.tools.reset();
    this.player.reset();
    this.destruction.reset();
    this.gibs.reset();
    this.fx.clear();
    this.decals.clear();
    this.spawner.clearSpawned();
    this.store.resetLoadout();
    this.store.health = this.store.settings.maxHealth;
    this.store.alive = true;
    this.store.respawnIn = 0;
    this.rig.yaw = 0;
    this.rig.pitch = -0.08;
    this.registerArena();
    this.equip(this.store.weapon, true);
    this.spawnMenu.refresh();
    this.resetRunStats();
    this.pushFeed("Pátio reiniciado", "Tudo recriado do zero", "wave");
    this.ctx.world.audio.play("ui.confirmar", 0.6, 1);
    this.setPaused(false);
  }

  private resetRunStats() {
    const store = this.store;
    store.kills = 0;
    store.headshots = 0;
    store.deaths = 0;
    store.spawned = 0;
    store.destroyed = 0;
    store.gibs = 0;
    store.shots = 0;
    store.hits = 0;
    store.damageDealt = 0;
    store.damageTaken = 0;
    store.combo = 0;
    store.bestCombo = 0;
    store.score = 0;
    store.feed = [];
    store.toasts = [];
    store.numbers = [];
  }

  /* ======================================================== utilitários === */

  /** Vetor novo — atalho para scripts, console e testes que usam o runtime. */
  point(x: number, y: number, z: number) {
    return new THREE.Vector3(x, y, z);
  }

  /** Ponto à frente da câmera (spawns por código sem depender de THREE). */
  ahead(distance = 2.2, lift = 0) {
    const position = this.camera.getWorldPosition(new THREE.Vector3());
    const direction = this.camera.getWorldDirection(new THREE.Vector3());
    return position.addScaledVector(direction, distance).add(new THREE.Vector3(0, lift, 0));
  }

  /* ============================================================ UIHost ==== */

  pushFeed(text: string, detail: string, kind: "kill" | "headshot" | "destroy" | "explosion" | "wave" | "info") {
    this.store.pushFeed({ text, detail, kind });
  }

  toast(text: string, kind: "info" | "good" | "bad" | "record" = "info") {
    this.store.pushToast(text, kind);
  }

  sound(name: string, volume = 0.6, pitch = 1) {
    this.world.audio.play(name, volume, pitch);
  }

  setPaused(paused: boolean) {
    if (paused) {
      this.pauseMenu.show();
      this.input.keys.clear();
      this.rig.release();
      this.world.cancelInputActions();
      this.world.audio.play("ui.abrir", 0.4, 0.92);
    } else {
      this.pauseMenu.close();
      this.world.audio.play("ui.fechar", 0.35, 1);
    }
    this.ctx.paused = paused;
  }

  respawn() {
    this.player.respawn();
  }

  setThemeField(path: string, value: number | string) {
    const theme = this.store.theme;
    const [group, key] = path.split(".");
    const target =
      group === "metrics"
        ? (theme.metrics as unknown as Record<string, number | string>)
        : group === "deform"
          ? (theme.deform as unknown as Record<string, number | string>)
          : group === "colors"
            ? (theme.colors as unknown as Record<string, number | string>)
            : (theme as unknown as Record<string, number | string>);
    if (!key) return;
    target[key] = value;
    this.themeSignature = "";
    this.applyTheme(theme);
  }

  serializeUI() {
    return serializeTheme(this.store.theme);
  }

  applyUI(json: string) {
    try {
      const parsed = JSON.parse(json) as unknown;
      this.store.applyTheme(validateTheme(parsed, this.store.theme));
      this.themeSignature = "";
      this.applyTheme(this.store.theme);
      return true;
    } catch {
      return false;
    }
  }

  statLine() {
    const s = this.store.stats();
    return `${s.kills} abates · ${s.destroyed} destruídos · ${s.accuracy.toFixed(0)}% precisão`;
  }

  /* ========================================================== dispatch ==== */

  /** Toda ação de UI cai aqui: string → mutação de estado. */
  dispatch(action: string, value?: number | string, node?: UINode) {
    const store = this.store;
    void node;
    switch (action) {
      case "resume":
        this.setPaused(false);
        return;
      case "restart":
        this.restart();
        return;
      case "heal":
        this.player.heal(9999);
        store.resetLoadout();
        this.store.pushToast("Vida e munição restauradas", "good");
        return;
      case "toggle-god":
        store.godMode = !store.godMode;
        this.store.pushToast(store.godMode ? "Modo deus ligado" : "Modo deus desligado", "info");
        return;
      case "toggle-noclip":
        store.noclip = !store.noclip;
        this.player.noclip = store.noclip;
        return;
      case "toggle-help":
        store.help = !store.help;
        return;
      case "clear-spawned":
        this.spawner.clearSpawned();
        this.store.pushToast("Objetos criados removidos", "info");
        return;
      case "spawn-horde":
        this.spawnGroup(HORDE_ITEMS, "horda");
        return;
      case "spawn-arena":
        this.spawnGroup(ARENA_ITEMS, "cenário");
        return;
      case "spawn-tabs":
        this.spawnMenu.setCategory(String(value ?? ""));
        return;
      case "spawn":
        this.spawnSelected(String(value ?? store.spawnSelection));
        return;
      case "equip":
        this.equip(String(value ?? store.weapon));
        return;
      case "equip-tool":
        this.equip(String(value ?? tools[0]));
        return;
      case "favorite": {
        const id = String(value ?? store.spawnSelection);
        const index = store.spawnFavorites.indexOf(id);
        if (index >= 0) store.spawnFavorites.splice(index, 1);
        else store.spawnFavorites.push(id);
        store.saveFavorites();
        this.spawnMenu.rebuild();
        this.store.pushToast(
          index >= 0 ? `Removido dos favoritos: ${id}` : `Favoritado: ${id}`,
          "info",
        );
        return;
      }
      case "spawn-scale":
        store.spawnScale = Number(value ?? 1);
        this.spawnMenu.refresh();
        return;
      case "spawn-speed":
        store.spawnSpeed = Number(value ?? 1);
        this.spawnMenu.refresh();
        return;
      case "spawn-mode":
        store.spawnMode = value === "player" ? "player" : "crosshair";
        this.spawnMenu.rebuild();
        return;
      case "pause-tab":
        this.pauseMenu.setTab(String(value ?? "geral"));
        return;
      case "theme": {
        const id = String(value ?? themes[store.settings.theme]?.id ?? "ferro");
        const theme = themes[id] ?? themes.ferro;
        store.applyTheme(theme);
        this.themeSignature = "";
        this.applyTheme(store.theme);
        this.pauseMenu.rebuild();
        this.store.pushToast(`Tema ${theme.label} aplicado`, "good");
        return;
      }
      case "theme-applied":
        this.store.pushToast(`Tema "${String(value)}" aplicado`, "good");
        return;
      case "export-theme":
        this.downloadTheme();
        return;
      case "reset-settings":
        this.applySettings({ ...goreforgeDefaults, theme: store.settings.theme });
        this.store.resetThemeToCatalog();
        this.themeSignature = "";
        this.applyTheme(store.theme);
        this.spawnMenu.rebuild();
        this.store.pushToast("Ajustes restaurados", "info");
        return;
      case "save-settings":
        saveSettings(store.settings);
        this.store.pushToast("Ajustes salvos no navegador", "good");
        return;
      case "set-quality": {
        const mode = (value === "economy" || value === "high" ? value : "auto") as QualityMode;
        this.applySettings({ quality: mode });
        this.store.pushToast(`Qualidade: ${mode}`, "info");
        return;
      }
      case "gore-preset": {
        const index = (GORE_LABELS as readonly string[]).indexOf(String(value).replace("gore ", ""));
        const level = goreLevels[index >= 0 ? index : 2];
        this.applySettings(gorePresetPatch(level));
        this.store.pushToast(`Gore: ${level}`, "info");
        return;
      }
      case "hud-layout": {
        if (typeof value === "string" && value in hudLayouts)
          this.applySettings({ hudLayout: value as HudLayoutId });
        return;
      }
      case "spawn-close":
        this.spawnMenu.close();
        return;
      default:
        break;
    }

    if (action.startsWith("theme-metric-")) {
      this.setThemeField(`metrics.${action.slice("theme-metric-".length)}`, Number(value));
      this.pauseMenu.rebuild();
      return;
    }
    if (action.startsWith("theme-deform-")) {
      this.setThemeField(`deform.${action.slice("theme-deform-".length)}`, Number(value));
      return;
    }
    if (action.startsWith("set-")) {
      const key = action.slice(4) as keyof GameSettings;
      const current = store.settings[key];
      let next: number | string | boolean = Number(value);
      if (typeof current === "boolean") next = Number(value) > 0.5;
      if (action === "set-gore") {
        const level = goreLevels[clamp(Math.round(Number(value)), 0, 3)];
        this.applySettings(gorePresetPatch(level));
        return;
      }
      if (action === "set-hudScale" || action === "set-hudOpacity" || action === "set-fov") {
        next = Number(value);
      }
      if (action === "set-theme" && typeof value === "string") {
        this.dispatch("theme", value);
        return;
      }
      this.applySettings({ [key]: next } as Partial<GameSettings>);
    }
  }

  private downloadTheme() {
    const blob = new Blob([serializeTheme(this.store.theme)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `goreforge-tema-${this.store.theme.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
    this.store.pushToast("Tema exportado", "good");
  }

  /* =========================================================== gameplay === */

  private spawnSelected(itemId: string) {
    const store = this.store;
    let position: THREE.Vector3;
    let velocity: THREE.Vector3 | undefined;
    if (store.spawnMode === "crosshair") {
      const direction = this.camera.getWorldDirection(new THREE.Vector3());
      position = this.ahead(2.2);
      velocity = store.spawnSpeed > 0.01 ? direction.multiplyScalar(store.spawnSpeed) : undefined;
    } else {
      position = new THREE.Vector3();
      this.world.objects.get(this.world.playerId ?? "")?.getWorldPosition(position);
      position.y += 1.2;
    }
    const ids = this.spawner.spawn(itemId, {
      position,
      velocity,
      scale: store.spawnScale,
      kind: "prop" as const,
    });
    if (ids.length) {
      store.spawned += ids.length;
      if (!store.spawnRecent.includes(itemId))
        store.spawnRecent = [itemId, ...store.spawnRecent].slice(0, 12);
      const preview = ids.slice(0, 6);
      for (const id of preview) {
        const item = spawnables.find((s) => s.id === itemId);
        if (item && item.hp > 0)
          this.destruction.track(id, {
            hp: item.hp,
            material: item.material,
            chunks: item.chunks,
            explosive: item.explosive,
          });
      }
      this.spawnMenu.rebuild();
    }
  }

  private spawnGroup(items: string[], label: string) {
    const origin = new THREE.Vector3();
    this.camera.getWorldPosition(origin);
    const direction = this.camera.getWorldDirection(new THREE.Vector3());
    let created = 0;
    items.forEach((id, index) => {
      const point = origin
        .clone()
        .addScaledVector(direction, 9 + index * 1.6)
        .add(new THREE.Vector3((this.random() - 0.5) * 7, 1.6, (this.random() - 0.5) * 7));
      const ids = this.spawner.spawn(id, {
        position: point,
        velocity: direction.clone().multiplyScalar(2.4),
        scale: this.store.spawnScale,
        kind: "prop" as const,
      });
      created += ids.length;
      ids.slice(0, 4).forEach((spawnedId) => {
        const item = spawnables.find((s) => s.id === id);
        if (item && item.hp > 0)
          this.destruction.track(spawnedId, {
            hp: item.hp,
            material: item.material,
            chunks: item.chunks,
            explosive: item.explosive,
          });
      });
    });
    this.store.spawned += created;
    this.pushFeed(label, `${created} corpos criados no centro da mira`, "wave");
    this.spawnMenu.rebuild();
  }

  private updateZones() {
    const store = this.store;
    const body = this.world.playerId ? this.world.bodies.get(this.world.playerId) : null;
    if (!body) return;
    const position = new THREE.Vector3(body.position.x, body.position.y, body.position.z);
    let best: (typeof this.meta.zones)[number] | null = null;
    let bestDistance = Infinity;
    for (const zone of this.meta.zones) {
      const center = new THREE.Vector3(...zone.center);
      const distance = center.distanceTo(position) - zone.radius;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = zone;
      }
    }
    const inRange = best && bestDistance <= 0 ? best : null;
    const name = inRange?.name ?? "Pátio aberto";
    const hint = inRange?.hint ?? "WASD corre · Shift escorrega · Ctrl desliza · 0 cicla ferramentas";
    if (name !== store.zoneName) {
      store.zoneName = name;
      store.zoneHint = hint;
      store.zoneId = inRange?.id ?? "";
      this.pushFeed(name, hint, "info");
    } else if (hint !== store.zoneHint) {
      store.zoneHint = hint;
    }
  }

  private updateDiagnostics() {
    const store = this.store;
    store.bodies = this.world.bodies.size;
    store.rigs = this.world.physicalRigs.size + this.world.jellyCharacters.size;
    store.particles = this.fx.particleCount;
    store.decals = this.decals.count;
    store.spawnedNow = this.spawner.count;
    store.score = this.computeScore();
  }
}
