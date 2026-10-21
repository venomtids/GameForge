import type * as THREE from "three";
import type { World } from "../../engine/World";
import type { CameraRig } from "../../engine/CameraRig";
import type { GameSettings } from "../config/settings";
import type { GameStore } from "./state";
import type { Effects } from "./fx";
import type { Decals } from "./decals";
import type { Spawner } from "./spawner";
import type { Destruction } from "./destruction";
import type { Gibs } from "./gibs";
import type { Combat } from "./combat";
import type { PlayerController } from "./player";
import type { Tools } from "./tools";
import type { Input } from "./input";
import type { ArenaMeta } from "../arena";

/** Serviços que a camada de UI pode chamar sem conhecer os sistemas. */
export interface UIHost {
  pushFeed(text: string, detail: string, kind: "kill" | "headshot" | "destroy" | "explosion" | "wave" | "info"): void;
  toast(text: string, kind?: "info" | "good" | "bad" | "record"): void;
  sound(name: string, volume?: number, pitch?: number): void;
  setPaused(paused: boolean): void;
  respawn(): void;
  restart(): void;
  setThemeField(path: string, value: number | string): void;
  serializeUI(): string;
  applyUI(json: string): boolean;
  statLine(): string;
}

/** Contexto compartilhado: evita imports circulares de runtime entre sistemas. */
export interface GameContext {
  world: World;
  rig: CameraRig;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  meta: ArenaMeta;
  settings: GameSettings;
  store: GameStore;
  fx: Effects;
  decals: Decals;
  spawner: Spawner;
  destruction: Destruction;
  gibs: Gibs;
  combat: Combat;
  player: PlayerController;
  tools: Tools;
  input: Input;
  ui: UIHost;
  /** Tempo acumulado de simulação (s). */
  time: number;
  paused: boolean;
  menuOpen: boolean;
  rng: () => number;
}

export type { THREE };
