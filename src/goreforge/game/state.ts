import {
  goreforgeDefaults,
  loadSettings,
  saveSettings,
  validateSettings,
  type GameSettings,
} from "../config/settings";
import { themeFor, validateTheme, type UITheme } from "../config/theme";
import { quickSlots, weaponFor, weapons } from "../config/weapons";
import { spawnables } from "../config/spawnables";
import { clamp } from "./util";

export interface FeedItem {
  id: number;
  text: string;
  detail: string;
  kind: "kill" | "headshot" | "destroy" | "explosion" | "wave" | "info";
  life: number;
}

export interface Toast {
  id: number;
  text: string;
  kind: "info" | "good" | "bad" | "record";
  life: number;
}

export interface DamageNumber {
  id: number;
  value: number;
  x: number;
  y: number;
  z: number;
  life: number;
  kind: "normal" | "headshot" | "gib" | "player";
}

export interface AmmoState {
  mag: number;
  reserve: number;
}

/** Estado global do jogo + dados persistentes entre sessões. */
export class GameStore {
  settings: GameSettings = loadSettings();
  theme: UITheme = themeFor(this.settings.theme);

  health = 100;
  armor = 0;
  alive = true;
  respawnIn = 0;

  kills = 0;
  headshots = 0;
  deaths = 0;
  spawned = 0;
  destroyed = 0;
  gibs = 0;
  shots = 0;
  hits = 0;
  damageDealt = 0;
  damageTaken = 0;
  combo = 0;
  comboTimer = 0;
  bestCombo = 0;
  score = 0;

  fps = 60;
  bodies = 0;
  rigs = 0;
  particles = 0;
  decals = 0;
  spawnedNow = 0;

  /** Munição por arma (magazine + reserva). */
  ammo = new Map<string, AmmoState>();
  loadout: string[] = [...quickSlots];
  weapon = quickSlots[1];
  previousWeapon = "ferrolho";
  tools = ["gravar", "dissolver", "solda", "clonar"];
  toolIndex = 0;
  reloading = 0;
  ads = false;
  firing = false;

  spawnSelection = spawnables[0].id;
  spawnFavorites: string[] = [];
  spawnRecent: string[] = [];
  /** Modo de posicionamento do menu de spawn. */
  spawnMode: "crosshair" | "player" = "crosshair";
  spawnScale = 1;
  spawnSpeed = 1;

  zoneId = "";
  zoneName = "";
  zoneHint = "";
  help = true;
  godMode = false;
  noclip = false;
  waveIndex = 0;

  feed: FeedItem[] = [];
  toasts: Toast[] = [];
  numbers: DamageNumber[] = [];
  hitDirection = { angle: 0, life: 0 };
  hitMarker = 0;
  killMarker = 0;
  private nextId = 1;
  private records = { kills: 0, score: 0, combo: 0 };

  constructor() {
    this.resetLoadout();
    this.records = this.loadRecords();
    this.spawnFavorites = this.loadFavorites();
  }

  /** Favoritos do menu de spawn (Shift+clique) — sobrevivem ao recarregar. */
  saveFavorites() {
    try {
      localStorage.setItem("goreforge.favorites.v1", JSON.stringify(this.spawnFavorites));
    } catch {
      /* sem armazenamento: favoritos ficam só na sessão */
    }
  }

  private loadFavorites(): string[] {
    try {
      const text = localStorage.getItem("goreforge.favorites.v1");
      const parsed = text ? (JSON.parse(text) as unknown) : null;
      if (!Array.isArray(parsed)) return this.spawnFavorites;
      return parsed.filter((id): id is string => typeof id === "string").slice(0, 24);
    } catch {
      return this.spawnFavorites;
    }
  }

  resetLoadout() {
    this.ammo.clear();
    for (const id of Object.keys(weapons)) {
      const spec = weaponFor(id);
      this.ammo.set(id, { mag: spec.magazine, reserve: spec.reserve });
    }
  }

  /* ------------------------------------------------------------ munição --- */
  ammoOf(id = this.weapon): AmmoState {
    const entry = this.ammo.get(id);
    if (entry) return entry;
    const spec = weaponFor(id);
    const created = { mag: spec.magazine, reserve: spec.reserve };
    this.ammo.set(id, created);
    return created;
  }

  /** Consome 1 tiro; devolve false quando não há munição. */
  consume(id = this.weapon) {
    const spec = weaponFor(id);
    if (spec.magazine <= 0) return true;
    if (this.settings.infiniteAmmo) {
      this.ammoOf(id).mag = spec.magazine;
      return true;
    }
    const state = this.ammoOf(id);
    if (state.mag <= 0) return false;
    state.mag -= 1;
    return true;
  }

  reload(id = this.weapon) {
    const spec = weaponFor(id);
    if (spec.magazine <= 0 || this.settings.infiniteAmmo) return false;
    const state = this.ammoOf(id);
    if (state.mag >= spec.magazine || state.reserve <= 0) return false;
    const need = Math.min(spec.magazine - state.mag, state.reserve);
    state.mag += need;
    state.reserve -= need;
    return true;
  }

  /* -------------------------------------------------------------- armas --- */
  equip(id: string) {
    if (!weapons[id] || id === this.weapon) return false;
    this.previousWeapon = this.weapon;
    this.weapon = id;
    this.reloading = 0;
    return true;
  }

