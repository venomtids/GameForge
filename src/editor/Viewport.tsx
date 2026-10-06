import { AdaptiveResolution, type QualityMode } from "../engine/render-quality";
import { TouchInput } from "../engine/TouchInput";
import { selectionRoots } from "../engine/editor-operations";
import { TerrainBrushController } from "./TerrainBrushController";
import type { Surface } from "../engine/studio-model";
import { configureLighting } from "../engine/Lighting";
import { GameUI } from "../engine/GameUI";
import type { Brush, BrushMode } from "../engine/design";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { World, addLighting } from "../engine/World";
import { ScriptHost } from "../engine/Scripts";
import { CameraRig } from "../engine/CameraRig";
import {
  cameraModes,
  type CameraMode,
  type Node3D,
  type Project,
  type SceneData,
  type Vec3,
} from "../engine/model";
export type Tool = "translate" | "rotate" | "scale";
export interface ViewportAPI {
  focus: () => void;
  screenshot: () => string | undefined;
  respawn: () => void;
  thumbnail: () => string | undefined;
  previewAnimation: (time: number | null) => void;
}
interface Props {
  selection: string[];
  quality: QualityMode;
  previewSky: boolean;
  snapSteps: { translation: number; rotation: number; scale: number };
  onSetPaused: (p: boolean) => void;
  onContextAction: (action: string) => void;
  onVoxelEdit: (cell: [number, number, number], type: number) => void;
  voxelBlock: number;
  brushMode: BrushMode;
  brush: Brush;
  onTerrainCommit: (id: string, surface: Surface) => void;
  onDesignHit: (id: string, point: Vec3) => void;
  data: SceneData;
  settings: Project["settings"];
  selected: string | null;
  tool: Tool;
  snap: boolean;
  grid: boolean;
  playing: boolean;
  paused: boolean;
  cameraMode: CameraMode;
  colliders: boolean;
  space: "world" | "local";
  scriptsAllowed: boolean;
  onPause: () => void;
  onSelect: (id: string | null, additive?: boolean) => void;
  onTransform: (id: string, patch: Partial<Node3D>) => void;
  onLog: (text: string) => void;
  onStats: (fps: number, calls: number, resolution: number) => void;
}
export default forwardRef<ViewportAPI, Props>(function Viewport(props, ref) {
  const mount = useRef<HTMLDivElement>(null),
    current = useRef(props);
  current.current = props;
  const animationPreview = useRef<number | null>(null);
  const api = useRef<{
    world: World;
    rig: CameraRig;
    transform: TransformControls;
    renderer: THREE.WebGLRenderer;
    grid: THREE.GridHelper;
    box: THREE.BoxHelper;
    scene: THREE.Scene;
    scripts: ScriptHost;
    keys: Set<string>;
    selectionBoxes: THREE.BoxHelper[];
    backdrop: { color: string; texture: THREE.CanvasTexture } | null;
  } | null>(null);
  const [context, setContext] = useState<{
    x: number;
    y: number;
    cell?: [number, number, number];
    normal?: number[];
  } | null>(null);
  const [error, setError] = useState(""),
    [hud, setHud] = useState({
      health: 100,
      humanoid: false,
      collected: 0,
      total: 0,
      elapsed: 0,
      deaths: 0,
      checkpoint: "Início",
      completed: false,
    });
  useImperativeHandle(ref, () => ({
    focus: () => {
      const a = api.current;
      if (a) {
        const bounds = new THREE.Box3();
        for (const id of current.current.selection) {
          const object = a.world.objects.get(id);
          if (object) bounds.union(new THREE.Box3().setFromObject(object));
        }
        if (bounds.isEmpty()) a.rig.focus(a.world.root);
        else a.rig.focusBounds(bounds);
      }
    },
    screenshot: () => {
      const a = api.current;
      if (!a) return;
      a.rig.render(a.renderer, a.scene);
      return a.renderer.domElement.toDataURL("image/png");
    },
    respawn: () => api.current?.world.respawn(),
    previewAnimation: (time) => {
      animationPreview.current = time;
      if (time === null) api.current?.world.restoreAnimationPoses();
    },
    thumbnail: () => {
      const a = api.current;
      if (!a) return;
      a.rig.render(a.renderer, a.scene);
      const image = document.createElement("canvas");
      image.width = 360;
      image.height = 210;
      image
        .getContext("2d")
        ?.drawImage(a.renderer.domElement, 0, 0, image.width, image.height);
      return image.toDataURL("image/jpeg", 0.72);
    },
  }));
  useEffect(() => {
    const host = mount.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        preserveDrawingBuffer: false,
        powerPreference: "high-performance",
      });
    } catch {
      setError("WebGL indisponível. Ative a aceleração de hardware.");
      return;
    }
    const resolution = new AdaptiveResolution(devicePixelRatio);
    let quality = current.current.quality,
      contextLost = false;
    renderer.setPixelRatio(resolution.setMode(quality));
    const lost = (event: Event) => {
      event.preventDefault();
      contextLost = true;
      current.current.onSetPaused(true);
      setError(
        "A conexão com a GPU foi perdida. Aguardando recuperação… Seu projeto está preservado.",
      );
    };
    const restored = () => {
      contextLost = false;
      setError("");
      current.current.onLog("Conexão com a GPU restaurada.");
    };
    renderer.domElement.addEventListener("webglcontextlost", lost);
    renderer.domElement.addEventListener("webglcontextrestored", restored);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute("aria-label", "Cena 3D interativa");
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const unlight = addLighting(scene);
    const rig = new CameraRig(renderer.domElement);
    rig.onNotice = (t) => current.current.onLog(t);
    const grid = new THREE.GridHelper(140, 140, "#47565b", "#303d43");
    grid.position.y = -1.4;
    scene.add(grid);
    const transform = new TransformControls(rig.camera, renderer.domElement);
    transform.setSize(0.8);
    scene.add(transform.getHelper());
    const world = new World(scene);
    world.onEvent = (t) => current.current.onLog(t);
    const scripts = new ScriptHost(world, (t) => current.current.onLog(t));
    const box = new THREE.BoxHelper(new THREE.Object3D(), "#79dec0");
    box.visible = false;
    scene.add(box);
    const keys = new Set<string>();
    const ui = new GameUI(host, world, (p) => current.current.onSetPaused(p));
    const touch = new TouchInput(
      host,
      keys,
      scripts.pressed,
      scripts.released,
      (key) => world.queueAction(key),
    );
    api.current = {
      world,
      rig,
      transform,
      renderer,
      grid,
      box,
      scene,
      scripts,
      keys,
      selectionBoxes: [],
      backdrop: null,
    };
    let dirty = false;
    transform.addEventListener("dragging-changed", (e) => {
      rig.controls.enabled = !e.value;
      if (!e.value && dirty) {
        const o = transform.object;
        if (o)
          current.current.onTransform(o.userData.nodeId, {
            position: o.position
              .toArray()
              .map((v) => Math.max(-10000, Math.min(10000, v))) as Vec3,
            rotation: [o.rotation.x, o.rotation.y, o.rotation.z].map(
              THREE.MathUtils.radToDeg,
            ) as Vec3,
            scale: o.scale
              .toArray()
              .map((v) => Math.max(0.01, Math.min(100, v))) as Vec3,
          });
        dirty = false;
      }
    });
    transform.addEventListener("objectChange", () => {
      dirty = true;
      box.update();
    });
    const resize = new ResizeObserver(() => {
      const w = host.clientWidth,
        h = host.clientHeight;
      if (w && h) {
        renderer.setSize(w, h);
        rig.resize(w / h);
      }
    });
    resize.observe(host);
    const down = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).closest(
          "input,textarea,select,[contenteditable]",
        )
      )
        return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (current.current.playing) {
        if (e.key === "Escape") {
          current.current.onPause();
          rig.release();
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
            "shift",
            "r",
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
            if (!current.current.paused) world.queueAction(e.key.toLowerCase());
          }
        }
      }
    };
    const up = (e: KeyboardEvent) => {
        keys.delete(e.key.toLowerCase());
        scripts.released.add(e.key.toLowerCase());
      },
      blur = () => {
        keys.clear();
        world.cancelInputActions();
      };
    const unlock = () => {
      if (
        document.pointerLockElement !== renderer.domElement &&
        current.current.playing &&
        current.current.cameraMode === "first" &&
        !world.inputFrozen
      )
        current.current.onPause();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    document.addEventListener("pointerlockchange", unlock);
    let press = [0, 0];
    const pressPosition = new THREE.Vector3();
    const pdown = (e: PointerEvent) => {
      renderer.domElement.focus({ preventScroll: true });
      press = [e.clientX, e.clientY];
      pressPosition.copy(rig.camera.position);
      setContext(null);
      if (
        current.current.playing &&
        !current.current.paused &&
        !world.inputFrozen
      ) {
        keys.add("mouse" + e.button);
        scripts.pressed.add("mouse" + e.button);
      }
    };
    const pointerUp = (e: PointerEvent) => {
      keys.delete("mouse" + e.button);
      scripts.released.add("mouse" + e.button);
    };
    const preventContext = (e: Event) => e.preventDefault();
    window.addEventListener("pointerup", pointerUp);
    renderer.domElement.addEventListener("contextmenu", preventContext);
    const pick = (e: PointerEvent) => {
      if (
        e.button === 2 &&
        !current.current.playing &&
        rig.camera.position.distanceTo(pressPosition) < 0.02 &&
        Math.hypot(e.clientX - press[0], e.clientY - press[1]) < 5
      ) {
        const rect = renderer.domElement.getBoundingClientRect(),
          ray = new THREE.Raycaster();
        ray.setFromCamera(
          new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            (-(e.clientY - rect.top) / rect.height) * 2 + 1,
          ),
          rig.camera,
        );
        const hit = ray
          .intersectObjects(world.root.children, true)
          .find((h) => h.object.visible);
        if (hit?.object.userData.nodeId)
          current.current.onSelect(hit.object.userData.nodeId);
        const voxel = world.voxels?.hit(ray);
        setContext({
          x: Math.max(4, Math.min(e.clientX - rect.left, rect.width - 195)),
          y: Math.max(4, Math.min(e.clientY - rect.top, rect.height - 220)),
          ...(voxel ? { cell: voxel.cell, normal: voxel.normal } : {}),
        });
        return;
      }
      if (
        e.button !== 0 ||
        current.current.playing ||
        transform.dragging ||
        transform.axis ||
        Math.hypot(e.clientX - press[0], e.clientY - press[1]) > 4
      )
        return;
      const rect = renderer.domElement.getBoundingClientRect(),
        ray = new THREE.Raycaster();
      ray.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          (-(e.clientY - rect.top) / rect.height) * 2 + 1,
        ),
        rig.camera,
      );
      const hit = ray.intersectObjects(world.root.children, true).find((h) => {
        let visible = h.object.visible;
        h.object.traverseAncestors((a) => (visible = visible && a.visible));
        return visible;
      });
      if (hit && current.current.brushMode !== "select") {
        const point = hit.point.clone();
        if (
          current.current.data.nodes.find(
            (n) => n.id === hit.object.userData.nodeId,
          )?.surface
        )
          hit.object.worldToLocal(point);
        else hit.object.parent?.worldToLocal(point);
        current.current.onDesignHit(
          hit.object.userData.nodeId,
          point.toArray() as Vec3,
        );
      } else
        current.current.onSelect(
          hit?.object.userData.nodeId ?? null,
          e.ctrlKey || e.metaKey || e.shiftKey,
        );
    };
    renderer.domElement.addEventListener("pointerdown", pdown);
    renderer.domElement.addEventListener("pointerup", pick);
    const terrainBrush = new TerrainBrushController(
      renderer.domElement,
      scene,
      world,
      rig,
      () => current.current,
    );
    const colliderGroup = new THREE.Group();
    scene.add(colliderGroup);
    let colliderSignature = "";
    const helpers: THREE.BoxHelper[] = [];
    const clearHelpers = () => {
      for (const h of helpers) {
        h.geometry.dispose();
        (h.material as THREE.Material).dispose();
        h.removeFromParent();
      }
      helpers.length = 0;
    };
    let frame = 0,
      last = performance.now(),
      sum = 0,
      frames = 0;
    const origin = new THREE.Vector3(),
      direction = new THREE.Vector3(),
      centerRay = new THREE.Raycaster();
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const p = current.current;
      if (
        document.hidden ||
        contextLost ||
        host.clientWidth === 0 ||
        host.clientHeight === 0
      ) {
        sum = 0;
        frames = 0;
        return;
      }
      if (quality !== p.quality) {
        quality = p.quality;
        renderer.setPixelRatio(resolution.setMode(quality));
      }
      touch.setEnabled(p.playing && !p.paused && !world.inputFrozen);
      if (!p.playing && animationPreview.current !== null)
        world.previewAnimation(p.selected, animationPreview.current);
      rig.configure(p.settings);
      rig.playing = p.playing;
      rig.paused = p.paused || world.inputFrozen;
      if (
        world.inputFrozen &&
        document.pointerLockElement === renderer.domElement
      )
        rig.release();
      scripts.paused = p.paused;
      grid.visible = p.grid && !p.playing;
      grid.position.y = p.data.nodes.some((n) => n.surface) ? -25 : -1.4;
      if (p.playing && !p.paused) {
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
        world.update(dt, keys, p.cameraMode === "first" ? rig.yaw : 0);
      }
      terrainBrush.update();
      rig.update(world, dt);
      world.refresh();
      configureLighting(
        scene,
        renderer,
        p.settings,
        p.playing && world.playerId
          ? world.objects
              .get(world.playerId)!
              .getWorldPosition(new THREE.Vector3())
          : rig.controls.target,
      );
      ui.update(p.playing, p.paused);
      if (box.visible) box.update();
      for (const helper of api.current?.selectionBoxes ?? []) helper.update();
      const signature = p.colliders
        ? p.data.id +
          ":" +
          world.root.children[0]?.uuid +
          ":" +
          world.configs.map((n) => n.id + ":" + n.physics).join(",")
        : "";
      if (signature !== colliderSignature) {
        clearHelpers();
        colliderSignature = signature;
        if (p.colliders)
          for (const n of world.configs) {
            if (n.physics === "none" || n.kind === "group") continue;
            const o = world.objects.get(n.id);
            if (o) {
              const helper = new THREE.BoxHelper(
                o,
                n.physics === "dynamic" ? "#efc078" : "#79dfcc",
              );
              helpers.push(helper);
              colliderGroup.add(helper);
            }
          }
      }
      for (const h of helpers) h.update();
      sum += dt;
      frames++;
      if (sum >= 0.5) {
        setHud({
          health: world.health.get(world.playerId ?? "") ?? 100,
          humanoid: !!world.configs.find((n) => n.id === world.playerId)?.actor
            .humanoid,
          collected: world.collected,
          total: world.total,
          elapsed: world.elapsed,
          deaths: world.deaths,
          checkpoint: world.checkpointName,
          completed: world.completed,
        });
        current.current.onStats(
          Math.round(frames / sum),
          renderer.info.render.calls,
          renderer.getPixelRatio(),
        );
        const nextRatio = resolution.sample(frames / sum, quality);
        if (Math.abs(renderer.getPixelRatio() - nextRatio) > 0.01)
          renderer.setPixelRatio(nextRatio);
        sum = 0;
        frames = 0;
      }
      // Always draw AFTER any adaptive pixel-ratio resize: otherwise WebGL
      // clears the previous frame and narrow screens flash a blank canvas.
      rig.render(renderer, scene);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      document.removeEventListener("pointerlockchange", unlock);
      renderer.domElement.removeEventListener("pointerdown", pdown);
      renderer.domElement.removeEventListener("pointerup", pick);
      scripts.stop();
      ui.dispose();
      touch.dispose();
      window.removeEventListener("pointerup", pointerUp);
      renderer.domElement.removeEventListener("contextmenu", preventContext);
      terrainBrush.dispose();
      transform.dispose();
      rig.dispose();
      clearHelpers();
      world.dispose();
      unlight();
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
      box.geometry.dispose();
      (box.material as THREE.Material).dispose();
      for (const helper of api.current?.selectionBoxes ?? []) {
        helper.removeFromParent();
        helper.geometry.dispose();
        (helper.material as THREE.Material).dispose();
      }
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      renderer.domElement.removeEventListener("webglcontextrestored", restored);
      api.current?.backdrop?.texture.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      api.current = null;
    };
  }, []);
  useEffect(() => {
    const a = api.current;
    if (!a) return;
    a.transform.detach();
    a.scripts.stop();
    a.keys.clear();
    a.world.load(props.data, props.settings, props.playing);
    a.rig.yaw = 0;
    a.rig.pitch = -0.12;
    if (props.playing && props.scriptsAllowed) a.scripts.start();
    const o = a.world.objects.get(props.selected ?? "");
    if (
      o &&
      props.selection.length <= 1 &&
      props.brushMode === "select" &&
      !props.playing
    ) {
      if (!props.data.nodes.find((n) => n.id === props.selected)?.locked)
        a.transform.attach(o);
      a.box.setFromObject(o);
      a.box.visible = true;
    } else a.box.visible = false;
  }, [props.data, props.settings, props.playing, props.scriptsAllowed]);
  useEffect(() => {
    const a = api.current;
    if (!a) return;
    if (a.world.environment)
      a.world.environment.group.visible = props.playing || props.previewSky;
    if (props.playing || props.previewSky) {
      a.scene.background = new THREE.Color(props.settings.background);
      return;
    }
    if (!a.backdrop || a.backdrop.color !== props.settings.background) {
      a.backdrop?.texture.dispose();
      const canvas = document.createElement("canvas");
      canvas.width = 2;
      canvas.height = 256;
      const context = canvas.getContext("2d")!;
      const gradient = context.createLinearGradient(0, 0, 0, 256),
        color = new THREE.Color(props.settings.background);
      gradient.addColorStop(
        0,
        color.clone().lerp(new THREE.Color("#afc3c3"), 0.18).getStyle(),
      );
      gradient.addColorStop(
        1,
        color.clone().lerp(new THREE.Color("#1b2c39"), 0.28).getStyle(),
      );
      context.fillStyle = gradient;
      context.fillRect(0, 0, 2, 256);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      a.backdrop = { color: props.settings.background, texture };
    }
    a.scene.background = a.backdrop.texture;
  }, [props.data, props.settings, props.playing, props.previewSky]);
  useEffect(() => {
    const a = api.current;
    if (!a) return;
    const o = a.world.objects.get(props.selected ?? "");
    a.transform.detach();
    if (
      o &&
      props.selection.length <= 1 &&
      props.brushMode === "select" &&
      !props.playing
    ) {
      if (!props.data.nodes.find((n) => n.id === props.selected)?.locked)
        a.transform.attach(o);
      a.box.setFromObject(o);
      a.box.visible = true;
    } else a.box.visible = false;
  }, [
    props.selected,
    props.selection,
    props.playing,
    props.data,
    props.brushMode,
  ]);
  useEffect(() => {
    const a = api.current;
    if (!a) return;
    for (const helper of a.selectionBoxes) {
      helper.removeFromParent();
      helper.geometry.dispose();
      (helper.material as THREE.Material).dispose();
    }
    a.selectionBoxes = [];
    if (props.playing || props.selection.length < 2) return;
    for (const n of selectionRoots(props.data.nodes, props.selection)) {
      const object = a.world.objects.get(n.id);
      if (!object) continue;
      const helper = new THREE.BoxHelper(object, "#b4ed83");
      a.scene.add(helper);
      a.selectionBoxes.push(helper);
    }
  }, [props.selection, props.data, props.playing]);
  useEffect(() => {
    const a = api.current;
    if (!a) return;
    a.rig.set(props.cameraMode);
    a.transform.camera = a.rig.camera;
  }, [props.cameraMode]);
  useEffect(() => {
    const a = api.current;
    if (!a) return;
    a.transform.setMode(props.tool);
    a.transform.setSpace(props.space);
    a.transform.setTranslationSnap(
      props.snap ? props.snapSteps.translation : null,
    );
    a.transform.setRotationSnap(
      props.snap ? THREE.MathUtils.degToRad(props.snapSteps.rotation) : null,
    );
    a.transform.setScaleSnap(props.snap ? props.snapSteps.scale : null);
    a.grid.visible = props.grid;
  }, [
    props.tool,
    props.snap,
    props.grid,
    props.space,
    props.snapSteps.translation,
    props.snapSteps.rotation,
    props.snapSteps.scale,
  ]);
  useEffect(() => {
    const a = api.current;
    if (a && (!props.playing || props.paused)) {
      a.rig.release();
      a.keys.clear();
      a.world.cancelInputActions();
    }
  }, [props.paused, props.playing]);
  return (
    <div
      className={`viewport ${props.playing ? "is-playing" : ""}`}
      ref={mount}
      aria-label="Viewport 3D"
    >
      {error && <div className="webgl-error">{error}</div>}
      {context && !props.playing && (
        <div
          className="viewport-context"
          style={{ left: context.x, top: context.y }}
        >
          <strong>Editar cena</strong>
          {[
            ["add", "Adicionar forma…"],
            ["focus", "Enquadrar seleção"],
            ["duplicate", "Duplicar seleção"],
            ["group", "Agrupar seleção"],
            ["ungroup", "Desagrupar seleção"],
            ["delete", "Excluir seleção"],
          ].map(([action, label]) => (
            <button
              key={action}
              onClick={() => {
                props.onContextAction(action);
                setContext(null);
              }}
            >
              {label}
            </button>
          ))}
          {context.cell && (
            <>
              <hr />
              <button
                onClick={() => {
                  props.onVoxelEdit(context.cell!, 0);
                  setContext(null);
                }}
              >
                Remover bloco
              </button>
              <button
                onClick={() => {
                  const c = context.cell!,
                    n = context.normal!;
                  props.onVoxelEdit(
                    [c[0] + n[0], c[1] + n[1], c[2] + n[2]],
                    props.voxelBlock,
                  );
                  setContext(null);
                }}
              >
                Colocar bloco ativo
              </button>
            </>
          )}
          <button onClick={() => setContext(null)}>Fechar</button>
        </div>
      )}
      <div className="viewport-label">
        <span className="live-dot" />
        {props.playing
          ? props.paused
            ? "SIMULAÇÃO PAUSADA"
            : "RUNTIME"
          : "EDITOR"}
        <span className="subtle">
          {cameraModes[props.cameraMode]} ·{" "}
          {props.colliders ? "Colisores (AABB)" : "Sombreado"}
        </span>
      </div>
      <div className="axis-widget">
        <span className="axis-y">Y</span>
        <span className="axis-z">Z</span>
        <span className="axis-x">X</span>
        <i />
      </div>
      {props.playing && (
        <>
          <div
            className="runtime-hud"
            style={{ display: props.data.voxel ? "none" : undefined }}
          >
            <strong>
              {hud.completed ? "Percurso concluído!" : props.data.name}
            </strong>
            <span>
              {hud.total
                ? `Cristais ${hud.collected} / ${hud.total}`
                : "Simulação em execução"}{" "}
              · {hud.elapsed.toFixed(1)} s
            </span>
            <small>
              {hud.checkpoint} · {hud.deaths} quedas
            </small>
            {hud.humanoid && (
              <small>
                Vida: {Math.ceil(hud.health)}
                {hud.health <= 0 ? " · R para renascer" : ""}
              </small>
            )}
            {props.paused && <small>Use Pausar para continuar</small>}
          </div>
          {props.cameraMode === "first" && !props.paused && (
            <div className="fps-crosshair" />
          )}
        </>
      )}
      <div className="viewport-help">
        {props.playing
          ? props.cameraMode === "first"
            ? "Clique para capturar o mouse · WASD · Espaço · Shift · R checkpoint · Esc soltar"
            : "WASD · Espaço · Shift · R checkpoint · F8 parar"
          : props.brushMode !== "select"
            ? "Pincel ativo: clique e arraste no terreno · Ctrl+Z desfaz · use Selecionar para voltar"
            : "Direito + WASD: voar · Q/E: altura · Shift: acelerar · Clique direito: ações"}
      </div>
    </div>
  );
});
