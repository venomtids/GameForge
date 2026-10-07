import { decodeProject } from "./engine/serialization";
import { TouchInput } from "./engine/TouchInput";
import { AdaptiveResolution } from "./engine/render-quality";
import { configureLighting } from "./engine/Lighting";
import { GameUI } from "./engine/GameUI";
import * as THREE from "three";
import { World, addLighting } from "./engine/World";
import { CameraRig } from "./engine/CameraRig";
import { ScriptHost } from "./engine/Scripts";
import {
  activeScene,
  parseProject,
  createProject,
  cameraModes,
  type CameraMode,
} from "./engine/model";
try {
  const encoded = document.getElementById("project-data")!.textContent!.trim();
  const project = encoded.startsWith("__")
    ? createProject()
    : parseProject(decodeProject(encoded));
  const scene = new THREE.Scene();
  addLighting(scene);
  const world = new World(scene);
  const scripts = new ScriptHost(
    world,
    (t) => (document.getElementById("event")!.textContent = t),
  );
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  const resolution = new AdaptiveResolution(devicePixelRatio);
  renderer.setPixelRatio(resolution.ratio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  document.body.append(renderer.domElement);
  const rig = new CameraRig(renderer.domElement);
  rig.configure(project.settings);
  rig.playing = true;
  rig.resize(innerWidth / innerHeight);
  rig.onNotice = (t) => (document.getElementById("event")!.textContent = t);
  rig.set(project.settings.gameCamera ?? "third");
  document.getElementById("title")!.textContent = activeScene(project).name;
  document.title = project.name;
  const select = document.createElement("select");
  select.title = "Modo de câmera";
  select.style.cssText =
    "display:block;background:#253c33;color:#c7e5d5;margin-top:10px;padding:6px;border:1px solid #76907e;border-radius:4px";
  for (const [k, v] of Object.entries(cameraModes)) {
    const o = new Option(v, k);
    select.add(o);
  }
  select.value = rig.mode;
  select.onchange = () => rig.set(select.value as CameraMode);
  document.getElementById("hud")!.append(select);
  const keys = new Set<string>();
  const touch = new TouchInput(
    document.body,
    keys,
    scripts.pressed,
    scripts.released,
    (key) => world.queueAction(key),
  );
  let paused = false,
    allowed = false;
  const setPause = (p: boolean) => {
    paused = p;
    rig.paused = p;
    scripts.paused = p;
    keys.clear();
    if (p) {
      rig.release();
      world.cancelInputActions();
    }
    document.getElementById("overlay")!.style.display = p ? "grid" : "none";
  };
  const ui = new GameUI(document.body, world, setPause);
  renderer.domElement.addEventListener("contextmenu", (e) =>
    e.preventDefault(),
  );
  renderer.domElement.addEventListener("pointerdown", (e) => {
    if (!paused && !world.inputFrozen) {
      keys.add("mouse" + e.button);
      scripts.pressed.add("mouse" + e.button);
    }
  });
  window.addEventListener("pointerup", (e) => {
    keys.delete("mouse" + e.button);
    scripts.released.add("mouse" + e.button);
  });
  if (activeScene(project).ui?.length)
    document.getElementById("hud")!.style.zIndex = "12";
  const scriptButton = document.createElement("button");
  scriptButton.textContent = "Permitir scripts (somente se confiar)";
  scriptButton.style.marginLeft = "8px";
  scriptButton.hidden = !activeScene(project).nodes.some(
    (n) => n.script.enabled,
  );
  document.getElementById("hud")!.append(scriptButton);
  scriptButton.onclick = () => {
    if (
      confirm(
        "Este projeto contém código. Execute somente scripts de confiança. Permitir Lua/JavaScript?",
      )
    ) {
      allowed = true;
      scripts.start();
      scriptButton.hidden = true;
      if (activeScene(project).ui?.length)
        document.getElementById("hud")!.hidden = true;
      setPause(false);
    }
  };
  window.addEventListener("keydown", (e) => {
    if (
      (e.target as HTMLElement).closest("input,select,textarea") ||
      e.ctrlKey ||
      e.metaKey ||
      e.altKey
    )
      return;
    if (e.key === "Escape") {
      setPause(!paused);
      return;
    }
    if (
      /^[a-z0-9]$/i.test(e.key) ||
      [
        "w",
        "a",
        "s",
        "d",
        " ",
        "r",
        "shift",
        "arrowup",
        "arrowdown",
        "arrowleft",
        "arrowright",
      ].includes(e.key.toLowerCase())
    ) {
      e.preventDefault();
      if (!e.repeat || ![" ", "r"].includes(e.key))
        keys.add(e.key.toLowerCase());
      if (!e.repeat) {
        scripts.pressed.add(e.key.toLowerCase());
        if (!paused) world.queueAction(e.key.toLowerCase());
      }
    }
  });
  window.addEventListener("keyup", (e) => {
    keys.delete(e.key.toLowerCase());
    scripts.released.add(e.key.toLowerCase());
  });
  window.addEventListener("blur", () => setPause(true));
  document.addEventListener("pointerlockchange", () => {
    if (
      document.pointerLockElement !== renderer.domElement &&
      rig.mode === "first" &&
      !world.inputFrozen
    )
      setPause(true);
  });
  world.onEvent = (t) => (document.getElementById("event")!.textContent = t);
  const restart = () => {
    scripts.stop();
    world.load(activeScene(project), project.settings, true);
    rig.yaw = 0;
    rig.pitch = -0.12;
    document.getElementById("event")!.textContent = "";
    if (allowed) scripts.start();
    setPause(false);
  };
  restart();
  document.getElementById("restart")!.onclick = restart;
  document.getElementById("resume")!.onclick = () => setPause(false);
  window.addEventListener("resize", () => {
    rig.resize(innerWidth / innerHeight);
    renderer.setSize(innerWidth, innerHeight);
  });
  let last = performance.now(),
    sum = 0,
    frames = 0;
  const origin = new THREE.Vector3(),
    direction = new THREE.Vector3(),
    centerRay = new THREE.Raycaster();
  function frame(now: number) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (document.hidden) return;
    touch.setEnabled(!paused && !world.inputFrozen);
    if (!paused) {
      rig.camera.getWorldPosition(origin);
      rig.camera.getWorldDirection(direction);
      centerRay.set(origin, direction);
      centerRay.near = 0;
      centerRay.far = 6;
      const ray = centerRay,
        hit = ray
          .intersectObjects(world.root.children, true)
          .find(
            (h) =>
              h.object.visible &&
              h.object.userData.nodeId &&
              h.object.userData.nodeId !== world.playerId,
          );
      scripts.context = {
        camera: { origin: origin.toArray(), direction: direction.toArray() },
        ray: world.voxels?.hit(ray) ?? null,
        target: hit
          ? { id: hit.object.userData.nodeId, distance: hit.distance }
          : null,
      };
      scripts.update(dt, keys);
      world.update(dt, keys, rig.mode === "first" ? rig.yaw : 0);
    }
    rig.paused = paused || world.inputFrozen;
    if (world.inputFrozen) rig.release();
    rig.update(world, dt);
    world.refresh();
    ui.update(true, paused);
    document.getElementById("score")!.textContent =
      `${world.completed ? "Concluído! " : ""}Cristais: ${world.collected}/${world.total} · ${world.elapsed.toFixed(1)} s · ${world.checkpointName} · ${world.deaths} quedas${world.configs.find((n) => n.id === world.playerId)?.actor.humanoid ? " · Vida: " + Math.ceil(world.health.get(world.playerId!) ?? 100) + " · R renascer" : ""}`;
    configureLighting(
      scene,
      renderer,
      project.settings,
      world.playerId
        ? world.objects
            .get(world.playerId)!
            .getWorldPosition(new THREE.Vector3())
        : rig.controls.target,
    );
    sum += dt;
    frames++;
    if (sum > 0.75) {
      const ratio = resolution.sample(frames / sum, "auto");
      if (Math.abs(renderer.getPixelRatio() - ratio) > 0.01)
        renderer.setPixelRatio(ratio);
      sum = 0;
      frames = 0;
    }
    // Resize the backbuffer BEFORE drawing. A late setPixelRatio clears the
    // just-presented mobile frame and can show only the blue CSS background.
    rig.render(renderer, scene);
  }
  requestAnimationFrame(frame);
  window.addEventListener(
    "pagehide",
    () => {
      touch.dispose();
      scripts.stop();
      world.audio.stopAll();
    },
    { once: true },
  );
} catch (e) {
  document.getElementById("event")!.textContent =
    "Não foi possível carregar a cena: " + String(e);
}
