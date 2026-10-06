import { fpsArms, animateArms, styleArms, setHandProp } from "./Humanoid";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { controls, type Project, type CameraMode } from "./model";
import type { World } from "./World";
export class CameraRig {
  arms = fpsArms();
  torch = new THREE.SpotLight(
    "#ffeed0",
    26,
    30,
    THREE.MathUtils.degToRad(33),
    0.45,
    1.2,
  );
  private torchSignature = "";
  private handKind = "";
  private shakeAmount = 0;
  private shakeLeft = 0;
  perspective = new THREE.PerspectiveCamera(55, 1, 0.06, 1000);
  orthographic = new THREE.OrthographicCamera(-12, 12, 12, -12, 0.06, 1000);
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera = this.perspective;
  controls: OrbitControls;
  mode: CameraMode = "perspective";
  options = controls({});
  configure(settings: Project["settings"]) {
    this.options = controls(settings);
    this.controls.rotateSpeed = this.options.orbitSpeed;
    this.controls.panSpeed = this.options.panSpeed;
    this.controls.zoomSpeed = this.options.zoomSpeed;
  }
  flying = false;
  flyKeys = new Set<string>();
  private flyKey = (e: KeyboardEvent) => {
    if (
      !this.flying ||
      (e.target as HTMLElement).closest(
        "input,textarea,select,[contenteditable]",
      )
    )
      return;
    if (["w", "a", "s", "d", "q", "e", "shift"].includes(e.key.toLowerCase())) {
      this.flyKeys.add(e.key.toLowerCase());
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  };
  private flyUp = (e: KeyboardEvent) =>
    this.flyKeys.delete(e.key.toLowerCase());
  private blur = () => {
    this.flying = false;
    this.flyKeys.clear();
    this.dragging = false;
    if (!this.playing) this.controls.enabled = true;
  };
  yaw = 0;
  pitch = -0.1;
  playing = false;
  paused = false;
  dragging = false;
  aspect = 1;
  onNotice: (t: string) => void = () => {};
  private move = (e: MouseEvent) => {
    if (this.flying && !this.playing) {
      const rotation = new THREE.Euler().setFromQuaternion(
        this.camera.quaternion,
        "YXZ",
      );
      rotation.y -= e.movementX * 0.002 * this.options.editorLook;
      rotation.x = THREE.MathUtils.clamp(
        rotation.x - e.movementY * 0.002 * this.options.editorLook,
        -1.55,
        1.55,
      );
      this.camera.quaternion.setFromEuler(rotation);
      this.controls.target
        .copy(this.camera.position)
        .addScaledVector(
          this.camera.getWorldDirection(new THREE.Vector3()),
          10,
        );
      return;
    }
    if (this.mode !== "first" || !this.playing || this.paused) return;
    if (document.pointerLockElement !== this.canvas && !this.dragging) return;
    this.yaw -= e.movementX * 0.002 * this.options.mouseSensitivity;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch - e.movementY * 0.002 * this.options.mouseSensitivity,
      -1.4,
      1.4,
    );
  };
  private down = (e: PointerEvent) => {
    if (e.button === 2 && !this.playing && this.camera === this.perspective) {
      this.flying = true;
      this.controls.enabled = false;
      e.preventDefault();
      return;
    }
    if (
      e.button === 0 &&
      this.mode === "first" &&
      this.playing &&
      !this.paused
    ) {
      this.dragging = true;
      void this.capture();
    }
  };
  private up = () => {
    this.dragging = false;
    if (this.flying) {
      this.flying = false;
      this.flyKeys.clear();
      this.controls.enabled = true;
    }
  };
  constructor(private canvas: HTMLCanvasElement) {
    this.perspective.position.set(14, 12, 17);
    this.perspective.add(this.arms);
    this.arms.visible = false;
    this.torch.name = "studio-torch";
    this.torch.position.set(0.24, -0.2, 0);
    this.torch.target.position.set(0, -0.12, -1);
    this.perspective.add(this.torch);
    this.perspective.add(this.torch.target);
    this.torch.visible = false;
    this.controls = this.makeControls(new THREE.Vector3(0, 0.3, 0));
    window.addEventListener("mousemove", this.move);
    window.addEventListener("keydown", this.flyKey);
    window.addEventListener("keyup", this.flyUp);
    window.addEventListener("blur", this.blur);
    canvas.addEventListener("pointerdown", this.down);
    window.addEventListener("pointerup", this.up);
  }
  private makeControls(target: THREE.Vector3) {
    const c = new OrbitControls(this.camera, this.canvas);
    c.target.copy(target);
    c.rotateSpeed = this.options.orbitSpeed;
    c.panSpeed = this.options.panSpeed;
    c.zoomSpeed = this.options.zoomSpeed;
    c.mouseButtons.RIGHT =
      this.camera === this.perspective ? (-1 as THREE.MOUSE) : THREE.MOUSE.PAN;
    c.enableDamping = true;
    c.dampingFactor = 0.12;
    c.minDistance = 0.5;
    c.maxDistance = 250;
    c.enableRotate = ![
      "top",
      "bottom",
      "front",
      "back",
      "left",
      "right",
      "iso",
    ].includes(this.mode);
    c.update();
    return c;
  }
  set(mode: CameraMode) {
    const target = this.controls.target.clone(),
      distance = Math.max(6, this.camera.position.distanceTo(target));
    this.mode = mode;
    this.controls.dispose();
    const ortho = [
      "top",
      "bottom",
      "front",
      "back",
      "left",
      "right",
      "iso",
    ].includes(mode);
    this.camera = ortho ? this.orthographic : this.perspective;
    const directions: Partial<Record<CameraMode, number[]>> = {
      top: [0, 1, 0.0001],
      bottom: [0, -1, 0.0001],
      front: [0, 0, 1],
      back: [0, 0, -1],
      left: [-1, 0, 0],
      right: [1, 0, 0],
      iso: [1, 1, 1],
    };
    const dir = directions[mode] ?? [1, 0.75, 1];
    this.camera.position
      .copy(target)
      .add(
        new THREE.Vector3(...(dir as [number, number, number]))
          .normalize()
          .multiplyScalar(distance),
      );
    this.orthographic.zoom = 1;
    this.controls = this.makeControls(target);
    this.resize(this.aspect);
    if (mode !== "first") this.release();
  }
  resize(aspect: number) {
    this.aspect = aspect;
    this.perspective.aspect = aspect;
    this.perspective.updateProjectionMatrix();
    this.orthographic.left = -12 * aspect;
    this.orthographic.right = 12 * aspect;
    this.orthographic.top = 12;
    this.orthographic.bottom = -12;
    this.orthographic.updateProjectionMatrix();
  }
  focus(o: THREE.Object3D) {
    this.focusBounds(new THREE.Box3().setFromObject(o));
  }
  focusBounds(box: THREE.Box3) {
    if (box.isEmpty()) return;
    const p = box.getCenter(new THREE.Vector3()),
      size = box.getSize(new THREE.Vector3()).length();
    const dir = this.camera.position
      .clone()
      .sub(this.controls.target)
      .normalize();
    this.controls.target.copy(p);
    this.camera.position.copy(p).addScaledVector(dir, Math.max(4, size * 1.2));
    this.orthographic.zoom = Math.min(8, 20 / Math.max(size, 2));
    this.orthographic.updateProjectionMatrix();
    this.controls.update();
  }
  update(world: World, dt: number) {
    if (this.flying && !this.playing) {
      const k = this.flyKeys,
        forward = this.camera.getWorldDirection(new THREE.Vector3()),
        right = new THREE.Vector3()
          .crossVectors(forward, this.camera.up)
          .normalize();
      const direction = new THREE.Vector3()
        .addScaledVector(forward, Number(k.has("w")) - Number(k.has("s")))
        .addScaledVector(right, Number(k.has("d")) - Number(k.has("a")));
      direction.y += Number(k.has("e")) - Number(k.has("q"));
      if (direction.lengthSq())
        direction
          .normalize()
          .multiplyScalar(
            this.options.flySpeed * dt * (k.has("shift") ? 3 : 1),
          );
      this.camera.position.add(direction);
      this.controls.target.add(direction);
      return;
    }
    world.setJellyView(this.camera.position);
    if (this.perspective.parent !== world.scene)
      world.scene.add(this.perspective);
    const torch = world.torch,
      torchSignature = [torch.enabled, torch.shadows].join("/");
    if (torchSignature !== this.torchSignature) {
      this.torchSignature = torchSignature;
      this.torch.castShadow = torch.shadows;
      this.torch.shadow.mapSize.set(1024, 1024);
      this.torch.shadow.camera.near = 0.2;
      this.torch.shadow.camera.far = Math.max(4, torch.distance);
      this.torch.shadow.bias = -0.0015;
      this.torch.shadow.normalBias = 0.03;
      this.torch.shadow.map?.dispose();
      this.torch.shadow.map = null;
    }
    this.torch.visible = torch.enabled && this.playing;
    this.torch.color.set(torch.color);
    this.torch.intensity = torch.intensity;
    this.torch.distance = torch.distance;
    this.torch.angle = THREE.MathUtils.degToRad(torch.angle);
    this.torch.penumbra = torch.penumbra;
    this.torch.position.set(...torch.offset);
    const config = world.configs.find((n) => n.id === world.playerId),
      physical = world.playerId
        ? world.physicalRigs.has(world.playerId)
        : false;
    const player = world.playerId ? world.objects.get(world.playerId) : null;
    this.arms.visible =
      !!config?.actor.humanoid &&
      (world.health.get(config.id) ?? 100) > 0 &&
      !physical &&
      this.mode === "first" &&
      this.playing;
    if (this.arms.visible && config) {
      const b = world.playerId ? world.bodies.get(world.playerId) : null,
        velocity = b ? Math.hypot(b.velocity.x, b.velocity.z) : 0;
      styleArms(
        this.arms,
        config,
        world.jellyCharacters.get(config.id)?.deformation ?? 1,
      );
      animateArms(this.arms, dt, velocity, b ? world.grounded(b) : false);
      const dados = this.arms.userData as any;
      if (dados?.lanterna) dados.lanterna.visible = !!torch.enabled;
      this.arms.traverse((o) => {
        if (o instanceof THREE.Mesh) o.castShadow = false;
      });
    }
    /* objeto na mao livre pedido pelo script (engine.hand) */
    const pedido = world.hand;
    if (
      pedido &&
      (pedido.kind !== this.handKind ||
        (pedido.ate > 0 && world.elapsed > pedido.ate))
    ) {
      this.handKind =
        pedido.ate > 0 && world.elapsed > pedido.ate ? "nenhum" : pedido.kind;
      setHandProp(this.arms, this.handKind);
      if (pedido.ate > 0 && world.elapsed > pedido.ate) pedido.kind = "nenhum";
    }
    /* tremor de camera pedido pelo script (engine.shake) */
    if (world.shake && world.shake.until > world.elapsed) {
      const falta = world.shake.until - world.elapsed;
      this.shakeAmount = world.shake.amount;
      this.shakeLeft = Math.max(this.shakeLeft, Math.min(0.6, falta));
    }
    if (player) {
      player.visible = !physical && (this.mode !== "first" || !this.playing);
    }
    if (
      this.playing &&
      player &&
      (this.mode === "first" || this.mode === "third")
    ) {
      const p = player.getWorldPosition(new THREE.Vector3());
      if (this.mode === "first") {
        this.controls.enabled = false;
        this.controls.target.copy(p);
        const body = world.configs.find((n) => n.id === world.playerId)!;
        this.camera.position
          .copy(p)
          .add(new THREE.Vector3(0, body.scale[1] * 0.42, 0));
        this.camera.rotation.order = "YXZ";
        this.camera.rotation.set(this.pitch, this.yaw, 0);
        this.perspective.fov = this.options.fov;
        this.perspective.updateProjectionMatrix();
      } else {
        this.controls.enabled = false;
        this.perspective.fov = 55;
        this.perspective.updateProjectionMatrix();
        this.camera.position.lerp(
          p
            .clone()
            .add(
              config?.deform.type === "jelly"
                ? new THREE.Vector3(0, 5.6, 8)
                : new THREE.Vector3(6, 6.5, 8),
            ),
          1 - Math.exp(-this.options.followSpeed * dt),
        );
        this.controls.target.copy(p);
        this.camera.lookAt(p);
      }
    } else {
      this.controls.update();
    }
    if (this.shakeLeft > 0) {
      this.shakeLeft = Math.max(0, this.shakeLeft - dt);
      const forca = this.shakeAmount * Math.min(1, this.shakeLeft / 0.25),
        t = performance.now() * 0.001;
      this.camera.position.x += Math.sin(t * 43) * forca * 0.07;
      this.camera.position.y += Math.sin(t * 57 + 1.3) * forca * 0.07;
      this.camera.position.z += Math.cos(t * 37 + 0.7) * forca * 0.05;
      this.camera.rotation.z += Math.sin(t * 61) * forca * 0.035;
      if (this.shakeLeft === 0) this.shakeAmount = 0;
    }
  }
  async capture() {
    if (document.pointerLockElement === this.canvas) return;
    try {
      await this.canvas.requestPointerLock();
    } catch {
      this.onNotice(
        "Captura do mouse indisponível: segure o botão esquerdo e arraste para olhar.",
      );
    }
  }
  release() {
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.dragging = false;
  }
  dispose() {
    this.torch.shadow.map?.dispose();
    this.torch.removeFromParent();
    this.torch.target.removeFromParent();
    this.arms.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    this.perspective.removeFromParent();
    this.release();
    this.controls.dispose();
    window.removeEventListener("mousemove", this.move);
    window.removeEventListener("keydown", this.flyKey);
    window.removeEventListener("keyup", this.flyUp);
    window.removeEventListener("blur", this.blur);
    this.canvas.removeEventListener("pointerdown", this.down);
    window.removeEventListener("pointerup", this.up);
  }
}