  cycleWeapon(direction: number) {
    const list = [...this.loadout, ...this.tools];
    const index = list.indexOf(this.weapon);
    const next = list[(index + direction + list.length * 2) % list.length];
    return this.equip(next);
  }

  /* ---------------------------------------------------------- contadores --- */
  addKill(headshot: boolean, weaponNameText: string, victim: string, distance: number) {
    this.kills += 1;
    if (headshot) this.headshots += 1;
    this.combo += 1;
    this.comboTimer = 4;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const bonus = headshot ? 40 : 15;
    this.score += bonus + Math.round(this.combo * 2.5) + Math.round(distance * 0.6);
    this.pushFeed({
      text: `${weaponNameText} ▸ ${victim}`,
      detail: headshot ? `HEADSHOT · ${distance.toFixed(1)} m` : `${distance.toFixed(1)} m`,
      kind: headshot ? "headshot" : "kill",
    });
    this.killMarker = 0.5;
    this.checkRecords();
  }

  checkRecords() {
    const next = {
      kills: Math.max(this.records.kills, this.kills),
      score: Math.max(this.records.score, this.score),
      combo: Math.max(this.records.combo, this.bestCombo),
    };
    if (next.kills > this.records.kills) this.pushToast("Novo recorde de abates!", "record");
    else if (next.score > this.records.score && this.records.score > 0)
      this.pushToast("Novo recorde de pontos!", "record");
    this.records = next;
    this.saveRecords();
  }

  private loadRecords() {
    try {
      const text = localStorage.getItem("goreforge.records.v1");
      const parsed = text ? JSON.parse(text) : null;
      return {
        kills: Number(parsed?.kills) || 0,
        score: Number(parsed?.score) || 0,
        combo: Number(parsed?.combo) || 0,
      };
    } catch {
      return { kills: 0, score: 0, combo: 0 };
    }
  }

  private saveRecords() {
    try {
      localStorage.setItem("goreforge.records.v1", JSON.stringify(this.records));
    } catch {
      /* armazenamento indisponível: recordes ficam só na sessão */
    }
  }

  get bestRecord() {
    return this.records;
  }

  /* ----------------------------------------------------------- mensagens --- */
  pushFeed(entry: Omit<FeedItem, "id" | "life">) {
    this.feed.unshift({ ...entry, id: this.nextId++, life: 6 });
    if (this.feed.length > 6) this.feed.length = 6;
  }

  pushToast(text: string, kind: Toast["kind"] = "info") {
    this.toasts.unshift({ id: this.nextId++, text, kind, life: 3.2 });
    if (this.toasts.length > 4) this.toasts.length = 4;
  }

  pushDamage(value: number, point: { x: number; y: number; z: number }, kind: DamageNumber["kind"] = "normal") {
    if (!this.settings.damageNumbers) return;
    this.numbers.push({
      id: this.nextId++,
      value,
      x: point.x,
      y: point.y,
      z: point.z,
      life: 1.1,
      kind,
    });
    if (this.numbers.length > 24) this.numbers.shift();
  }

  markHit(headshot: boolean) {
    this.hitMarker = headshot ? 0.45 : 0.3;
    this.score += headshot ? 12 : 4;
  }

  markPlayerHit(angle: number) {
    this.hitDirection = { angle, life: 1.1 };
  }

  tick(dt: number) {
    for (const item of this.feed) item.life -= dt;
    this.feed = this.feed.filter((f) => f.life > 0);
    for (const toast of this.toasts) toast.life -= dt;
    this.toasts = this.toasts.filter((t) => t.life > 0);
    for (const number of this.numbers) number.life -= dt;
    this.numbers = this.numbers.filter((n) => n.life > 0);
    this.hitMarker = Math.max(0, this.hitMarker - dt);
    this.killMarker = Math.max(0, this.killMarker - dt);
    this.hitDirection.life = Math.max(0, this.hitDirection.life - dt);
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
  }

  /* ---------------------------------------------------------- ajustes ----- */
  applySettings(patch: Partial<GameSettings>) {
    /* Sempre validado: nenhuma ação de UI consegue deixar o jogo num estado
       fisicamente impossível (velocidade NaN, 1e9 de NPCs, gore inválido). */
    this.settings = validateSettings({ ...this.settings, ...patch });
    saveSettings(this.settings);
    if (patch.theme) this.theme = themeFor(patch.theme);
  }

  applyTheme(theme: UITheme) {
    this.theme = validateTheme(theme, this.theme);
    this.settings = { ...this.settings, theme: this.theme.id };
    saveSettings(this.settings);
  }

  resetThemeToCatalog() {
    const base = themeFor(this.settings.theme);
    this.theme = base;
  }

  stats() {
    return {
      kills: this.kills,
      headshots: this.headshots,
      deaths: this.deaths,
      spawned: this.spawned,
      destroyed: this.destroyed,
      gibs: this.gibs,
      shots: this.shots,
      hits: this.hits,
      accuracy: this.shots ? clamp((this.hits / this.shots) * 100, 0, 100) : 0,
      damageDealt: Math.round(this.damageDealt),
      damageTaken: Math.round(this.damageTaken),
      score: this.score,
      combo: this.bestCombo,
    };
  }
}

export const defaultGameSettings = goreforgeDefaults;
