import * as THREE from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import type { SkyConfig } from "./studio-model";
export class Environment {
  group = new THREE.Group();
  sky: Sky | null = null;
  sun: THREE.Mesh | null = null;
  config: SkyConfig;
  constructor(
    private scene: THREE.Scene,
    config: SkyConfig,
  ) {
    this.config = config;
    if (!config.enabled) return;
    scene.add(this.group);
    this.sky = new Sky();
    this.sky.scale.setScalar(450);
    this.sky.material.uniforms.turbidity.value = 6;
    this.sky.material.uniforms.rayleigh.value = 2;
    this.group.add(this.sky);
    this.sun = new THREE.Mesh(
      new THREE.SphereGeometry(4, 16, 12),
      new THREE.MeshBasicMaterial({ color: "#fff0b1", fog: false }),
    );
    this.group.add(this.sun);
    if (config.clouds)
      for (let i = 0; i < 18; i++) {
        const c = new THREE.Mesh(
          new THREE.BoxGeometry(10 + (i % 4) * 5, 1.5, 5),
          new THREE.MeshBasicMaterial({
            color: "#eaf3ed",
            transparent: true,
            opacity: 0.78,
          }),
        );
        c.position.set(
          Math.sin(i * 4) * 75,
          38 + (i % 3) * 3,
          Math.cos(i * 3) * 75,
        );
        this.group.add(c);
      }
    this.set(config.sunElevation, config.sunAzimuth);
  }
  set(elevation: number, azimuth = this.config.sunAzimuth) {
    if (!this.sky) return;
    const phi = THREE.MathUtils.degToRad(90 - elevation),
      theta = THREE.MathUtils.degToRad(azimuth),
      position = new THREE.Vector3().setFromSphericalCoords(150, phi, theta);
    this.sky.material.uniforms.sunPosition.value.copy(position);
    this.sun?.position.copy(position);
    const ambient = this.scene.getObjectByName("studio-ambient") as
      | THREE.HemisphereLight
      | undefined;
    if (ambient) {
      ambient.userData.daylight = elevation < 0 ? 0.25 : 1;
      ambient.intensity = elevation < 0 ? 0.35 : 1.5;
    }
    const light = this.scene.getObjectByName("studio-sun") as
      | THREE.DirectionalLight
      | undefined;
    if (light) {
      light.userData.direction = position.clone().normalize();
      light.userData.daylight = Math.max(
        0.06,
        Math.sin((elevation * Math.PI) / 180),
      );
      light.position.copy(position.clone().normalize().multiplyScalar(40));
      light.intensity = Math.max(
        0.08,
        Math.sin((elevation * Math.PI) / 180) * 3,
      );
    }
  }
  dispose() {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach((m) => m.dispose());
      }
    });
    this.group.removeFromParent();
    const ambient = this.scene.getObjectByName("studio-ambient") as
      | THREE.HemisphereLight
      | undefined;
    if (ambient) {
      ambient.intensity = 2;
      delete ambient.userData.daylight;
    }
    const light = this.scene.getObjectByName("studio-sun") as
      | THREE.DirectionalLight
      | undefined;
    if (light) {
      light.intensity = 3;
      delete light.userData.direction;
      delete light.userData.daylight;
      light.position.set(5, 12, 6);
    }
  }
}
