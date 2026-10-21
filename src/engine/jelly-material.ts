import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
/** Clearcoat, not transmission: no extra full-scene render pass on mobile. */
export function jellyMaterial(color: string, opacity = 0.86) {
  const material = new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.18,
    metalness: 0.03,
    clearcoat: 0.85,
    clearcoatRoughness: 0.12,
    transparent: true,
    opacity,
    // Large transparent pads and articulated limbs must occlude per fragment,
    // not depend only on transparent-object center sorting during jumps.
    depthWrite: true,
    emissive: color,
    emissiveIntensity: 0.035,
  });
  material.userData.jelly = true;
  return material;
}
export function jellyBox(
  size: [number, number, number] = [1, 1, 1],
  detail = 2,
) {
  return new RoundedBoxGeometry(...size, detail, Math.min(...size) * 0.12);
}
