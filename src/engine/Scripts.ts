import ScriptWorker from "./script-worker?worker&inline";
import type { World } from "./World";
import * as THREE from "three";
export class ScriptHost {
  worker: Worker | null = null;
  paused = false;
  ready = false;
  busy = false;
  timer: ReturnType<typeof setTimeout> | null = null;
  context: Record<string, unknown> = {};
  acc = 0;
  previous = new Set<string>();
  pressed = new Set<string>();
  released = new Set<string>();
  constructor(
    private world: World,
    private log: (text: string) => void,
  ) {}
  start() {
    this.stop();
    const nodes = this.world.configs.filter(
      (n) => n.script?.enabled && n.script.language !== "none",
    );
    if (!nodes.length) return;
    if (nodes.length > 32)
      this.log("Scripts: limite de 32 nós ativos por cena.");
    try {
      this.worker = new ScriptWorker();
    } catch (e) {
      this.log(`Scripts indisponíveis: ${String(e)}`);
      return;
    }
    this.worker.onmessage = (event) => {
      const data = event.data;
      if (this.timer) clearTimeout(this.timer);
      this.timer = null;
      this.busy = false;
      if (!data || !["ready", "result"].includes(data.type)) return;
      for (const message of (Array.isArray(data.logs) ? data.logs : []).slice(
        0,
        8,
      ))
        this.log(`[script] ${String(message).slice(0, 300)}`);
      if (data.type === "ready") this.ready = true;
      if (!this.paused && Array.isArray(data.commands))
        for (const c of data.commands.slice(0, 256)) {
          if (
            c?.type === "store" &&
            nodes.some((n) => n.id === c.id) &&
            typeof c.text === "string" &&
            c.text.length <= 500000
          ) {
            try {
              localStorage.setItem(
                "gameforge.save." + this.world.sceneId + "." + c.id,
                c.text,
              );
              this.world.events.push("storage-saved");
            } catch (e) {
              this.log("Falha ao salvar progresso: " + String(e));
              this.world.events.push("storage-error");
            }
          } else this.world.command(c);
        }
      this.world.refresh();
      if (
        data.type === "result" &&
        !this.paused &&
        this.world.playing &&
        !this.world.completed &&
        Array.isArray(data.patches)
      )
        for (const patch of data.patches.slice(0, 32)) {
          if (nodes.slice(0, 32).some((n) => n.id === patch.id))
            this.world.applyScript(patch.id, patch.state);
        }
    };
    this.worker.onerror = (e) => {
      this.log(`Script interrompido: ${e.message}`);
      this.stop();
    };
    this.busy = true;
    this.watch(2500);
    this.worker.postMessage({
      type: "init",
      volume: this.world.voxels?.data,
      states: this.states(),
      nodes: nodes.slice(0, 32).map((n) => ({
        id: n.id,
        name: n.name,
        language: n.script.language,
        source: n.script.source,
        state: this.state(n.id),
        saved: (() => {
          try {
            const text = localStorage.getItem(
              "gameforge.save." + this.world.sceneId + "." + n.id,
            );
            return text && text.length <= 500000 ? JSON.parse(text) : null;
          } catch {
            return null;
          }
        })(),
      })),
    });
  }
  private states() {
    return Object.fromEntries(
      [...this.world.objects.keys()]
        .slice(0, 1400)
        .map((id) => [id, this.state(id)]),
    );
  }
  private state(id: string) {
    const o = this.world.objects.get(id)!;
    return {
      id,
      health: this.world.health.get(id) ?? 100,
      vx: this.world.bodies.get(id)?.velocity.x ?? 0,
      vy: this.world.bodies.get(id)?.velocity.y ?? 0,
      vz: this.world.bodies.get(id)?.velocity.z ?? 0,
      grounded:
        this.world.bodies.has(id) &&
        this.world.grounded(this.world.bodies.get(id)!),
      x: o.position.x,
      y: o.position.y,
      z: o.position.z,
      rx: THREE.MathUtils.radToDeg(o.rotation.x),
      ry: THREE.MathUtils.radToDeg(o.rotation.y),
      rz: THREE.MathUtils.radToDeg(o.rotation.z),
      color:
        o instanceof THREE.Mesh
          ? "#" +
            (o.material as THREE.MeshStandardMaterial).color.getHexString()
          : "#ffffff",
      visible: o.visible,
    };
  }
  private watch(ms: number) {
    this.timer = setTimeout(() => {
      this.log(
        "Scripts interrompidos: limite de tempo excedido. A cena continua sem scripts.",
      );
      this.stop();
    }, ms);
  }
  update(dt: number, keys: Set<string>) {
    for (const k of keys) if (!this.previous.has(k)) this.pressed.add(k);
    for (const k of this.previous) if (!keys.has(k)) this.released.add(k);
    this.previous = new Set(keys);
    this.acc += dt;
    if (!this.worker || !this.ready || this.busy || this.acc < 1 / 30) return;
    const delta = Math.min(0.1, this.acc);
    this.acc = 0;
    this.busy = true;
    this.watch(350);
    const keyData = (keys: Set<string>) =>
      Object.fromEntries([...keys].map((k) => [k === " " ? "space" : k, true]));
    const input = {
      ...keyData(keys),
      ...this.context,
      events: this.world.events.splice(0, 64),
      pressed: keyData(this.pressed),
      released: keyData(this.released),
    };
    this.pressed.clear();
    this.released.clear();
    const nodes = this.world.configs
      .filter((n) => n.script?.enabled && n.script.language !== "none")
      .slice(0, 32)
      .map((n) => ({ id: n.id, name: n.name, state: this.state(n.id) }));
    this.worker.postMessage({
      type: "tick",
      states: this.states(),
      dt: delta,
      time: this.world.elapsed,
      nodes,
      input,
    });
  }
  stop() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.worker?.terminate();
    this.worker = null;
    this.ready = false;
    this.busy = false;
    this.acc = 0;
    this.previous.clear();
    this.pressed.clear();
    this.released.clear();
  }
}
