import * as THREE from "three";
import type { Brush, BrushMode } from "../engine/design";
import type { SceneData } from "../engine/model";
import type { Surface } from "../engine/studio-model";
import { sculptSurface, surfaceGeometry } from "../engine/surfaces";
import type { World } from "../engine/World";
import type { CameraRig } from "../engine/CameraRig";
interface Props {
  playing: boolean;
  brushMode: BrushMode;
  brush: Brush;
  data: SceneData;
  onSelect: (id: string | null) => void;
  onTerrainCommit: (id: string, s: Surface) => void;
}
const modes = [
  "raise",
  "lower",
  "smooth",
  "flatten",
  "terrainPaint",
  "noise",
  "terrace",
];
export class TerrainBrushController {
  ring = new THREE.LineLoop(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({
      color: "#c0f0bd",
      depthTest: false,
      transparent: true,
      opacity: 0.9,
    }),
  );
  stroke: {
    id: string;
    draft: Surface;
    source: Surface;
    mesh: THREE.Mesh;
    last: THREE.Vector3;
    pointer: number;
  } | null = null;
  constructor(
    private canvas: HTMLCanvasElement,
    scene: THREE.Scene,
    private world: World,
    private rig: CameraRig,
    private props: () => Props,
  ) {
    scene.add(this.ring);
    this.ring.renderOrder = 2000;
    this.ring.visible = false;
    canvas.addEventListener("pointerdown", this.down, true);
    canvas.addEventListener("pointermove", this.move, true);
    canvas.addEventListener("pointerup", this.up, true);
    canvas.addEventListener("pointercancel", this.cancel);
    canvas.addEventListener("pointerleave", this.leave);
    window.addEventListener("keydown", this.key, true);
    window.addEventListener("blur", this.cancel);
  }
  active() {
    return !this.props().playing && modes.includes(this.props().brushMode);
  }
  hit(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect(),
      ray = new THREE.Raycaster();
    ray.setFromCamera(
      new THREE.Vector2(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        (-(e.clientY - r.top) / r.height) * 2 + 1,
      ),
      this.rig.camera,
    );
    return ray.intersectObjects(this.world.root.children, true).find((h) => {
      let visible = h.object.visible;
      h.object.traverseAncestors((p) => (visible &&= p.visible));
      return visible;
    });
  }
  preview = (mesh: THREE.Mesh, s: Surface) => {
    const old = mesh.geometry;
    mesh.geometry = surfaceGeometry(s);
    old.dispose();
  };
  stamp(point: THREE.Vector3, preview = true) {
    const st = this.stroke;
    if (!st) return;
    const p = st.mesh.worldToLocal(point.clone());
    const b = this.props().brush;
    sculptSurface(st.draft, p.toArray(), {
      ...b,
      mode: this.props().brushMode,
    });
    st.last.copy(p);
    if (preview) this.preview(st.mesh, st.draft);
  }
  down = (e: PointerEvent) => {
    if (!this.active() || e.button !== 0) return;
    const h = this.hit(e),
      n = this.props().data.nodes.find(
        (n) => n.id === h?.object.userData.nodeId,
      );
    if (!h || !n?.surface || !(h.object instanceof THREE.Mesh)) return;
    let ancestor: typeof n | undefined = n;
    while (ancestor) {
      if (ancestor.locked) return;
      ancestor = this.props().data.nodes.find((n) => n.id === ancestor!.parent);
    }
    e.preventDefault();
    e.stopImmediatePropagation();
    this.canvas.tabIndex = 0;
    this.canvas.focus({ preventScroll: true });
    this.canvas.setPointerCapture(e.pointerId);
    this.rig.controls.enabled = false;
    this.stroke = {
      id: n.id,
      draft: structuredClone(n.surface),
      source: n.surface,
      mesh: h.object,
      last: new THREE.Vector3(),
      pointer: e.pointerId,
    };
    this.stamp(h.point);
    this.props().onSelect(n.id);
  };
  move = (e: PointerEvent) => {
    if (!this.active()) {
      this.ring.visible = false;
      return;
    }
    const h = this.hit(e),
      n = this.props().data.nodes.find(
        (n) => n.id === h?.object.userData.nodeId,
      );
    this.ring.visible = !!n?.surface;
    if (!h || !n?.surface) return;
    const b = this.props().brush,
      scale = h.object.getWorldScale(new THREE.Vector3()),
      points: THREE.Vector3[] = [];
    if (b.shape === "square") {
      for (const [x, z] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ])
        points.push(
          new THREE.Vector3(x * b.radius * scale.x, 0, z * b.radius * scale.z),
        );
    } else
      for (let i = 0; i < 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        points.push(
          new THREE.Vector3(
            Math.cos(a) * b.radius * scale.x,
            0,
            Math.sin(a) * b.radius * scale.z,
          ),
        );
      }
    this.ring.geometry.dispose();
    this.ring.geometry = new THREE.BufferGeometry().setFromPoints(points);
    this.ring.position.copy(h.point).add(new THREE.Vector3(0, 0.04, 0));
    if (this.stroke && n.id === this.stroke.id) {
      e.preventDefault();
      e.stopImmediatePropagation();
      const local = h.object.worldToLocal(h.point.clone()),
        distance = local.distanceTo(this.stroke.last),
        spacing = Math.max(0.12, b.radius * 0.12);
      if (distance >= spacing) {
        const last = this.stroke.last.clone(),
          count = Math.min(16, Math.ceil(distance / spacing));
        for (let i = 1; i <= count; i++)
          this.stamp(
            h.object.localToWorld(last.clone().lerp(local, i / count)),
            false,
          );
        this.preview(this.stroke.mesh, this.stroke.draft);
      }
    }
  };
  up = (e: PointerEvent) => {
    if (!this.stroke || e.pointerId !== this.stroke.pointer) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const st = this.stroke;
    this.stroke = null;
    this.rig.controls.enabled = true;
    if (this.canvas.hasPointerCapture(e.pointerId))
      this.canvas.releasePointerCapture(e.pointerId);
    this.props().onTerrainCommit(st.id, st.draft);
  };
  cancel = () => {
    if (this.stroke) {
      const st = this.stroke;
      if (this.world.objects.get(st.id) === st.mesh)
        this.preview(st.mesh, st.source);
      this.stroke = null;
      this.rig.controls.enabled = true;
      if (this.canvas.hasPointerCapture(st.pointer))
        this.canvas.releasePointerCapture(st.pointer);
    }
    this.ring.visible = false;
  };
  key = (e: KeyboardEvent) => {
    if (e.key === "Escape" && this.stroke) {
      e.stopImmediatePropagation();
      e.preventDefault();
      this.cancel();
    }
  };
  leave = () => {
    if (!this.stroke) this.ring.visible = false;
  };
  update() {
    if (!this.active()) {
      this.ring.visible = false;
      if (this.stroke) this.cancel();
    }
    if (
      this.stroke &&
      (this.world.objects.get(this.stroke.id) !== this.stroke.mesh ||
        this.props().data.nodes.find((n) => n.id === this.stroke!.id)
          ?.surface !== this.stroke.source)
    )
      this.cancel();
    if (this.stroke) this.rig.controls.enabled = false;
    this.canvas.style.cursor = this.active() ? "crosshair" : "";
  }
  dispose() {
    this.cancel();
    this.ring.geometry.dispose();
    (this.ring.material as THREE.Material).dispose();
    this.ring.removeFromParent();
    this.canvas.removeEventListener("pointerdown", this.down, true);
    this.canvas.removeEventListener("pointermove", this.move, true);
    this.canvas.removeEventListener("pointerup", this.up, true);
    this.canvas.removeEventListener("pointercancel", this.cancel);
    this.canvas.removeEventListener("pointerleave", this.leave);
    window.removeEventListener("keydown", this.key, true);
    window.removeEventListener("blur", this.cancel);
  }
}
