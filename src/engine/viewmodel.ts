import * as THREE from "three";
/** A tiny second pass only in first person: hands depth-test each other, but
 * the world's depth buffer never clips them. No transparent sorting roulette. */
export const VIEWMODEL_LAYER = 1;
export function renderWithViewmodel(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  visible: boolean,
) {
  const mask = camera.layers.mask,
    clear = renderer.autoClear,
    background = scene.background;
  try {
    camera.layers.disable(VIEWMODEL_LAYER);
    renderer.render(scene, camera);
    if (visible) {
      renderer.autoClear = false;
      renderer.clearDepth();
      scene.background = null;
      camera.layers.set(VIEWMODEL_LAYER);
      renderer.render(scene, camera);
    }
  } finally {
    camera.layers.mask = mask;
    renderer.autoClear = clear;
    scene.background = background;
  }
}
