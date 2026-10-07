import * as THREE from "three";
import { shadowDefaults } from "./features06";
import type { Project } from "./model";
export function configureLighting(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  settings: Project["settings"],
  focus = new THREE.Vector3(),
) {
  const s = { ...shadowDefaults, ...settings.shadows },
    sun = scene.getObjectByName("studio-sun") as
      | THREE.DirectionalLight
      | undefined,
    ambient = scene.getObjectByName("studio-ambient") as
      | THREE.HemisphereLight
      | undefined;
  if (!sun) return;
  const max = Math.min(s.resolution, renderer.capabilities.maxTextureSize),
    signature = [s.enabled, s.filter, max, s.softness].join("/");
  if (sun.userData.shadowSignature !== signature) {
    sun.userData.shadowSignature = signature;
    renderer.shadowMap.enabled = s.enabled;
    renderer.shadowMap.type =
      s.filter === "vsm" ? THREE.VSMShadowMap : THREE.PCFSoftShadowMap;
    sun.castShadow = s.enabled;
    sun.shadow.map?.dispose();
    sun.shadow.mapPass?.dispose();
    sun.shadow.map = null;
    sun.shadow.mapPass = null;
    sun.shadow.mapSize.set(max, max);
    scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        const materials = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of materials) m.needsUpdate = true;
      }
    });
  }
  sun.shadow.radius = s.softness;
  sun.shadow.blurSamples = Math.max(2, Math.round(s.softness * 2));
  sun.shadow.bias = s.bias;
  sun.shadow.normalBias = s.normalBias;
  sun.shadow.intensity = s.intensity;
  sun.intensity = s.sunPower * (sun.userData.daylight ?? 1);
  if (ambient)
    ambient.intensity = s.ambientPower * (ambient.userData.daylight ?? 1);
  const fill = scene.getObjectByName("studio-fill") as
    | THREE.DirectionalLight
    | undefined;
  if (fill) fill.intensity = s.ambientPower * 0.4;
  const camera = sun.shadow.camera,
    half = s.coverage / 2;
  camera.left = -half;
  camera.right = half;
  camera.top = half;
  camera.bottom = -half;
  camera.near = 0.1;
  camera.far = 240 + s.coverage;
  camera.updateProjectionMatrix();
  const step = s.coverage / max,
    center = s.follow ? focus : new THREE.Vector3();
  const target = new THREE.Vector3(
    Math.round(center.x / step) * step,
    Math.round(center.y / step) * step,
    Math.round(center.z / step) * step,
  );
  const direction =
    (sun.userData.direction as THREE.Vector3 | undefined) ??
    new THREE.Vector3(5, 12, 6).normalize();
  sun.target.position.copy(target);
  sun.target.updateMatrixWorld();
  sun.position.copy(target).addScaledVector(direction, 100);
  sun.updateMatrixWorld();
}
